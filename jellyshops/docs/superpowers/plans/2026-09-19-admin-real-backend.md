# Admin real-backend integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every admin dependency on the browser-local demo repository with authenticated, store-scoped backend data and mutations.

**Architecture:** Express gains store-scoped dashboard, customer, and settings APIs backed by the existing Postgres tenant and commerce data. The Next.js admin uses one typed authenticated API client plus a reusable query hook; pages consume that layer and show loading, error, and empty states rather than synthetic data.

**Tech Stack:** Next.js/React/TypeScript/Vitest; Express/Zod/PostgreSQL/Vitest; Supabase bearer-token auth.

**Spec:** `jellyshops/docs/superpowers/specs/2026-09-19-admin-real-backend-design.md`

## Global Constraints

- Admin operational data must never read from, write to, or fall back to `ShopRepository`.
- Every merchant request must use the Supabase access token and the active merchant store ID.
- Every new backend query must constrain data by the authorized `storeId`.
- Preserve existing catalog, order, Stripe Connect, content, custom-data, media, and storefront API contracts unless adding a typed client wrapper.
- A failed or unavailable API must render a recoverable UI state, not fabricated business data.

## Review Focus

- A signed-in user attempting another store ID receives a 403/404 and never another store's metrics, customers, or settings; covered in Tasks 2 and 3.
- A store with no paid orders yields zero revenue and empty queues rather than null/NaN values; covered in Task 2.
- A customer email/name missing from an order snapshot has a stable, usable representation; covered in Task 3.
- Expired auth results in the existing sign-in path rather than a permanent blank dashboard; covered in Task 5.
- A save followed by a refresh shows server-authoritative settings, not an optimistic local-only value; covered in Tasks 4 and 7.

---

## File structure

- `backend/src/admin/service.ts` — dashboard and customer read projections from commerce tables.
- `backend/src/admin/routes.ts` — merchant-protected HTTP routes for dashboard and customers.
- `backend/src/admin/*.test.ts` — service and route behavior, including store isolation.
- `backend/src/tenants/types.ts`, `repository.ts`, `postgres-repository.ts`, `routes.ts` — typed store settings read/update contract.
- `jellyshops/src/features/admin/api.ts` — sole authenticated browser client for admin resources.
- `jellyshops/src/features/admin/use-admin-query.ts` — abort-safe loading/error/retry query hook.
- `jellyshops/src/features/admin/api.test.ts`, `use-admin-query.test.tsx` — client and UI data-state tests.
- `jellyshops/src/app/admin/**/page.tsx` — page migrations away from `useShop` and one-off clients.

### Task 1: Define and test admin projection types

**Files:**
- Create: `backend/src/admin/types.ts`
- Create: `backend/src/admin/service.test.ts`
- Create: `backend/src/admin/service.ts`

**Interfaces:**
- Produces `AdminSummaryService.getSummary(storeId)` and `CustomerService.list(storeId)`, `CustomerService.get(storeId, customerId)` for route wiring.
- Uses `CommerceRepository.transaction` and `CommerceTransaction.query` only; all methods accept an explicit `storeId`.

- [ ] **Step 1: Write failing service tests for empty and populated projections**

```ts
it("returns zero revenue and empty queues for a store without orders", async () => {
  const service = new AdminSummaryService(repository);
  await expect(service.getSummary("store-empty")).resolves.toMatchObject({
    revenueMinor: 0, orderCount: 0, actionableOrders: [], lowStock: [],
  });
});

it("groups customer projections by normalized snapshot email", async () => {
  await expect(customers.list("store-a")).resolves.toEqual([
    expect.objectContaining({ email: "buyer@example.com", orderCount: 2 }),
  ]);
});
```

- [ ] **Step 2: Run the focused test file and verify it fails**

Run: `npm test -- --run src/admin/service.test.ts` from `backend`

Expected: FAIL because the admin service module does not exist.

- [ ] **Step 3: Implement typed read models and minimal SQL projections**

