# App Composition and Feature Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution method awaits user selection; native execution is recommended for these two sequential refactor slices.

**Goal:** Split backend application assembly into focused composition modules and move frontend components into their owning features without changing behavior.

**Architecture:** Keep `backend/src/app.ts` as the public composition entry point and preserve its ordered mounting calls. Extract construction and registration into `backend/src/app/`, then move frontend components into existing feature directories with direct imports. Deliver two independently validated changes; preserve the unrelated admin-UI edits throughout.

**Tech Stack:** TypeScript, Express 5, Next.js 16, React, Vitest, Supertest, existing TypeScript-based documentation generator.

**Spec:** `docs/superpowers/specs/2026-10-22-app-composition-and-feature-components-design.md` (approved).

## Global Constraints

- Preserve `createApp(dependencies: Partial<AppDependencies> = {})` and its Express return value. Keep `AppDependencies` importable from `app.ts`.
- Preserve the exported `publicDocumentFromTemplate` helper through an explicit compatibility re-export from `app.ts`.
- Preserve all supplied dependency overrides, conditional service construction, fallback behavior, database selection, environment reads, and failure messages.
- Preserve the current module-scoped pool lifetime and initialization semantics; do not introduce one pool per application or change when configuration loads.
- Preserve route paths, ordering, authentication, permissions, raw webhook parsing, JSON limits, request IDs, CORS, rate limits, and error handling.
- Preserve frontend component props, exports, client/server directives, DOM, styles, and interactions. Changes to feature logic or styling are excluded.
- Keep shared-package sources, dependency manifests, lockfiles, and packed archives unchanged. Leave `sectionNodeSchema` and other prior cleanups alone.
- Do not introduce a dependency injection framework, universal route registry, repository abstraction, new feature API, or new barrel-export system.
- Do not relocate existing components already inside feature directories merely to normalize every directory in this pass.
- Do not stash, reset, overwrite, or include those edits in refactor commits.

All commands below run from the repository root unless a working directory is given. Use the installed Node/npm runtime. Stop on a new failure, capture its actual output, and diagnose before proceeding; do not broaden the refactor to fix unrelated behavior.

## Review Focus

1. JSON webhook bodies must reach the gateway as byte-identical Buffers through `createApp`, not only through standalone router tests; pin in Task 1's composition regression tests.
2. `storefrontSql: null` must suppress automatic storefront SQL composition even when a default pool exists; pin in Task 1 using module-isolated pool mocks.
3. Two app instances must share the one module-scoped pool, and `app.locals.runOrderWorkers` must retain the injected worker; pin in Task 1's pool and worker tests.
4. Moved storefront modules must retain the same context identities and route mocks for cart, product, search, and order pages; exercise in Task 2's relocated and page tests plus production build.
5. Refactoring imports in already-dirty product/customer pages must preserve every unrelated byte and exclude original UI edits from commits; verify against Task 1's baseline before committing Task 2.

## File Structure and Interfaces

### Backend

Create the modules listed below. Keep feature router/service implementations in their existing directories. All extracted composition modules import contracts from `app/types.ts`, never runtime values from `app.ts`.

| File | Interface / responsibility |
| --- | --- |
| `backend/src/app/types.ts` | Move `AppDependencies` unchanged; define `AppContext` below. |
| `backend/src/app/database.ts` | Export `supabasePool` using the exact existing initializer and inferred return type. |
| `backend/src/app/default-storefront-workspace.ts` | Export `defaultStorefrontWorkspaceApi: StorefrontWorkspaceApi` and `publicDocumentFromTemplate(storeId: string, layout: unknown): StorefrontDocument`; move their helpers and fallback data verbatim. |
| `backend/src/app/dependencies.ts` | Export `resolveAppDependencies(dependencies: Partial<AppDependencies> = {}): AppContext`; move existing construction and private auth/media factory logic here. |
| `backend/src/app/middleware.ts` | Export `configureMiddleware(app: Express, config: AppConfig): void`; retain the Express request ID augmentation. |
| `backend/src/app/routes/commerce.ts` | Export `mountStripeWebhooks`, `mountOrderRuntimeRoutes`, and `mountCommerceRoutes`, each `(app: Express, context: AppContext): void`. |
| `backend/src/app/routes/merchant.ts` | Export `mountStoreSettingsRoutes`, `mountCustomerRoutes`, `mountTenantRoutes`, `mountAdminRoutes`, `mountCatalogRoutes`, and `mountContentRoutes`, each `(app: Express, context: AppContext): void`. |
| `backend/src/app/routes/storefront.ts` | Export `mountPublicStorefrontContextRoutes` and `mountStorefrontRoutes`, each `(app: Express, context: AppContext): void`. |
| `backend/src/app/routes/media.ts` | Export `mountMediaRoutes(app: Express, context: AppContext): void`. |
| `backend/src/app/routes/internal.ts` | Export `mountInternalRoutes(app: Express, context: AppContext): void`. |

