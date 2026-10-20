# Merchant First-Run Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route a new merchant from successful shop creation to the existing V4 starter chooser, then into the editor after starter installation.

**Architecture:** Keep Supabase authentication, `POST /api/stores`, the existing starter installation API, and the editor unchanged. Update the real `/onboarding` route so its existing-store redirect does not race the just-created store refresh; after refresh, navigate to `/admin/online-store`. Preserve the legacy `/admin/onboarding` route as-is.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, React Testing Library, existing Supabase client and Store Editor API.

**Spec:** `docs/superpowers/specs/2026-09-24-merchant-onboarding-design.md`

## Global Constraints

- Keep Supabase signup, login, email confirmation, and admin authentication unchanged.
- Use the existing `POST /api/stores` store-creation contract and V4 starter-install endpoint.
- Do not auto-select or auto-install a starter; merchants retain their choice.
- Do not add a new wizard, post-editor checklist, demo catalog records, publishing step, domain setup, or payments step.
- Do not change the atomicity, authorization, or conflict behavior of starter installation.
- Leave `/admin/onboarding` and its local demo-state behavior untouched.
- Do not create or publish a storefront during account signup or store creation.

## Review Focus

- Store creation succeeds but `refreshMerchant()` updates `stores` before the submit handler navigates; do not let the existing-store effect send this new merchant to `/admin`.
- A returning merchant who opens `/onboarding` with a store must go to `/admin` without creating another store.
- A store-create HTTP failure or network exception must remain visible on `/onboarding` and must not attempt store refresh or navigation.
- Store creation can succeed while merchant refresh fails; explain that the store exists and offer a refresh-only retry instead of resubmitting `POST /api/stores`.
- Signup without an established session must retain the email-confirmation notice and must not enter store setup; a starter-install conflict must remain on the chooser and must not open the editor.

---

### Task 1: Pin the onboarding and signup navigation contract with failing tests

**Files:**
- Create: `jellyshops/src/app/onboarding/page.test.tsx`
- Create: `jellyshops/src/components/auth-form.test.tsx`
- Read: `jellyshops/src/app/onboarding/page.tsx`
- Read: `jellyshops/src/components/auth-form.tsx`
- Read: `jellyshops/src/app/admin/online-store/page.test.tsx`

**Interfaces:**
- The onboarding page consumes `useAuth()` fields `configured`, `loading`, `session`, `stores`, and `refreshMerchant()`; it calls `authApiOrigin()` for authenticated store creation and `router.replace()` for navigation.
- The signup form consumes the existing exported `supabase.auth.signUp()` contract and routes only when the returned result includes a session.
- The existing Online Store page already tests starter-install success and conflict behavior; reuse that coverage rather than duplicating starter installation logic.

- [ ] **Step 1: Add the storeless happy-path test.** Mock `useAuth`, `authApiOrigin`, `fetch`, and `useRouter`. Submit the store name and slug; record call order from the POST and `refreshMerchant()`; assert the request contains the existing `currency: "INR"` and `country: "IN"` fields, then assert refresh happens before navigation to `/admin/online-store`.

```tsx
const events: string[] = [];
fetchMock.mockImplementation(async () => {
  events.push("create-store");
  return new Response("{}", { status: 201 });
});
refreshMerchant.mockImplementation(async () => { events.push("refresh-merchant"); });

await user.click(screen.getByRole("button", { name: /create my shop/i }));

expect(events).toEqual(["create-store", "refresh-merchant"]);
expect(router.replace).toHaveBeenCalledWith("/admin/online-store");
```

- [ ] **Step 2: Add redirect and failure tests.** With an existing store, assert `/admin` is selected and `fetch` is not called. With a non-OK store-create response and with a thrown fetch error, assert the form remains visible, the message is announced as an alert, and neither refresh nor navigation occurs.
- [ ] **Step 3: Add the refresh-only recovery test.** Make store creation return success and `refreshMerchant()` reject. Assert the page explains that the shop was created but could not be loaded, offers a refresh-only retry, and does not issue another `POST /api/stores` when that retry is clicked.
- [ ] **Step 4: Add the signup confirmation regression test.** Mock `supabase.auth.signUp()` to return `{ data: { session: null }, error: null }`; submit valid signup fields; assert the email-confirmation notice appears and neither router replacement nor store-creation requests occur.
- [ ] **Step 5: Run the new tests and confirm they fail for the current behavior.**