```ts
export interface AdminSummary {
  revenueMinor: number;
  orderCount: number;
  publishedProductCount: number;
  actionableOrders: MerchantOrderListItem[];
  lowStock: Array<{ productId: string; variantId: string; title: string; sku: string | null; quantity: number }>;
}

export class AdminSummaryService {
  constructor(private readonly repository: CommerceRepository) {}
  async getSummary(storeId: string): Promise<AdminSummary> {
    return this.repository.transaction(async (tx) => ({
      revenueMinor: await sumPaidOrderRevenue(tx, storeId),
      orderCount: await countOrders(tx, storeId),
      publishedProductCount: await countActiveProducts(tx, storeId),
      actionableOrders: await loadActionableOrders(tx, storeId),
      lowStock: await loadLowStock(tx, storeId),
    }));
  }
}
```

Use `COALESCE(SUM(...), 0)`, include only paid/non-cancelled orders in revenue, query `InventoryLevel` joined to `ProductVariant`/`Product`, and return deterministic newest-first orders.

- [ ] **Step 4: Implement customer list/detail projections**

```ts
export interface MerchantCustomer {
  id: string;
  name: string;
  email: string | null;
  orderCount: number;
  lifetimeSpendMinor: number;
  latestOrderAt: Date | null;
}

export class CustomerService {
  async list(storeId: string): Promise<MerchantCustomer[]> {
    return this.repository.transaction((tx) => loadCustomers(tx, storeId));
  }
  async get(storeId: string, customerId: string): Promise<MerchantCustomerDetail> {
    const customer = await this.repository.transaction((tx) => loadCustomer(tx, storeId, customerId));
    if (!customer) throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    return customer;
  }
}
```

Derive the stable customer ID from the persisted snapshot identity; use a documented fallback key for missing email and preserve the latest name.

- [ ] **Step 5: Run the service tests and typecheck**

Run: `npm test -- --run src/admin/service.test.ts && npm run typecheck` from `backend`

Expected: PASS.

- [ ] **Step 6: Commit the completed task**

```bash
git add backend/src/admin
git commit -m "feat: add admin dashboard and customer projections"
```

### Task 2: Expose authenticated dashboard and customer routes

**Files:**
- Create: `backend/src/admin/routes.ts`
- Create: `backend/src/admin/routes.test.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- Consumes `AdminSummaryService` and `CustomerService` from Task 1.
- Produces `GET /api/stores/:storeId/admin-summary`, `GET /api/stores/:storeId/customers`, and `GET /api/stores/:storeId/customers/:customerId`.

- [ ] **Step 1: Write failing route tests for authorization and response shapes**

```ts
it("rejects a summary request for a store outside the merchant context", async () => {
  await request(app).get("/api/stores/store-b/admin-summary")
    .set("Authorization", merchantAToken).expect(403);
});

