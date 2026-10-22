# App Composition and Feature-Owned Components

**Date:** 2026-10-22

**Status:** Implemented; validation and review complete

## Goal

Make backend application composition and frontend component ownership easier to
understand without changing application behavior. Deliver the backend split and
frontend moves as separate reviewable changes, building on cleanup commit
`cbe2ad6`.

Success means `backend/src/app.ts` expresses application assembly and registration
order, extracted modules have clear responsibilities, and feature-owned frontend
components live with their existing features. Existing public entry points,
dependency overrides, HTTP contracts, rendering, and interactions remain intact.

## Current structure

`backend/src/app.ts` is about 1,700 lines. It combines dependency types, a
module-scoped database pool, fallback storefront data and workspace operations,
middleware configuration, route-mounting helpers, dependency construction, and
the exported application factory. Most routes already have mounting helpers;
notification, digital-product, settings, customer, and public-context routes also
appear inline inside `createApp`.

The frontend already has `features/admin`, `features/auth`, `features/commerce`,
and `features/storefront`, but many of their components remain at the root of
`src/components`. `components/ui` contains shared UI primitives and
`components/jelly` contains shared storefront primitives.

## Constraints and exclusions

- Preserve `createApp(dependencies: Partial<AppDependencies> = {})` and its Express
  return value. Keep `AppDependencies` importable from `app.ts`.
- Preserve the exported `publicDocumentFromTemplate` helper through an explicit
  compatibility re-export from `app.ts`.
- Preserve all supplied dependency overrides, conditional service construction,
  fallback behavior, database selection, environment reads, and failure messages.
- Preserve the current module-scoped pool lifetime and initialization semantics;
  do not introduce one pool per application or change when configuration loads.
- Preserve route paths, ordering, authentication, permissions, raw webhook
  parsing, JSON limits, request IDs, CORS, rate limits, and error handling.
- Preserve frontend component props, exports, client/server directives, DOM,
  styles, and interactions. Changes to feature logic or styling are excluded.
- Keep shared-package sources, dependency manifests, lockfiles, and packed
  archives unchanged. Leave `sectionNodeSchema` and other prior cleanups alone.
- Do not introduce a dependency injection framework, universal route registry,
  repository abstraction, new feature API, or new barrel-export system.
- Do not relocate existing components already inside feature directories merely
  to normalize every directory in this pass.

## Backend design

Use `backend/src/app/` for composition-specific modules. Feature routers and
services remain in their current domain directories. Imports flow from `app.ts`
into composition modules and from composition modules into domain modules; no
extracted module imports runtime values from `app.ts`.

| Module | Responsibility |
| --- | --- |
| `app.ts` | Public entry point; create Express app, resolve dependencies, configure middleware, mount webhooks, install JSON parser, mount normal routes, install final handlers, return app. |
| `app/types.ts` | Existing `AppDependencies` contract and any small composition-only context types needed by extracted functions. Use type-only imports for contracts. |
| `app/database.ts` | The existing optional module-scoped pool and its existing environment condition. All composition consumers share this instance. |
| `app/default-storefront-workspace.ts` | Fallback home template, template-to-document helpers, and the existing default workspace API, including its SQL-backed branches. |
| `app/dependencies.ts` | Existing dependency-construction sequence, default auth/media factories, and resolved values needed for mounting. Receives caller overrides; does not configure or mount Express routes. |
| `app/middleware.ts` | Request ID declaration/setup, trust proxy, powered-by setting, and CORS. Does not install JSON parsing. |
| `app/routes/commerce.ts` | Existing Stripe webhook, checkout, order, notification, digital-product, and worker route mounting. Expose webhook mounting separately from normal API mounting. |
| `app/routes/merchant.ts` | Existing tenant, admin, catalog, content/custom-data, store-settings, and customer/engagement mounting helpers. Retain their distinct calls so their current relative order remains visible. |
| `app/routes/storefront.ts` | Existing storefront/context mounting, including legacy, starter, workspace, compiler, and publication order and unavailable-service responses. |
| `app/routes/media.ts` | Existing authenticated and public media mounting. |
| `app/routes/internal.ts` | Existing health and reservation-sweeper mounting. |

The dependency builder returns an explicitly typed composition context containing
the resolved config, auth provider, services, and existing enriched dependency
bag. Its type must reflect optional service availability rather than forcing
services present through casts. Keep the distinction between caller overrides
and resolved values wherever the existing code makes that distinction. Do not
correct or simplify override precedence as part of extraction.

Move the fallback workspace implementation without rewriting its SQL or fallback
data. Preserve shared mutable state and function invocation timing. Keep domain
helpers private except where another extracted module or the existing public
entry point needs them.

### Registration sequence

Keep this current sequence explicit in `createApp`:

1. Base middleware.
2. Stripe raw-body webhooks.
3. `express.json({ limit: "2mb" })`.
4. Order notifications, digital-product routes, workers, and public order balance.
5. Store settings and customer/engagement routes.
6. Internal routes and health.
7. Tenant routes.
8. Commerce routes.
9. Admin routes.
10. Catalog routes.
11. Public storefront context.
12. Content/custom-data routes.
13. Storefront routes, retaining the order within the existing helper.
14. Media routes.
15. Not-found handler, then error handler.

Keep the existing functions entry-point behavior and test import paths intact.
Avoid brittle assertions about Express private router internals; verify ordering
through externally observable request behavior.

## Frontend design