`AppContext` has these named fields with these types:

```ts
interface AppContext {
  config: AppConfig;
  authProvider: AuthProvider;
  routeDependencies: Partial<AppDependencies>;
  catalogService: CatalogAdmin | undefined;
  storefrontService: DefaultStorefrontService<unknown>;
  publicStorefrontApi: PublicStorefrontApi;
  storefrontStarterApi: StorefrontStarterApi | undefined;
  mediaService: MediaService;
  publicStorefrontContextService: PublicStorefrontContextService | undefined;
  adminServices: { summary: AdminSummaryService; customers: CustomerService } | undefined;
  commerceRepository: CommerceRepository | undefined;
  customerService: StoreCustomerService | undefined;
  verifyCustomer: ReturnType<typeof supabaseCustomerVerifier> | undefined;
}
```

`CustomerService` above is the admin service; `StoreCustomerService` aliases the customers-domain service, matching current app.ts. Use type-only imports, including for the verifier type query. `routeDependencies` is the existing `commerceDeps` object with its current precedence and optional values. The catalog override is still passed separately where necessary. Do not make all dependency fields required to silence type errors.

Modify `backend/src/app.ts` to consume these interfaces and retain its three public exports. Modify `scripts/generate-docs.mjs` to recognize direct Express routes in the composition route modules and describe the new directories. Regenerate only the generator's outputs (currently reference/file maps, API endpoints, and structure reports).

### Frontend

Move these files, including their existing colocated tests:

| Source under `jellyshops/src/components/` | Destination under `jellyshops/src/` |
| --- | --- |
| `admin-auth-gate.tsx`, `admin-auth-gate.test.tsx`, `auth-form.tsx`, `auth-form.test.tsx` | `features/auth/components/` |
| `product-form.tsx`, `product-category-picker.tsx`, `category-recommendations.tsx`, `digital-product-settings.tsx`, `order-status.tsx`, `order-status.test.tsx` | `features/commerce/components/` |
| `storefront-frame.tsx`, `storefront-shell.tsx`, `storefront-shell.test.tsx`, `storefront-pages.tsx`, `cart-panel.tsx`, `cart-panel.test.tsx` | `features/storefront/components/` |

Modify every consumer discovered by exact old-path searches, including login/signup and admin/storefront layouts, product/customer/dashboard pages, storefront client pages, feature files, and `vi.mock` targets. Relative imports between relocated files remain colocated. Existing component names, props, and exports are the produced interfaces, unchanged.

Keep `components/ui`, `components/jelly`, `admin-nav.tsx`, `app-shell.tsx`, and `admin-theme-toggle.tsx` in place. Leave existing feature files and `auth-provider.tsx` untouched unless a relocated-path import requires a substitution; do not alter `MerchantStore`.

## Task 1: Extract Backend Composition and Preserve API Documentation

**Files:** Create the ten backend modules in the file map; modify `backend/src/app.ts`, `scripts/generate-docs.mjs`, and generated docs. Extend `backend/src/app.test.ts` and `backend/src/app.local-v4.test.ts` only for missing behavior coverage; a separate `backend/src/app.composition.test.ts` may hold module-isolated composition regressions.

**Consumes:** Current `createApp`, domain router factories, current dependency classes, and the approved registration sequence.

**Produces:** The signatures in the backend interface table, unchanged public app exports, and complete API documentation after extraction.