it("returns the requested store customer detail and order history", async () => {
  const response = await request(app).get("/api/stores/store-a/customers/customer-a")
    .set("Authorization", merchantAToken).expect(200);
  expect(response.body.customer.id).toBe("customer-a");
});
```

- [ ] **Step 2: Run route tests and verify they fail**

Run: `npm test -- --run src/admin/routes.test.ts` from `backend`

Expected: FAIL with 404 because the router is not mounted.

- [ ] **Step 3: Implement the router with existing merchant middleware**

```ts
router.use(requireMerchant(auth));
router.get("/admin-summary", requireStorePermission("payments:view"), async (req, res, next) => {
  try { res.json(await summary.getSummary(req.storeContext!.storeId)); }
  catch (error) { next(error); }
});
```

Use `requireStorePermission("payments:view")` for order-derived reads and return `{ customers }` / `{ customer }` envelopes for customer resources.

- [ ] **Step 4: Mount the router only when commerce dependencies are available**

```ts
app.use("/api/stores/:storeId", createAdminRouter({ summary, customers }, authProvider));
```

Construct the services from the same `CommerceRepository` used by merchant orders so local configuration remains explicit when commerce is unavailable.

- [ ] **Step 5: Run route tests and the backend suite**

Run: `npm test -- --run src/admin/routes.test.ts && npm test`

Expected: PASS.

- [ ] **Step 6: Commit the completed task**

```bash
git add backend/src/admin backend/src/app.ts
git commit -m "feat: expose merchant dashboard and customers"
```

### Task 3: Add authoritative store settings read/update

**Files:**
- Modify: `backend/src/tenants/types.ts`
- Modify: `backend/src/tenants/repository.ts`
- Modify: `backend/src/tenants/postgres-repository.ts`
- Modify: `backend/src/tenants/routes.ts`
- Modify: `backend/src/tenants/routes.test.ts`
- Create: `backend/src/tenants/postgres-repository.test.ts` if absent in the active branch

**Interfaces:**
- Produces `TenantRepository.getStoreSettings(userId, storeId)` and `updateStoreSettings(userId, storeId, input)`.
- Produces `GET` and `PATCH /api/stores/:storeId/settings` with `{ store }` envelopes.

- [ ] **Step 1: Write failing tenant tests for ownership, validation, and persistence**

```ts
it("updates only settings owned by the authenticated merchant", async () => {
  await request(app).patch("/api/stores/store-b/settings").set(authA)
    .send({ name: "Not mine" }).expect(403);
});

it("rejects invalid public slugs", async () => {
  await request(app).patch("/api/stores/store-a/settings").set(authA)
    .send({ slug: "Invalid slug" }).expect(400);
});
```

- [ ] **Step 2: Run tenant tests and verify they fail**

Run: `npm test -- --run src/tenants/routes.test.ts` from `backend`

Expected: FAIL because settings routes and repository methods are absent.

- [ ] **Step 3: Extend store types and repository methods**

```ts
export interface StoreSettings extends StoreSummary {
  tagline: string | null;
  description: string | null;
  bannerUrl: string | null;
  published: boolean;
  theme: { accent: string | null; background: string | null; displayFont: "serif" | "rounded" | null };
}
export interface UpdateStoreSettingsInput {
  name?: string; slug?: string; tagline?: string | null; description?: string | null;
  bannerUrl?: string | null; published?: boolean; accent?: string | null;
  background?: string | null; displayFont?: "serif" | "rounded" | null;
}
```

Use parameterized `SELECT`/`UPDATE` statements restricted by both `storeId` and `owner_user_id`; update `updatedAt`; return the selected canonical row after a mutation.

- [ ] **Step 4: Add authenticated Zod-validated settings routes**

```ts
router.patch("/stores/:storeId/settings", merchant, async (request, response) => {
  const store = await tenants.updateStoreSettings(merchantId(request.merchant?.userId), request.params.storeId, updateStoreSettingsSchema.parse(request.body));
  response.json({ store });
});
```

Return 404 for a nonexistent owned store and do not return a distinguishable record for a store owned by someone else.

- [ ] **Step 5: Run tenant tests, repository tests, and typecheck**

Run: `npm test -- --run src/tenants && npm run typecheck` from `backend`

Expected: PASS.

- [ ] **Step 6: Commit the completed task**

```bash
git add backend/src/tenants
git commit -m "feat: add merchant store settings API"
```

### Task 4: Build the single frontend admin API boundary

**Files:**
- Create: `jellyshops/src/features/admin/api.ts`
- Create: `jellyshops/src/features/admin/api.test.ts`
- Create: `jellyshops/src/features/admin/use-admin-query.ts`
- Create: `jellyshops/src/features/admin/use-admin-query.test.tsx`

**Interfaces:**
- Consumes `useAuth().session.access_token`, `useAuth().activeStore`, and existing feature API types.
- Produces `createAdminApi({ baseUrl, token })`, `useAdminQuery(key, loader)`, and typed methods for all admin routes.

- [ ] **Step 1: Write failing client and hook tests**

```tsx
it("sends the bearer token and returns a typed settings response", async () => {
  const api = createAdminApi({ baseUrl: "https://api.test", token: "token", fetch });
  await api.getSettings("store-a");
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/stores/store-a/settings"), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
});