Move the following files from `jellyshops/src/components` into the existing
feature directories. Tests move beside their subjects and retain their current
assertions. Preserve filenames to keep the diff focused on ownership.

| Destination relative to `jellyshops/src` | Components |
| --- | --- |
| `features/auth/components/` | `admin-auth-gate.tsx`, `auth-form.tsx`, and their tests. |
| `features/commerce/components/` | `product-form.tsx`, `product-category-picker.tsx`, `category-recommendations.tsx`, `digital-product-settings.tsx`, `order-status.tsx`, and `order-status.test.tsx`. |
| `features/storefront/components/` | `storefront-frame.tsx`, `storefront-shell.tsx`, `storefront-pages.tsx`, `cart-panel.tsx`, and their existing tests. |

Update imports throughout source and tests, including literal paths in
`vi.mock`, relative imports inside relocated files, and any configuration or
source checks referencing moved paths. Use direct imports from each destination;
do not leave compatibility forwarding files for these internal frontend paths.
Do not modify `features/auth/auth-provider.tsx` or its existing `MerchantStore`
compatibility export as incidental cleanup.

Keep `components/ui` and `components/jelly` in place. Their consumers span feature
boundaries, so they remain shared primitives. Cross-feature imports may remain
where required by existing behavior; this pass must not create new runtime
cycles to enforce cosmetic ownership rules.

### Deferred admin shell moves

The intended eventual location for `admin-nav.tsx`, `app-shell.tsx`, and
`admin-theme-toggle.tsx` is `features/admin/components/`. Defer all three moves in
this pass: the first two have active uncommitted edits, and moving the theme
toggle would require changing an import inside the active shell. This is an
explicit completion boundary for the approved refactor, not an unfinished
implementation step.

## Protecting existing work

At design time, these eight files already contain uncommitted admin-UI edits:

- `jellyshops/src/app/admin/customers/[id]/page.tsx`
- `jellyshops/src/app/admin/customers/page.tsx`
- `jellyshops/src/app/admin/products/[id]/page.tsx`
- `jellyshops/src/app/admin/products/page.tsx`
- `jellyshops/src/app/globals.css`
- `jellyshops/src/app/shadcn-theme.css`
- `jellyshops/src/components/admin-nav.tsx`
- `jellyshops/src/components/app-shell.tsx`

Do not stash, reset, overwrite, or include those edits in refactor commits.
Capture their current diffs before implementation. Some dirty pages import
components being moved; apply only necessary import-path substitutions on top
of their current contents. If committing frontend work, stage only attributable
import hunks in those files. Leave their original edits uncommitted. Verify the
remaining diffs against the captured baseline with only the intentional import
substitutions accounted for.

An untracked `bash.exe.stackdump` also exists. Leave it untouched and unstaged.
Recheck the working tree before each stage in case another developer has added
changes since this spec was written.

## Documentation and validation

Regenerate machine-derived docs with `node scripts/generate-docs.mjs` after the
final source layout is established. Update the generator's directory descriptions
only where needed to describe the new composition/component ownership. Review
generated API documentation for lost routes: extraction must not silently remove
route descriptions merely because the generator previously relied on app.ts.

For the backend change, run backend typecheck and the full backend test suite.
Use the existing application, webhook, storefront, and functions tests to verify
public behavior and initialization. Add focused regression coverage only for
material behavior not already exercised, particularly raw-body webhook parsing,
fallback routes, and dependency override behavior. Do not add tests that merely
mirror the new file organization.

For the frontend change, run frontend typecheck, the full frontend test suite,
and the production build. Inspect Next.js's locally installed relevant guidance
as required by `jellyshops/AGENTS.md` before editing frontend files. Check for
stale imports and mocks targeting removed frontend paths, and inspect client/
server boundaries for moved files.

Run `git diff --check` and review each change's attributed diff. Compare the
public route list and existing public entry points with the baseline. Report
actual test counts and results rather than assuming the handoff's counts still
apply. Playwright is not a completion gate for this behavior-preserving pass;
state explicitly whether it was run.

Run `node scripts/prepare-shared-packages.mjs --check` for shared-package drift,
but first record hashes of the three tracked backend shared-package archives and
the lockfile: the check builds and repacks archives before comparing them. If it
fails, capture the actual error and determine whether it predates this refactor.
Do not refresh lockfiles or accept changed archives to make the check pass.
Restore only archive changes attributable to this check using the recorded
baseline if necessary; preserve any pre-existing archive changes. Report a
pre-existing failure separately from refactor validation.

## Acceptance criteria

- `app.ts` visibly expresses the existing registration sequence, while dependency
  construction and fallback workspace behavior live in focused modules.
- Existing backend imports of `createApp`, `AppDependencies`, and
  `publicDocumentFromTemplate` continue to work without consumer migration.
- Every listed frontend move is complete with its imports and mocks updated;
  shared primitives and the explicitly deferred admin shell group remain in place.
- No public behavior, dependency configuration, package archive, or lockfile
  changes are introduced.
- Required typechecks, test suites, and frontend build pass, or a demonstrated
  pre-existing/environmental blocker is reported with its actual error.
- Generated docs reflect the new structure and retain route coverage.
- Existing admin-UI changes and unrelated untracked files remain preserved and
  excluded from refactor commits.

## Next checkpoint

Review and approve this written spec before implementation planning. The next
artifact is a written implementation plan separating backend extraction from
frontend moves, with validation after each change. Implementation starts after
that plan is reviewed and its execution method is selected.