- [ ] **1. Capture the execution baseline.** Inspect `git status --short` and applicable instructions. Read the spec, then preserve byte-for-byte copies and diffs of all eight dirty files outside tracked source, plus hashes/copies of all three tracked backend shared-package archives and `backend/package-lock.json`. Record existing untracked files, including `bash.exe.stackdump`. Confirm the index contains no unrelated staged changes before any commit.
- [ ] **2. Establish behavior and documentation baselines.** Run `npm --prefix backend run typecheck` and `npm --prefix backend test`. Record the METHOD/path set in `docs/api/endpoints.md`, ignoring line numbers. Review existing app/local-v4/functions/webhook tests before adding coverage; standalone webhook router tests alone do not verify app middleware order.
- [ ] **3. Pin uncovered composition risks against the existing app.** Reuse current config, temporary-directory, SQL, and gateway fixtures. Add only missing tests with the following names/assertions; these are characterization tests and should pass before extraction, not tests of new file paths:
  - `preserves raw webhook bytes through createApp`: send the literal JSON string `'{ "id": "evt_probe" }'` with `application/json` and a signature to each webhook endpoint; assert the injected gateway verifier receives a Buffer whose UTF-8 value equals that string and the original signature. Let the verifier reject deliberately and assert HTTP 400 with `STRIPE_SIGNATURE_INVALID`, so no receipt SQL is needed.
  - `shares the configured pool across app instances`: use `vi.resetModules` and a mocked `createSupabasePool` before importing `./app.js`; construct two apps, assert the pool factory was called once. Restore mocks/environment in `finally`.
  - `disables default storefront SQL when explicitly null`: extend the configured-pool fixture in `app.local-v4.test.ts`; compare `createApp({ config, storefrontSql: null })` with the existing default-pool compilation fixture. Authenticated POST to storefront `/validate` returns 503 and `STOREFRONT_COMPILER_NOT_CONFIGURED` in the null case; existing default-pool and injected-compiler tests still pass.
  - `exposes injected order workers on app.locals`: supply a fixture `orderRuntime` and assert `app.locals.runOrderWorkers === orderRuntime.runWorkers`.
- [ ] **4. Run the focused baseline.** In `backend`, run `npx vitest run src/app.test.ts src/app.local-v4.test.ts src/app.public-storefront.test.ts src/functions.test.ts` and `src/app.composition.test.ts` if created. Expected: all selected tests pass before extraction. Fix test fixtures rather than changing product behavior when pinning the baseline.
- [ ] **5. Extract contracts, pool, and fallback workspace.** Move declarations/initializers into the named modules with `.js` relative import extensions. Point app.ts consumers at them and re-export public contracts/helpers from app.ts. Preserve the shared fallback object's identity, SQL strings, and module-scoped initialization. Run backend typecheck; expected: exit 0.
- [ ] **6. Extract dependency construction.** Implement `resolveAppDependencies` and `AppContext` exactly as mapped. Preserve construction order, optional services, `storefrontSql === null`, and `commerceDeps` precedence, including current `resolveCheckoutCustomer` behavior. Move the `app.locals.runOrderWorkers` assignment to app.ts immediately after context resolution; dependency construction must not depend on Express app mutation. Keep factory validation errors verbatim. Run the focused baseline again; expected: all pass.
- [ ] **7. Extract middleware and route helpers.** Move existing handlers and guards without rewriting them. Use the `(app, context)` mounting interfaces above. Keep the full numbered registration sequence from the spec explicit in app.ts, including separate webhook mounting before `express.json({ limit: "2mb" })`, notifications/balance before general order routes, and final not-found/error handlers. Preserve the catalog helper's existing global-pool behavior. Run backend typecheck and the focused tests; expected: all pass.
- [ ] **8. Repair and regenerate documentation.** In `scripts/generate-docs.mjs`, use a single predicate identifying app.ts and `backend/src/app/routes/*.ts` as direct composition-route sources; use it both when collecting direct routes and excluding them from unresolved mount reporting. Keep existing domain-router factory resolution. Update descriptive copy referring exclusively to app.ts and add composition-directory descriptions. Run `node scripts/generate-docs.mjs`. Compare METHOD/path sets to step 2: no lost endpoints or accidental duplicates; line numbers and composition file locations may change. Inspect the docs diff for lost guards or newly unresolved mounts.
- [ ] **9. Validate and review the backend change.** Run `npm --prefix backend run typecheck`, then `npm --prefix backend test`, then `git diff --check`. Expected: exit 0, all backend tests pass, no whitespace errors. Check extracted modules for runtime imports from app.ts; none allowed. Review the resulting app.ts registration order and public exports against the spec. Confirm baseline UI files and protected package bytes are unchanged.
- [ ] **10. Commit only the backend slice.** Stage exact new/modified backend paths, generator changes, generated docs, and attributable tests. Inspect `git diff --cached --stat` and `git diff --cached --check`, then commit as `refactor: extract backend application composition`. Verify no admin-UI hunks or unrelated files entered the commit.

## Task 2: Move Feature-Owned Frontend Components

**Files:** Move the sixteen frontend files in the file map; modify their discovered consumers/mocks, directory descriptions in `scripts/generate-docs.mjs` where needed, and generated docs.

**Consumes:** Existing component exports and their props, existing feature folders, and Task 1's protected-work baseline.

**Produces:** Direct imports at the destination paths in the file map; unchanged behavior and component export signatures; the three admin shell files remain deferred.