it("exposes retryable error state without stale synthetic data", async () => {
  renderHook(() => useAdminQuery("summary", failingLoader));
  await waitFor(() => expect(result.current.error?.message).toBe("Network unavailable"));
  expect(result.current.data).toBeUndefined();
});
```

- [ ] **Step 2: Run focused frontend tests and verify failure**

Run: `npm test -- --run src/features/admin` from `jellyshops`

Expected: FAIL because the feature directory is absent.

- [ ] **Step 3: Implement the typed request client**

```ts
export function createAdminApi({ baseUrl, token, fetch: fetcher = fetch }: AdminApiOptions) {
  return {
    getSummary: (storeId: string) => request<AdminSummary>(`/api/stores/${encodeURIComponent(storeId)}/admin-summary`),
    listCustomers: (storeId: string) => request<{ customers: MerchantCustomer[] }>(`/api/stores/${encodeURIComponent(storeId)}/customers`),
    getSettings: (storeId: string) => request<{ store: StoreSettings }>(`/api/stores/${encodeURIComponent(storeId)}/settings`),
    updateSettings: (storeId: string, input: UpdateStoreSettingsInput) => request<{ store: StoreSettings }>(`/api/stores/${encodeURIComponent(storeId)}/settings`, { method: "PATCH", body: JSON.stringify(input) }),
  };
}
```

Make `request` parse `{ error: { message } }`, attach JSON headers and authorization, and throw a structured `AdminApiError` containing HTTP status.

- [ ] **Step 4: Implement the abort-safe query hook**

```ts
export function useAdminQuery<T>(key: string | null, loader: (signal: AbortSignal) => Promise<T>) {
  // reset data when key is null; cancel stale requests; return { data, loading, error, retry }
}
```

Ensure a store switch cannot commit an earlier store response into the current screen.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- --run src/features/admin && npm run typecheck` from `jellyshops`

Expected: PASS.

- [ ] **Step 6: Commit the completed task**

```bash
git add jellyshops/src/features/admin
git commit -m "feat: add typed admin data client"
```

### Task 5: Migrate dashboard, customers, and store settings screens

**Files:**
- Modify: `jellyshops/src/app/admin/page.tsx`
- Modify: `jellyshops/src/app/admin/customers/page.tsx`
- Modify: `jellyshops/src/app/admin/customers/[id]/page.tsx`
- Modify: `jellyshops/src/app/admin/store/page.tsx`
- Modify: `jellyshops/src/app/admin/settings/page.tsx`
- Create: `jellyshops/src/app/admin/page.test.tsx`
- Create: `jellyshops/src/app/admin/customers/page.test.tsx`
- Create: `jellyshops/src/app/admin/store/page.test.tsx`

**Interfaces:**
- Consumes `createAdminApi`, `useAdminQuery`, and active auth store from Task 4.
- Removes the admin pages' `useShop` imports and `repository.*` access.

- [ ] **Step 1: Write failing screen tests for each data state**

```tsx
it("renders dashboard revenue and actionable orders returned by the API", async () => {
  mockSummary({ revenueMinor: 12500, actionableOrders: [order] });
  render(<DashboardPage />);
  expect(await screen.findByText("₹125.00")).toBeVisible();
  expect(screen.getByText(order.number)).toBeVisible();
});

it("saves settings and renders the server response after the mutation", async () => {
  render(<StorePage />); await userEvent.type(screen.getByLabelText("Tagline"), "Fresh copy");
  await userEvent.click(screen.getByRole("button", { name: "Save storefront" }));
  expect(await screen.findByText("Storefront updated")).toBeVisible();
});
```

- [ ] **Step 2: Run the screen tests and verify failure**

Run: `npm test -- --run src/app/admin/page.test.tsx src/app/admin/customers/page.test.tsx src/app/admin/store/page.test.tsx` from `jellyshops`

