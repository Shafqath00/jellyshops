# Supabase Auth Owner Stores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace demo authentication and starter stores with Supabase email/password accounts where each user owns and manages multiple stores.

**Architecture:** The Next.js browser authenticates with Supabase using its publishable key and sends its access token to the Express API. Express verifies the token through a server-only Supabase client, resolves owner memberships from PostgreSQL, and preserves the existing `requireMerchant` and `requireStorePermission` boundary for every store-scoped operation.

**Tech Stack:** Next.js, React, TypeScript, Express 5, PostgreSQL/Supabase, `@supabase/supabase-js`, Vitest, Playwright.

**Spec:** `backend/docs/superpowers/specs/2026-09-18-supabase-auth-owner-stores-design.md`

## Global Constraints

- Support Supabase email/password sign-up, sign-in, sign-out, and password recovery only.
- A user can own many stores; each store has one owner only in this release.
- Browser code may use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- The backend must use server-only Supabase credentials and must never serialize them.
- Every administrative route must reject a valid user attempting to access another owner's store with `403 STORE_FORBIDDEN`.
- Keep public storefront, catalog, checkout, and public-order-token routes anonymous and store-scoped.
- Do not migrate Sweet Bakes or Bloom Home data to a new owner. Remove demo data only after authenticated flows pass.
- Do not add staff invitations, social login, magic links, MFA, or direct browser access to private commerce tables.

---

## File Map

| Path | Responsibility |
| --- | --- |
| `backend/sql/migrations/20260918000000_add_supabase_owner_identity.sql` | Links internal users to `auth.users`, preserves membership integrity, adds owner lookup indexes, and enables restrictive RLS on auth-facing tables. |
| `backend/src/auth/supabase-token-verifier.ts` | Small server-only adapter that resolves an access token to verified Supabase identity data. |
| `backend/src/auth/supabase-auth-provider.ts` | Converts a Supabase identity into the existing `MerchantPrincipal`. |
| `backend/src/tenants/postgres-repository.ts` | Atomically resolves users, lists owned stores, and creates an owner store. |
| `backend/src/tenants/routes.ts` | Adds authenticated `/api/merchant/me` and owner-store endpoints. |
| `backend/src/config.ts` | Declares Supabase Auth server configuration and makes `supabase` the non-test auth provider. |
| `backend/src/app.ts` | Composes the Supabase auth provider and PostgreSQL tenant repository in normal runtime. |
| `jellyshops/src/features/auth/*` | Browser-safe Supabase client, session provider, route guard, auth forms, and backend token helper. |
| `jellyshops/src/app/login/page.tsx` | Email/password sign-in UI. |
| `jellyshops/src/app/signup/page.tsx` | Email/password sign-up UI. |
| `jellyshops/src/app/forgot-password/page.tsx` | Password recovery request UI. |
| `jellyshops/src/app/reset-password/page.tsx` | Password update UI for a recovery session. |
| `jellyshops/src/app/admin/layout.tsx` | Requires an authenticated session and renders the owner-aware admin shell. |
| `jellyshops/src/features/merchant/*` | Loads `/api/merchant/me`, creates stores, tracks active owned store, and builds authenticated API clients. |
| `jellyshops/src/contexts/shop-context.tsx` | Stops exposing demo reset and browser-local admin ownership state. |
| `jellyshops/src/features/store-editor/api/demo-session.ts` | Deleted after callers use the real authenticated token helper. |
| `jellyshops/src/features/commerce/merchant-session.ts` | Replaced by real authenticated token/store context. |

---

### Task 1: Add Supabase owner identity and ownership database migration

**Files:**
- Create: `backend/sql/migrations/20260918000000_add_supabase_owner_identity.sql`
- Create: `backend/test/integration/supabase-owner-schema.test.ts`
- Modify: `backend/test/integration/helpers/pglite.ts` only if the helper needs to load the new migration.

**Interfaces:**
- Consumes: existing `"User"`, `"Store"`, and `"StoreMembership"` tables.
- Produces: nullable `"User"."supabaseUserId" UUID`, a unique identity index, and efficient owner-store lookup.