Run from `jellyshops/`:

```powershell
npm test -- src/app/onboarding/page.test.tsx src/components/auth-form.test.tsx
```

Expected: tests fail because successful store creation still routes to `/admin`, the existing-store redirect is not coordinated with creation, and refresh failures have no recovery path. The confirmation regression test should pass unchanged.

### Task 2: Route new merchants safely to the starter chooser

**Files:**
- Modify: `jellyshops/src/app/onboarding/page.tsx`
- Test: `jellyshops/src/app/onboarding/page.test.tsx`

**Interfaces:**
- No API signature changes. The route continues to call `POST ${authApiOrigin()}/api/stores` with the session bearer token and current store payload.
- The page will distinguish an existing store on entry, a newly created store awaiting context refresh, and a created store whose context refresh needs retry.

- [ ] **Step 1: Add a creation-flow guard before merchant refresh.** Once the POST succeeds, mark that this route created the store before calling `refreshMerchant()`. The existing-store effect must route an already-present store to `/admin`, but must not override the new-store path while refresh is in progress.

```tsx
const [storeCreatedHere, setStoreCreatedHere] = useState(false);
const [refreshFailed, setRefreshFailed] = useState(false);

useEffect(() => {
  if (!loading && !session) router.replace("/login?next=/onboarding");
  if (stores.length > 0 && !storeCreatedHere) router.replace("/admin");
}, [loading, router, session, storeCreatedHere, stores.length]);
```

- [ ] **Step 2: Keep the create button pending through store refresh and navigation.** On a successful POST, set `storeCreatedHere` before awaiting `refreshMerchant()`. Navigate to `/admin/online-store` only after refresh resolves. Do not reset the pending state on this success path because navigation is leaving the page.
- [ ] **Step 3: Keep HTTP and network failures recoverable.** Catch rejected fetches, parse the existing API error body when available, show the message inline, and re-enable the create form. Do not call `refreshMerchant()` or navigate after a failed POST.
- [ ] **Step 4: Handle refresh failure without creating a duplicate store.** If POST succeeded but refresh fails, retain `storeCreatedHere`, show the “shop exists but could not be loaded” status, and render a retry button that only calls `refreshMerchant()`; on success it routes to `/admin/online-store`, and on failure it keeps the recovery status visible.
- [ ] **Step 5: Run onboarding tests and confirm the redirect race is covered.**

Run from `jellyshops/`:

```powershell
npm test -- src/app/onboarding/page.test.tsx src/components/auth-form.test.tsx
```

Expected: all new route and signup tests pass; the POST is called once even when merchant refresh initially fails.

### Task 3: Verify existing starter entry and frontend contract

**Files:**
- Read and test: `jellyshops/src/app/admin/online-store/page.test.tsx`
- Read and test: `jellyshops/src/components/admin-auth-gate.tsx`
- Verify: `jellyshops/src/app/onboarding/page.tsx`, `jellyshops/src/components/auth-form.tsx`

**Interfaces:**
- Starter choice continues to call `installStarterPack(storeId, starterPackId)` and route to `/admin/online-store/editor` only after success.
- No changes are made to authentication, backend store creation, the starter installer, or publication.

- [ ] **Step 1: Run focused onboarding, signup, and starter chooser tests.**

Run from `jellyshops/`:

```powershell
npm test -- src/app/onboarding/page.test.tsx src/components/auth-form.test.tsx src/app/admin/online-store/page.test.tsx
```

Expected: onboarding success/error paths pass; signup without a session shows confirmation; the pre-existing chooser tests prove successful starter installation opens the editor and conflicts remain on the chooser.

- [ ] **Step 2: Run frontend TypeScript.**

Run from `jellyshops/`:

```powershell
npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Check whitespace and scope.** Run `git diff --check`; inspect that only `jellyshops/src/app/onboarding/page.tsx` and the two focused test files changed. Confirm `/admin/onboarding`, `AuthForm` runtime behavior, backend APIs, starter installation, publication, and the local environment files are untouched.
- [ ] **Step 4: Commit the implementation.**

```powershell
git add jellyshops/src/app/onboarding/page.tsx jellyshops/src/app/onboarding/page.test.tsx jellyshops/src/components/auth-form.test.tsx
git commit -m "feat: route new merchants to storefront starters"
```