Expected: FAIL while the pages use `ShopProvider` data.

- [ ] **Step 3: Migrate the dashboard and customer screens**

```tsx
const { session, activeStore } = useAuth();
const api = useMemo(() => session && activeStore ? createAdminApi({ baseUrl: authApiOrigin(), token: session.access_token }) : null, [session, activeStore]);
const summary = useAdminQuery(activeStore && api ? `summary:${activeStore.id}` : null, (signal) => api!.getSummary(activeStore!.id, signal));
```

Render a loading panel while `loading`, a retry panel for `error`, the existing empty states for empty API arrays, and response data only after success.

- [ ] **Step 4: Migrate store/settings mutation screens**

Use `getSettings` for default values only after data loads; submit `updateSettings`; replace form state with the returned store; invalidate/refetch settings and summary after success.

- [ ] **Step 5: Run tests and eliminate local demo imports from these routes**

Run: `npm test -- --run src/app/admin/page.test.tsx src/app/admin/customers src/app/admin/store/page.test.tsx && rg -n 'useShop|repository\.' jellyshops/src/app/admin/page.tsx jellyshops/src/app/admin/customers jellyshops/src/app/admin/store/page.tsx jellyshops/src/app/admin/settings/page.tsx`

Expected: tests PASS; `rg` returns no matches.

- [ ] **Step 6: Commit the completed task**

```bash
git add jellyshops/src/app/admin/page.tsx jellyshops/src/app/admin/customers jellyshops/src/app/admin/store/page.tsx jellyshops/src/app/admin/settings/page.tsx jellyshops/src/app/admin/page.test.tsx
git commit -m "feat: load dashboard customers and settings from API"
```

### Task 6: Consolidate orders, products, payments, content, and storefront pages behind authenticated APIs

**Files:**
- Modify: `jellyshops/src/app/admin/orders/page.tsx`
- Modify: `jellyshops/src/app/admin/orders/[id]/page.tsx`
- Modify: `jellyshops/src/app/admin/products/page.tsx`
- Modify: `jellyshops/src/app/admin/products/[id]/page.tsx`
- Modify: `jellyshops/src/app/admin/products/new/page.tsx`
- Modify: `jellyshops/src/app/admin/payments/page.tsx`
- Modify: `jellyshops/src/app/admin/content/blogs/page.tsx`
- Modify: `jellyshops/src/app/admin/content/pages/page.tsx`
- Modify: `jellyshops/src/app/admin/content/metaobjects/page.tsx`
- Modify: `jellyshops/src/app/admin/settings/custom-data/page.tsx`
- Modify: `jellyshops/src/app/admin/online-store/page.tsx`
- Modify: `jellyshops/src/app/admin/online-store/editor/page.tsx`
- Modify: `jellyshops/src/app/admin/online-store/navigation/page.tsx`
- Modify: relevant existing `*.test.tsx` files under those directories

**Interfaces:**
- Consumes the active session/store from `useAuth` and either the Task 4 wrapper or existing typed feature clients with the same token.
- Produces pages with consistent loading/error/retry behavior and no `ShopRepository` references.

- [ ] **Step 1: Add failing tests for error and store-switch behavior to each existing live-data page family**