- [ ] **Step 1: Write the failing schema test**

```ts
it("links a Supabase auth user to many owner stores but never duplicates the identity", async () => {
  await integration.query(`INSERT INTO "User" ("name", "email", "supabaseUserId") VALUES ($1, $2, $3)`, ["Asha", "asha@example.com", "00000000-0000-4000-8000-000000000001"]);
  await expect(integration.query(`INSERT INTO "User" ("name", "email", "supabaseUserId") VALUES ($1, $2, $3)`, ["Asha Two", "asha2@example.com", "00000000-0000-4000-8000-000000000001"])).rejects.toBeTruthy();
});
```

- [ ] **Step 2: Run the schema test and verify it fails because `supabaseUserId` does not exist**

Run: `cd backend && npm run test:integration -- --run test/integration/supabase-owner-schema.test.ts`

Expected: the insert fails with a missing-column error.

- [ ] **Step 3: Add the migration**

```sql
ALTER TABLE "User" ADD COLUMN "supabaseUserId" UUID;
CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User" ("supabaseUserId") WHERE "supabaseUserId" IS NOT NULL;
CREATE INDEX "StoreMembership_owner_userId_storeId_idx" ON "StoreMembership" ("userId", "storeId") WHERE "role" = 'OWNER';
```

Add an `auth.users(id)` foreign key only after confirming the Supabase migration role can reference the managed `auth` schema. If that reference is unavailable, retain the UUID unique index and enforce identity resolution through the server-only provider; do not weaken store ownership checks.

Enable RLS on tables directly exposed through Supabase Data API and add no broad `anon` or `authenticated` policies. The Express server continues to use its private PostgreSQL pool.

- [ ] **Step 4: Run the schema test and verify it passes**

Run: `cd backend && npm run test:integration -- --run test/integration/supabase-owner-schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the migration and integration test**

```bash
git add backend/sql/migrations/20260918000000_add_supabase_owner_identity.sql backend/test/integration/supabase-owner-schema.test.ts
git commit -m "feat: add Supabase owner identity schema"
```

### Task 2: Implement server-side Supabase token verification

**Files:**
- Create: `backend/src/auth/supabase-token-verifier.ts`
- Create: `backend/src/auth/supabase-auth-provider.ts`
- Create: `backend/src/auth/supabase-auth-provider.test.ts`
- Modify: `backend/src/config.ts`
- Modify: `backend/src/config.test.ts`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: `Authorization: Bearer <Supabase access token>` and `TenantRepository.resolveMerchant`.
- Produces: `AuthProvider.verify(token): Promise<MerchantPrincipal>`.

- [ ] **Step 1: Write failing provider tests**

```ts
it("resolves a verified Supabase user to an owner principal", async () => {
  verifier.getUser.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001", email: "owner@example.com", email_confirmed_at: "2026-09-18T00:00:00Z" });
  tenants.resolveMerchant.mockResolvedValue({ id: 4, stores: [{ id: "store-a", name: "A", slug: "a", currency: "INR", country: "IN", role: "OWNER" }] });
  await expect(provider.verify("access-token")).resolves.toMatchObject({ userId: 4, storeIds: ["store-a"] });
});

