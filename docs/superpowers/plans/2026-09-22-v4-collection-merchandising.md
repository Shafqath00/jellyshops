# V4 Collection Merchandising Implementation Plan

> For agentic workers: use `superpowers:executing-plans` and execute each unchecked task in order.

**Goal:** make V4 Collection templates render and preview real current-store Collection detail through configurable shared sections.

**Architecture:** a catalog repository provides a scoped Collection detail record. The editor loads it after a lightweight selector choice and builds `CollectionPresentationContext`; public and editor rendering use that shared context. Workspace and publication records retain presentation only.

**Tech Stack:** TypeScript, Express, PostgreSQL/PGlite, React/Next.js, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-09-22-v4-collection-merchandising-design.md`

## Constraints

- Keep Collection list results lightweight; fetch full detail after selection.
- Scope every catalog SQL/API read by current `storeId`.
- Never persist live Collection/Product data, selected Collection, or runtime state to workspace/publication records.
- Do not start other page-type or publication work.
- Write and observe a failing test before each production behavior change.

## Review focus

- Store B Collection must be absent through Store A lookup: Task 2.
- Empty Collection uses its configured empty copy: Task 3.
- Missing image/description is omitted rather than invented: Task 3.
- Editor selection does not mutate templates, assignments, workspace, or publications: Task 4.
- Public and preview contexts carry matching title/products/prices: Task 5.

## Task 1 — Collection registry definitions and context

Files:

- Modify `jellyshops/packages/storefront-registry/src/sections/commerce.ts`.
- Modify `jellyshops/packages/storefront-registry/src/theme-packs.ts`.
- Modify `jellyshops/packages/storefront-registry/src/registry.test.ts`.
- Modify `jellyshops/packages/storefront-renderer/src/types.ts`.

Produce `CollectionPresentationContext` with collection identity/title/description/optional image, `PublicProduct[]`, and `totalProducts`.

- [ ] Add failing registry assertions for Collection-only header controls (`showTitle`, `showDescription`, `showImage`), grid controls (`columns` 2–4, `limit` 1–24, `emptyMessage`), and description spacing.
- [ ] Run `npm exec vitest run packages/storefront-registry/src/registry.test.ts`; confirm existing empty settings fail.
- [ ] Implement Zod schemas, controls, defaults, `collection-description`, and default order header → grid → description.
- [ ] Rerun the registry test; confirm pass.
- [ ] Commit only changed files with `feat: define v4 collection merchandising sections`.

## Task 2 — Current-store Collection detail API

Files:

- Modify `backend/src/catalog/postgres-repository.ts`.
- Modify `backend/src/catalog/routes.ts`.
- Modify `backend/src/catalog/postgres-repository.test.ts`.
- Modify `backend/src/catalog/routes.test.ts`.

The result is `GET /api/stores/:storeId/catalog/collections/:collectionId`, protected by `catalog:view`, returning Collection detail with only same-store Products.

- [ ] Add a PGlite test with Store A/Store B fixture records. Assert Store A Collection contains Store A Product IDs and Store B ID resolves null through Store A.
- [ ] Add route test asserting `service.getCollection(request.storeContext.storeId, collectionId)`.
- [ ] Run `npm exec vitest run src/catalog/postgres-repository.test.ts src/catalog/routes.test.ts`; confirm missing route/detail behavior fails.
- [ ] Query Collection using `WHERE storeId = $1 AND id = $2`; query only Products whose current-store `collectionIds` includes that ID; reuse product mapper; add the permission-protected route.
- [ ] Run `npm exec vitest run src/catalog/postgres-repository.test.ts src/catalog/routes.test.ts src/catalog/service.test.ts`; confirm pass.
- [ ] Commit catalog-only files with `feat: load scoped collection catalog detail`.

## Task 3 — Shared Collection sections

Files:

- Create `jellyshops/packages/storefront-renderer/src/sections/collection-sections.tsx`.
- Modify `jellyshops/packages/storefront-renderer/src/render-registry.tsx`.
- Modify `jellyshops/packages/storefront-renderer/src/registry-renderer.test.tsx`.

- [ ] Add failing renderer tests: header honors all visibility settings, grid honors limit/columns, empty grid displays `emptyMessage`, blank description renders nothing.
- [ ] Run `npm exec vitest run packages/storefront-renderer/src/registry-renderer.test.tsx`; confirm old loose Collection renderer fails expected assertions.
- [ ] Implement header/grid/description from `resource.data.collectionPresentation`; retain only minimal legacy fallback needed by existing tests.
- [ ] Rerun renderer test; confirm pass.
- [ ] Commit renderer-only files with `feat: render v4 collection merchandising sections`.

## Task 4 — Editor-selected Collection detail

Files:

- Modify `jellyshops/src/features/store-editor/api/types.ts`.
- Modify `jellyshops/src/features/store-editor/api/client.ts` and `client.test.ts`.
- Modify `jellyshops/src/features/store-editor/preview-context.ts` and its test.
- Modify `jellyshops/src/app/admin/online-store/editor/page.tsx`.

- [ ] Add a failing client test for authenticated current-store `GET /catalog/collections/:id`.
- [ ] Add a failing preview-context test proving real detail supplies title, description, optional image, live Products, and total count; assert context construction has no mutation callback.
- [ ] Run the two focused tests; confirm methods/context are missing.
- [ ] Implement `StoreEditorApi.getCollection`. Fetch only when Collection template and selected ID are active; clear stale state while loading; accept only matching `detail.storeId`; map live Products to `PublicProduct`.
- [ ] Rerun focused tests and `npm run typecheck`; confirm pass.
- [ ] Commit editor-only files with `feat: preview real v4 collection drafts`.

## Task 5 — Public parity and final verification

Files:

- Modify `jellyshops/src/app/[storeSlug]/collections/[collectionSlug]/page.tsx`.
- Create or modify `jellyshops/src/app/[storeSlug]/collections/[collectionSlug]/page.test.tsx`.

- [ ] Add a failing parity test showing public context matches preview semantics for collection ID/title, Product IDs/prices, and total count.
- [ ] Run the public route test; confirm current route has only legacy loose Collection data.
- [ ] Supply `collectionPresentation` through existing V4 public route resolution using current live Collection/products; do not touch workspace/publication services.
- [ ] Run registry, renderer, editor client/context, and public route tests; then TypeScript, frontend build, and `git diff --check`.
- [ ] Report unrelated baseline failures separately; commit public route files with `feat: compose live v4 collection interactions`.

## Self-review

- Tasks map to the approved spec: controls/context (1), scoped API and isolation (2), rendering/empty values (3), preview runtime-only state (4), public parity and gate (5).
- Task 1 produces the context Task 3–5 consume. Task 2 produces the detail Task 4 consumes.
- Review-focus conditions have explicit owning tests.