```tsx
it("does not display orders from the previous active store after a store switch", async () => {
  render(<OrdersPage />); switchActiveStore("store-b");
  await expect(screen.findByText("B-1001")).resolves.toBeVisible();
  expect(screen.queryByText("A-1001")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run relevant tests and verify failing assertions**

Run: `npm test -- --run src/app/admin/orders src/app/admin/products src/app/admin/payments src/app/admin/content src/app/admin/online-store` from `jellyshops`

Expected: FAIL for missing shared data-state behavior or stale state handling.

- [ ] **Step 3: Refactor each page family to a common authenticated loading contract**

Replace page-local unguarded effects with the Task 4 query hook or a thin adapter. Keep existing create/update/publish actions, but refresh the resource from the API after success. Do not replace a failed network response with the demo catalog, local order list, or local store object.

- [ ] **Step 4: Remove residual admin demo repository dependencies**

Run: `rg -n 'useShop|repository\.|createRepository|memoryStorage|localStorage' jellyshops/src/app/admin`

Expected before changes: matches in remaining routes. Expected after changes: no operational data references; presentation-only browser state is allowed.

- [ ] **Step 5: Run focused page suites and typecheck**

Run: `npm test -- --run src/app/admin/orders src/app/admin/products src/app/admin/payments src/app/admin/content src/app/admin/online-store && npm run typecheck` from `jellyshops`

Expected: PASS.

- [ ] **Step 6: Commit the completed task**

```bash
git add jellyshops/src/app/admin jellyshops/src/features
git commit -m "refactor: use authenticated APIs across admin pages"
```

### Task 7: Verify end-to-end admin data integrity and remove obsolete admin provider usage

**Files:**
- Modify: `jellyshops/src/app/admin/layout.tsx`
- Modify: `jellyshops/src/components/app-shell.tsx`
- Modify: `jellyshops/src/contexts/shop-context.tsx` only if it is no longer mounted for non-admin storefront needs
- Modify: existing Playwright specs or create `jellyshops/e2e/admin-real-data.spec.ts`

**Interfaces:**
- Consumes all routes and frontend API behavior from Tasks 1-6.
- Produces an admin tree that is authenticated and independent from `ShopProvider`.

- [ ] **Step 1: Write a failing browser-level merchant flow**

```ts
test("merchant dashboard, customer list, and settings are sourced from its authenticated store", async ({ page }) => {
  await signInAsMerchantA(page);
  await page.goto("/admin");
  await expect(page.getByText("Total sales")).toBeVisible();
  await page.goto("/admin/customers");
  await expect(page.getByText("buyer@example.com")).toBeVisible();
  await page.goto("/admin/store");
  await page.getByLabel("Tagline").fill("Server persisted");
  await page.getByRole("button", { name: "Save storefront" }).click();
  await page.reload();
  await expect(page.getByLabel("Tagline")).toHaveValue("Server persisted");
});
```

- [ ] **Step 2: Run the browser test and verify failure**

Run: `npm run test:e2e -- admin-real-data.spec.ts` from `jellyshops`

Expected: FAIL until all screens and test auth wiring use the new contracts.

- [ ] **Step 3: Remove `ShopProvider` from the admin layout and preserve non-admin consumers**

Mount admin routes under `AuthProvider` and `AdminAuthGate` only. Do not remove `ShopProvider` if public/demo storefront routes still import it; isolate it outside the admin layout instead.

- [ ] **Step 4: Run full verification**

Run: `npm test && npm run typecheck && npm run build` from `backend`, then `npm test && npm run typecheck && npm run build` from `jellyshops`.

Expected: PASS. If the e2e environment requires externally configured Supabase/Stripe, run its deterministic mocked equivalent and document the missing external prerequisite in the test output rather than masking it.

- [ ] **Step 5: Commit the completed task**

```bash
git add jellyshops/src/app/admin/layout.tsx jellyshops/src/components/app-shell.tsx jellyshops/e2e jellyshops/src/contexts/shop-context.tsx
git commit -m "refactor: decouple admin from demo shop state"
```

## Plan self-review

- Spec coverage: Tasks 1-3 implement all new backend sources, Task 4 establishes the typed authenticated boundary, Tasks 5-6 migrate every listed admin domain, and Task 7 verifies authentication, persistence, and removal of demo state.
- Placeholder scan: no deferred implementation markers are used; all task steps name files, interfaces, tests, and commands.
- Type consistency: Task 1 exports the exact services Task 2 consumes; Task 3 returns `StoreSettings`, which Task 4 wraps and Task 5 consumes.
- Review Focus coverage: store isolation is tested in Tasks 2-3, empty revenue in Task 1, incomplete snapshots in Task 1, expired auth in Task 5, and server-authoritative saves in Tasks 3, 5, and 7.