- [ ] **1. Recheck the workspace and frontend guidance.** Inspect status for concurrent edits and refresh the preservation baseline if needed. Read `jellyshops/AGENTS.md` and the installed Next.js guides for project structure and server/client components under `jellyshops/node_modules/next/dist/docs`. Run `npm --prefix jellyshops run typecheck` and `npm --prefix jellyshops test`; expected: baseline passes or a documented pre-existing failure. Avoid modifying any existing Next.js instruction block.
- [ ] **2. Move auth components and their tests.** Apply only filesystem moves and exact path substitutions. Update admin layout, login, signup, and every other discovered consumer. Run in `jellyshops`: `npx vitest run src/features/auth/components/admin-auth-gate.test.tsx src/features/auth/components/auth-form.test.tsx`; expected: all pass with existing assertions.
- [ ] **3. Move commerce components and order-status tests.** Update product-form imports and all consuming admin pages. On dirty product/customer pages, replace only the old import specifier, preserving all other content. Run in `jellyshops`: `npx vitest run src/features/commerce/components/order-status.test.tsx`; expected: all pass. Compare moved component bodies against their baseline versions, allowing only import-path substitutions.
- [ ] **4. Move storefront components and tests.** Update all consumers, including `features/storefront` code, `[storeSlug]` layout/client pages, and literal mock paths. Preserve relative imports among storefront-shell/pages and the shared jelly/UI import paths. Run in `jellyshops`: `npx vitest run src/features/storefront/components src/features/storefront src/app`; expected: relocated component tests and cart/product/search/order route tests pass with no newly added mocks hiding resolution problems.
- [ ] **5. Check move completeness and import boundaries.** Search all source/tests/configuration for each removed `@/components/<filename>` path and relative variants; expected: no active references. Historical specs may retain old paths. Confirm each of the sixteen old files is gone, each destination exists, and client directives and component bodies match baseline except imports. Confirm the shared primitive folders and deferred admin files are unchanged. Run frontend typecheck; expected: exit 0.
- [ ] **6. Regenerate docs and validate the frontend.** Run `node scripts/generate-docs.mjs`, `npm --prefix jellyshops test`, then `npm --prefix jellyshops run build`; expected: docs reflect ownership, all tests pass, and the production build succeeds. Run `git diff --check`. Record actual results; Playwright is optional and must be reported as run or unrun.
- [ ] **7. Check shared-package drift without accepting artifact changes.** Reconfirm protected archive/lockfile hashes and preserve their immediately pre-check bytes, then run `node scripts/prepare-shared-packages.mjs --check`. Expected: exit 0. The command repacks archives even in check mode; compare post-check bytes. If it fails, retain the full error and compare against a baseline isolated from refactor changes to establish whether it predates this work. Restore only check-caused archive modifications from the captured copies. Do not refresh lockfile integrity or commit rebuilt artifacts to hide a mismatch.
- [ ] **8. Preserve dirty edits while staging the move.** Compare every protected dirty file to the captured baseline, reversing only this refactor's exact import substitutions for the comparison. Expected: byte-identical original UI content. Stage moved files, clean consumers, and generated docs by exact path. For dirty pages, use an index-only patch containing only old-to-new import substitutions against HEAD; never stage the entire dirty page. Inspect staged and unstaged diffs and confirm original UI changes remain unstaged. Avoid blanket `git add`, stash, reset, or checkout operations.
- [ ] **9. Commit and report.** Run `git diff --cached --check` and inspect the staged name/status list (including detected renames), then commit as `refactor: colocate feature-owned frontend components`. Verify status still shows the baseline admin-UI edits and unrelated untracked files. Report both refactor commits, actual checks and counts, any demonstrated pre-existing drift failure, Playwright status, and the explicitly deferred admin-shell moves.

## Self-Review and Execution Handoff

- Backend file responsibilities and interfaces cover the approved module map; existing route order, overrides, global pool, app.locals, public exports, and raw bodies have explicit checks.
- Frontend moves match the approved list; dirty-page import staging and deferred admin files preserve existing work. No feature-folder normalization or primitive moves are included.
- Documentation repairs address the generator's actual app.ts-only direct-route predicate. Archive validation accounts for the check command's mutation behavior.
- Characterization tests protect existing behavior before extraction. Do not create tests whose only assertion is where a function or component lives.
- Review this plan and select native or subagent-driven execution before implementation. Native execution keeps the two sequential slices in one context and is recommended; use `superpowers:executing-plans` if selected. Use `superpowers:subagent-driven-development` only if selected.