it("rejects an unverified email without resolving a merchant", async () => {
  verifier.getUser.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001", email: "owner@example.com", email_confirmed_at: null });
  await expect(provider.verify("access-token")).rejects.toMatchObject({ status: 403, code: "EMAIL_VERIFICATION_REQUIRED" });
  expect(tenants.resolveMerchant).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the provider test and verify it fails because the Supabase provider does not exist**

Run: `cd backend && npm test -- --run src/auth/supabase-auth-provider.test.ts`

Expected: FAIL with module-not-found or missing export.

- [ ] **Step 3: Implement a narrow verifier and provider**

```ts
export interface SupabaseTokenVerifier {
  getUser(accessToken: string): Promise<{ id: string; email?: string; emailConfirmedAt?: string }>;
}

export class SupabaseAuthProvider implements AuthProvider {
  async verify(token: string): Promise<MerchantPrincipal> {
    const identity = await this.verifier.getUser(token);
    if (!identity.email || !identity.emailConfirmedAt) throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Verify an email address before accessing a merchant account");
    const account = await this.tenants.resolveMerchant({ uid: identity.id, email: identity.email.toLowerCase(), name: "" });
    return { userId: account.id, storeIds: account.stores.map((store) => store.id), storeRoles: Object.fromEntries(account.stores.map((store) => [store.id, store.role])) };
  }
}
```

Add `AUTH_PROVIDER=supabase`, `SUPABASE_URL`, and server-only `SUPABASE_SECRET_KEY` validation. In production, reject `development` and `firebase`; retain fake `AuthProvider` injection only for automated tests.

- [ ] **Step 4: Run focused auth/config tests**

Run: `cd backend && npm test -- --run src/auth/supabase-auth-provider.test.ts src/config.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit server auth boundary**

```bash
git add backend/src/auth backend/src/config.ts backend/src/config.test.ts backend/.env.example
git commit -m "feat: verify Supabase merchant sessions"
```

### Task 3: Add PostgreSQL owner-store repository and merchant endpoints

**Files:**
- Create: `backend/src/tenants/postgres-repository.ts`
- Create: `backend/src/tenants/postgres-repository.test.ts`
- Modify: `backend/src/tenants/types.ts`
- Modify: `backend/src/tenants/repository.ts`
- Modify: `backend/src/tenants/routes.ts`
- Modify: `backend/src/tenants/routes.test.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- Consumes: verified Supabase UUID, store creation form `{ name, slug, currency, country }`.
- Produces: `GET /api/merchant/me`, `GET /api/merchant/stores`, and `POST /api/merchant/stores`.

- [ ] **Step 1: Write repository and route tests**

```ts
it("creates a new store and its OWNER membership in one transaction", async () => {
  const created = await repository.createStore(7, { name: "North Star", slug: "north-star", currency: "INR", country: "IN" });
  expect(created).toMatchObject({ slug: "north-star", role: "OWNER" });
  await expect(repository.listStores(7)).resolves.toHaveLength(1);
});

it("returns only stores owned by the authenticated merchant", async () => {
  const response = await request(app).get("/api/merchant/stores").set("authorization", "Bearer owner-a-token");
  expect(response.status).toBe(200);
  expect(response.body.stores.map((store: { id: string }) => store.id)).toEqual(["store-a"]);
});
```

- [ ] **Step 2: Run focused tenant tests and verify failure**

Run: `cd backend && npm test -- --run src/tenants/postgres-repository.test.ts src/tenants/routes.test.ts`

Expected: FAIL because there is no PostgreSQL repository or `/api/merchant/stores` route.

- [ ] **Step 3: Implement transactional owner-store operations**

Use a transaction to insert `Store`, `StoreSettings`, the workspace/default storefront record required by current admin routes, and `StoreMembership(role = 'OWNER')`. Translate duplicate-slug database errors to `409 STORE_SLUG_TAKEN`. Resolve a `User` by `supabaseUserId`; create the internal `User` row only on first verified login.

Add route handlers that obtain `request.merchant!.userId`, never a user ID from JSON or URL input.

- [ ] **Step 4: Run focused tenant tests and backend auth middleware tests**

Run: `cd backend && npm test -- --run src/tenants/postgres-repository.test.ts src/tenants/routes.test.ts src/auth/middleware.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit tenant ownership API**

```bash
git add backend/src/tenants backend/src/app.ts
git commit -m "feat: add owner store management API"
```

### Task 4: Compose Supabase auth in normal backend runtime and prove isolation

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/src/app.test.ts`
- Create: `backend/src/auth/supabase-owner-isolation.test.ts`
- Modify: `backend/src/stripe/accounts/routes.ts`
- Modify: `backend/src/stripe/accounts/routes.test.ts`

**Interfaces:**
- Consumes: `SupabaseAuthProvider`, `PostgresTenantRepository`, and store records.
- Produces: normal server composition with no demo principal; Stripe onboarding input sourced from the authorized store.

- [ ] **Step 1: Write isolation and Stripe metadata tests**

```ts
it("returns STORE_FORBIDDEN when owner A requests owner B's Stripe status", async () => {
  const response = await request(app).get("/api/stores/store-b/stripe-connect/status").set("authorization", "Bearer owner-a-token");
  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe("STORE_FORBIDDEN");
});

it("uses the authorized store name and country for connected-account onboarding", async () => {
  await request(app).post("/api/stores/store-a/stripe-connect/onboarding-link").set("authorization", "Bearer owner-a-token").send({ returnUrl: "http://localhost:3000/admin/payments", refreshUrl: "http://localhost:3000/admin/payments" });
  expect(service.createOnboardingLink).toHaveBeenCalledWith(expect.objectContaining({ displayName: "North Star", country: "IN" }));
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `cd backend && npm test -- --run src/auth/supabase-owner-isolation.test.ts src/stripe/accounts/routes.test.ts`

Expected: FAIL because normal app composition still creates the development provider or Stripe route uses hard-coded defaults.

- [ ] **Step 3: Implement composition and remove hard-coded Stripe store metadata**

In `createApp`, construct `SupabaseAuthProvider` and `PostgresTenantRepository` whenever `AUTH_PROVIDER=supabase`; do not silently fall back to `DevelopmentAuthProvider`. Pass an authorized store lookup to the Stripe onboarding route so it supplies the database name/country.

- [ ] **Step 4: Run backend route regression tests**

Run: `cd backend && npm test -- --run src/auth/supabase-owner-isolation.test.ts src/stripe/accounts/routes.test.ts src/commerce/routes.test.ts src/catalog/routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit composition and isolation**

```bash
git add backend/src/app.ts backend/src/auth/supabase-owner-isolation.test.ts backend/src/stripe/accounts
git commit -m "feat: enforce Supabase owner store isolation"
```

### Task 5: Build browser Supabase Auth and protected admin shell

**Files:**
- Modify: `jellyshops/package.json`
- Create: `jellyshops/src/features/auth/supabase-client.ts`
- Create: `jellyshops/src/features/auth/auth-provider.tsx`
- Create: `jellyshops/src/features/auth/require-session.tsx`
- Create: `jellyshops/src/features/auth/auth-forms.tsx`
- Create: `jellyshops/src/features/auth/auth-provider.test.tsx`
- Create: `jellyshops/src/app/login/page.tsx`
- Create: `jellyshops/src/app/signup/page.tsx`
- Create: `jellyshops/src/app/forgot-password/page.tsx`
- Create: `jellyshops/src/app/reset-password/page.tsx`
- Modify: `jellyshops/src/app/layout.tsx`
- Modify: `jellyshops/src/app/admin/layout.tsx`
- Modify: `jellyshops/.env.example`

**Interfaces:**
- Consumes: browser-safe Supabase environment variables.
- Produces: `useAuth()` with `{ session, user, loading, signOut, accessToken }` and protected `/admin/**` routes.

- [ ] **Step 1: Write failing auth UI tests**

```tsx
it("redirects an unauthenticated admin visitor to login with the original path", async () => {
  render(<RequireSession pathname="/admin/orders" />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fadmin%2Forders"));
});

it("sends email and password to Supabase signInWithPassword", async () => {
  render(<LoginForm />);
  await userEvent.type(screen.getByLabelText("Email"), "owner@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "secure-password");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(signInWithPassword).toHaveBeenCalledWith({ email: "owner@example.com", password: "secure-password" });
});
```

- [ ] **Step 2: Run frontend auth tests and verify failure**

Run: `cd jellyshops && npm test -- --run src/features/auth/auth-provider.test.tsx`

Expected: FAIL because the auth module and pages do not exist.

- [ ] **Step 3: Add `@supabase/supabase-js` and implement browser auth**

Create the client only from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use `onAuthStateChange` to update session state. Forms call `signUp`, `signInWithPassword`, `resetPasswordForEmail`, and `updateUser`; render Supabase errors without exposing implementation details.

Wrap root UI in `AuthProvider`, then wrap `/admin` content with `RequireSession`. Do not protect public `/:storeSlug`, shop, cart, checkout, or public order routes.

- [ ] **Step 4: Run focused auth tests and frontend typecheck**

Run: `cd jellyshops && npm test -- --run src/features/auth/auth-provider.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit frontend auth foundation**

```bash
git add jellyshops/package.json jellyshops/package-lock.json jellyshops/src/features/auth jellyshops/src/app/login jellyshops/src/app/signup jellyshops/src/app/forgot-password jellyshops/src/app/reset-password jellyshops/src/app/layout.tsx jellyshops/src/app/admin/layout.tsx jellyshops/.env.example
git commit -m "feat: add Supabase email password authentication"
```

### Task 6: Add owner store onboarding, active store context, and authenticated API clients

**Files:**
- Create: `jellyshops/src/features/merchant/api.ts`
- Create: `jellyshops/src/features/merchant/merchant-provider.tsx`
- Create: `jellyshops/src/features/merchant/store-onboarding.tsx`
- Create: `jellyshops/src/features/merchant/merchant-provider.test.tsx`
- Create: `jellyshops/src/app/admin/onboarding/page.tsx`
- Modify: `jellyshops/src/components/admin-nav.tsx`
- Modify: `jellyshops/src/components/app-shell.tsx`
- Modify: `jellyshops/src/features/commerce/api/client.ts`
- Modify: `jellyshops/src/features/store-editor/api/client.ts`

**Interfaces:**
- Consumes: `useAuth().accessToken` and `/api/merchant/me`.
- Produces: `useMerchant()` with `{ stores, activeStore, selectStore, refreshStores, createStore }`.

- [ ] **Step 1: Write failing merchant-context tests**

```tsx
it("loads only server-authorized stores and restores an authorized active-store preference", async () => {
  mockFetch.mockResolvedValue(jsonResponse({ user: { id: 7, email: "owner@example.com" }, stores: [{ id: "store-a", name: "A", slug: "a", currency: "INR", country: "IN", role: "OWNER" }] }));
  render(<MerchantProvider><Probe /></MerchantProvider>);
  await waitFor(() => expect(screen.getByText("A")).toBeInTheDocument());
});

it("sends the current Supabase access token on merchant API calls", async () => {
  await api.listOrders("store-a");
  expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/stores/store-a/orders"), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer access-token" }) }));
});
```

- [ ] **Step 2: Run the merchant tests and verify failure**

Run: `cd jellyshops && npm test -- --run src/features/merchant/merchant-provider.test.tsx`

Expected: FAIL because owner-store context does not exist.

- [ ] **Step 3: Implement owner-store context and first-store flow**

The provider loads `/api/merchant/me` after auth restoration. If its store list is empty, redirect to `/admin/onboarding`. The onboarding form creates a store using name, slug, currency, and country. Persist only the selected owned store ID in local storage; discard it if it is absent from the latest API response.

Update commerce/editor API factories to receive `getAccessToken(): Promise<string | null>` rather than importing demo session modules. If no token exists, fail locally with an authentication error instead of issuing an unauthenticated request.

- [ ] **Step 4: Run context/client tests and frontend build**

Run: `cd jellyshops && npm test -- --run src/features/merchant/merchant-provider.test.tsx src/features/commerce/api/client.test.ts src/features/store-editor/api/client.test.ts && npm run build`

Expected: PASS.

- [ ] **Step 5: Commit owner store UX**

```bash
git add jellyshops/src/features/merchant jellyshops/src/app/admin/onboarding jellyshops/src/components jellyshops/src/features/commerce/api jellyshops/src/features/store-editor/api
git commit -m "feat: add authenticated owner store workspace"
```

### Task 7: Move admin pages off demo sessions and browser-local demo ownership

**Files:**
- Modify: `jellyshops/src/contexts/shop-context.tsx`
- Modify: `jellyshops/src/app/admin/page.tsx`
- Modify: `jellyshops/src/app/admin/orders/page.tsx`
- Modify: `jellyshops/src/app/admin/orders/[id]/page.tsx`
- Modify: `jellyshops/src/app/admin/payments/page.tsx`
- Modify: `jellyshops/src/app/admin/online-store/page.tsx`
- Modify: `jellyshops/src/app/admin/online-store/editor/page.tsx`
- Modify: `jellyshops/src/app/admin/online-store/navigation/page.tsx`
- Modify: `jellyshops/src/app/admin/content/pages/page.tsx`
- Modify: `jellyshops/src/app/admin/content/blogs/page.tsx`
- Modify: `jellyshops/src/app/admin/content/metaobjects/page.tsx`
- Modify: `jellyshops/src/app/admin/settings/custom-data/page.tsx`
- Delete: `jellyshops/src/features/store-editor/api/demo-session.ts`
- Delete: `jellyshops/src/features/commerce/merchant-session.ts`

**Interfaces:**
- Consumes: `useMerchant().activeStore` and authenticated API factories.
- Produces: admin pages that cannot render or mutate demo/fixed store data.

- [ ] **Step 1: Write a failing representative-page test**

```tsx
it("loads payment status for the authenticated active store instead of store-demo", async () => {
  render(<PaymentsPage />, { wrapper: authenticatedMerchantWrapper({ activeStore: { id: "store-a", name: "A", slug: "a", currency: "INR", country: "IN", role: "OWNER" } }) });
  await waitFor(() => expect(mockGetStripeStatus).toHaveBeenCalledWith("store-a"));
});
```

- [ ] **Step 2: Run the representative test and verify failure**

Run: `cd jellyshops && npm test -- --run src/app/admin/payments/page.test.tsx`

Expected: FAIL because the page imports the demo merchant session.

- [ ] **Step 3: Replace demo imports page-by-page**

Every admin page gets its store ID from `useMerchant().activeStore`. Render an owner-store loading state while membership loads and an onboarding redirect/empty state when no store exists. Delete `resetDemo` from `ShopContext` and remove the reset control from settings. Keep client-side cart state only for public shopping sessions.

- [ ] **Step 4: Run affected frontend tests**

Run: `cd jellyshops && npm test -- --run src/app/admin/payments/page.test.tsx src/app/admin/orders/page.test.tsx src/app/admin/orders/[id]/page.test.tsx src/app/admin/online-store`

Expected: PASS.

- [ ] **Step 5: Commit demo-session removal from admin**

```bash
git add jellyshops/src
git rm jellyshops/src/features/store-editor/api/demo-session.ts jellyshops/src/features/commerce/merchant-session.ts
git commit -m "feat: remove demo sessions from admin"
```

### Task 8: Remove starter-store behavior and verify public multi-store isolation

**Files:**
- Create: `backend/sql/migrations/20260918010000_remove_demo_store_data.sql`
- Modify: `backend/scripts/seed-starter-catalog.ts`
- Modify: `backend/src/app.ts`
- Modify: `jellyshops/src/app/page.tsx`
- Modify: `jellyshops/src/app/[storeSlug]/page.tsx`
- Modify: `jellyshops/src/features/commerce/commerce-store-id.ts`
- Modify: `jellyshops/src/lib/seed.ts`
- Modify: `jellyshops/e2e/store-editor.spec.ts`
- Create: `jellyshops/e2e/supabase-owner-stores.spec.ts`

**Interfaces:**
- Consumes: real owner-created stores and their public slugs.
- Produces: no normal application references to Sweet Bakes, Bloom Home, `store-demo`, or `jelly-demo-merchant`.

- [ ] **Step 1: Write failing end-to-end isolation test**

```ts
test("two owners manage separate stores while both public storefronts remain readable", async ({ browser }) => {
  const ownerA = await browser.newContext();
  const ownerB = await browser.newContext();
  await ownerA.newPage().goto("/admin");
  await ownerB.newPage().goto("/admin");
  // Complete the existing email/password helpers, create one store per owner,
  // then assert owner A receives 403 for owner B's private API route.
});
```

- [ ] **Step 2: Run the end-to-end test and verify failure**

Run: `cd jellyshops && npm run test:e2e -- e2e/supabase-owner-stores.spec.ts`

Expected: FAIL because fixed demo identifiers and local seeds still exist.

- [ ] **Step 3: Remove demo data only after backup confirmation**

The cleanup migration must delete dependent demo rows in foreign-key order and finally delete `StoreMembership` and `Store` rows for only the documented demo IDs. It must not use a broad delete by name, slug prefix, or all stores. Remove starter catalog seeding from normal scripts; retain test fixtures only inside test setup.

Replace public store fallback logic so an unknown slug renders the public not-found state. Public store pages resolve their database store ID from the public store API instead of `commerceStoreId("sweet-bakes")` shortcuts.

- [ ] **Step 4: Run complete verification**

Run:

```bash
cd backend && npm test && npm run typecheck
cd ../jellyshops && npm test && npm run typecheck && npm run build
```

Expected: all suites pass; no normal production source references `jelly-demo-merchant`, `store-demo`, `sweet-bakes`, or `bloom-home`.

- [ ] **Step 5: Commit demo cleanup and E2E coverage**

```bash
git add backend jellyshops
git commit -m "feat: replace demo stores with owner accounts"
```

### Task 9: Apply, verify, and document Supabase Auth deployment configuration

**Files:**
- Modify: `backend/README.md`
- Create: `backend/docs/supabase-auth-deployment.md`
- Modify: `jellyshops/README.md`
- Modify: `backend/.env.example`
- Modify: `jellyshops/.env.example`

**Interfaces:**
- Consumes: Supabase project authentication settings, backend environment, frontend publishable configuration.
- Produces: reproducible local and production setup instructions.

- [ ] **Step 1: Write a deployment checklist test/document assertion**

```ts
it("documents separate browser publishable and backend secret Supabase variables", async () => {
  const text = await readFile("docs/supabase-auth-deployment.md", "utf8");
  expect(text).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  expect(text).toContain("SUPABASE_SECRET_KEY");
  expect(text).not.toContain("NEXT_PUBLIC_SUPABASE_SECRET_KEY");
});
```

- [ ] **Step 2: Run the documentation test and verify failure**

Run: `cd backend && npm test -- --run docs/supabase-auth-deployment.test.ts`

Expected: FAIL because deployment documentation does not exist.

- [ ] **Step 3: Document exact operator steps**

Document enabling email/password provider, configuring confirmation/password-recovery redirect URLs for localhost and production, adding a custom SMTP provider for production, setting CORS origins, adding frontend publishable variables, adding backend secret variables, applying migrations in order, and rotating any leaked Stripe credentials.

- [ ] **Step 4: Run documentation test and final focused smoke checks**

Run: `cd backend && npm test -- --run docs/supabase-auth-deployment.test.ts && npm test -- --run src/auth/supabase-auth-provider.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit deployment documentation**

```bash
git add backend/README.md backend/docs/supabase-auth-deployment.md jellyshops/README.md backend/.env.example jellyshops/.env.example
git commit -m "docs: add Supabase auth deployment guide"
```

## Final Verification Checklist

- [ ] New email/password user can sign up, confirm email when enabled, sign in, sign out, and reset password.
- [ ] A user can create two stores and switch only between those stores.
- [ ] A second user cannot list, read, update, upload media for, connect Stripe to, refund, or publish the first user's store.
- [ ] An unauthenticated visitor cannot access `/admin/**` or protected backend routes.
- [ ] Public storefront/catalog/checkout paths work only for real created store slugs.
- [ ] No normal source file uses demo tokens, fixed store IDs, reset-demo behavior, or starter-store fallbacks.
- [ ] Stripe secrets and Supabase secret keys never appear in browser bundles, logs, tests, or committed files.
