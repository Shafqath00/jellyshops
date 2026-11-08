# V4 launch-ready starter storefronts — implementation plan

> **For an implementing agent:** use the `superpowers:executing-plans` workflow and execute tasks in order. Tests are written before behavior changes. Keep all changes within this milestone and run the listed verification before moving on.

**Goal:** selecting Fresh Market or Artisan Boutique atomically installs a complete editable V4 workspace for that store, and the merchant can customize, preview responsively, validate, and publish using the existing architecture.

**Design reference:** `docs/superpowers/specs/2026-09-23-v4-launch-ready-starters-design.md`.

**Architecture:** normalized immutable V4 starter definitions → one store-scoped starter installer/service and atomic persistence boundary → existing V4 workspace reader/compiler → existing editor/preview/publication. Keep existing V3 theme-pack exports as a compatibility boundary. No starter-specific route or renderer.

## Task 1 — Audit and normalize the two starter definitions

**Files:** `jellyshops/packages/storefront-registry/src/theme-packs.ts`; new `jellyshops/packages/storefront-registry/src/v4-starter-packs.ts`; package exports in `jellyshops/packages/storefront-registry/src/index.ts`; focused starter tests.

1. Add failing tests for `getV4StarterPack`, `listV4StarterPacks`, stable pack-local keys, distinct Fresh Market/Artisan settings and layouts, absence of fake Catalog/content IDs, and exact required page/global coverage.
2. Define the `V4StarterPack` contract from the design spec, using normalized V4 layouts/global `SectionNode`s. Keep legacy V3 factories intact.
3. Give each pack nine templates keyed by each supported page type with `handle: "default"`; make image/product/collection references absent or optional, never fake.
4. Run the registry package focused test command and TypeScript check; confirm legacy V3 theme-pack tests still pass.

**Done when:** starter definitions are data-only, versioned, independent, deterministic, and no longer rely on random IDs at pack-definition time.

## Task 2 — Define and enforce starter completeness

**Files:** registry starter validator and tests; section definitions only if required for registered capabilities.

1. Add failing tests for a missing page/global, duplicate default, invalid region, unsupported section/block/settings, invalid menu target, missing theme, malformed optional resource reference, and valid independent packs.
2. Implement `validateV4StarterPack(input)` using existing registry/schema validators and a stable issue shape with path/code/message.
3. Validate the static Fresh Market and Artisan definitions in tests and make the installer call the same validator before any write.
4. Run focused registry tests and TypeScript.

**Done when:** incomplete packs cannot pass either test or install-time validation.

## Task 3 — Add Not Found to the same V4 template/runtime contract

**Files:** `backend/sql/migrations/` new forward migration; `backend/src/storefront/workspace/repositories/template-repository.ts`; workspace route validation/client template type; `jellyshops/packages/storefront-schema/src/runtime-v4.ts`; compiler/snapshot and route-resolution files discovered in the audit; focused tests.

1. Add failing schema/compiler tests proving `not-found` is accepted, becomes a `templateDefaults.not-found` entry, compiles with `not-found-message`, and unknown public routes resolve to the Not Found default.
2. Add the enum value through a safe forward SQL migration, update backend and frontend template unions, and add `not-found` to the strict V4 snapshot schema.
3. Extend existing route/template selection so unmatched requests use that compiled default through the current shared renderer; do not create a standalone starter-specific route.
4. Run focused compiler, route and runtime tests; apply the migration to PGlite test setup.

**Done when:** Not Found passes through template persistence, compile, snapshot validation, and normal runtime selection.

## Task 4 — Complete shared image-with-text/media editing

**Files:** `jellyshops/packages/storefront-registry/src/sections/content.ts`; `jellyshops/packages/storefront-renderer/src/sections/home-sections.tsx`; `jellyshops/packages/storefront-renderer/src/render-registry.tsx`; editor control/preview/media tests as required.

1. Add failing section tests for image + heading + body + safe CTA, missing image, mobile layout, alt text, and equivalent preview/public rendering.
2. Confirm the exact V4 media-reference shape against media upload API and current persisted section settings; add a registry image control and schema validation for the existing shape.
3. Render the reference safely in the shared `ImageWithTextSection`; render blocks, sanitize/validate CTA URLs with existing URL rules, and give absent media a sensible layout without fabricating an image.
4. Verify the existing store-scoped upload API can write a reference, public rendering can load it, and deletion protection recognizes it. Make only the smallest reusable fix if reference tracking is missing.
5. Run renderer/registry/editor upload tests and TypeScript.

**Done when:** upload/selection produces one persisted media reference that survives compile/publication and is rendered by the same shared renderer.

## Task 5 — Connect Product sections to the real Catalog provider

**Files:** `jellyshops/packages/storefront-renderer/src/sections/product-grid.tsx`; commerce provider adapters; registry section controls; tests.

1. Add failing tests for an empty catalog, live products from the current store, configured product/collection reference, and cross-store isolation.
2. Trace `CommerceDataProvider` from editor preview and public runtime. Ensure starter `product-grid`/featured product uses only this provider, never starter-defined sample Product records.
3. Add/repair the small empty state and ensure real selection stores only an existing same-store resource ID. If a required reference is absent, preserve the existing configuration/empty state without compile failure.
4. Run catalog, renderer, editor preview, and public storefront provider tests.

**Done when:** a real Catalog product appears through the live provider after being added, while an empty catalog is valid.

## Task 6 — Implement atomic V4 starter installation

**Files:** new backend starter installation service/repository; workspace API interface/service/routes; app dependency composition; SQL migration adding nullable starter provenance to `StorefrontWorkspace`; PGlite and service tests.

1. Add failing service/PGlite tests for empty-store first install, all expected records, exactly one generation advance, pack version marker, same-pack retry/no-op, conflicting different pack/custom state, rollback on injected failure, concurrent first requests, and Store B isolation.
2. Define typed install result/conflict errors. Installer validates the pack before opening mutation, serializes by store in a transaction, re-checks state under lock, and creates theme config, nine templates, three global sections, one valid main menu, provenance marker, and one generation increment atomically.
3. Derive unique database row IDs from one generated installation ID plus pack-local keys. Never use pack-global IDs because current SQL primary keys are global across stores.
4. Do not write assignment rows, catalog/content rows, presets, media binaries, fake IDs, or publication records. On matching marker return current result without writes. On any other nonempty state return 409 and leave it unchanged.
5. Add `POST /api/stores/:storeId/storefront/starters/:starterId/install` to existing authenticated workspace routes and wire one installer dependency in app composition. Cover invalid IDs, auth, scope, conflict response and repeated requests.
6. Run focused service/route/PGlite tests, migrations, backend TypeScript and touched backend tests.

**Done when:** one transaction gives a complete isolated V4 draft workspace or no change at all.

## Task 7 — Connect starter selection to install and editor entry

**Files:** `jellyshops/src/features/store-editor/api/client.ts` and types/tests; `jellyshops/src/app/admin/online-store/page.tsx` and tests; editor entry tests.

1. Add failing UI/API tests that selection calls install once, does not call `saveThemeConfiguration`, shows recoverable install conflicts, and enters the editor only after successful install.
2. Add typed `installStarterPack(storeId, packId)` to the client and use it from the current chooser. Keep list/display source compatible with versioned starter metadata.
3. On success route to/open the current editor for the active store and refresh workspace state; do not build starter layouts in the editor.
4. Run chooser, client, editor startup tests and TypeScript.

**Done when:** a new store choosing either starter opens an editor with templates and no “No theme installed” state.

## Task 8 — Finalize complete page layouts and global content

**Files:** V4 starter definitions; registry compatibility only where a required existing section is missing; starter completeness/renderer tests.

1. Add/adjust definition tests for intentional Product and Collection section order, Cart/Search empty states, Page/Blog/Article content sections, Not Found link, announcement/header/footer and both home layouts.
2. Update only normalized starter data to use current registered sections and currently supported settings. Avoid expanding unsupported commerce features or creating data records.
3. Check the editor exposes the primary controls for logo/identity, menu, hero text/image/CTA, theme colors, Product/Collection sections and footer. Fix only blockers to that simple starter-edit flow.
4. Run registry, renderer, editor, page route and snapshot tests.

**Done when:** completeness validation and compiled output show nine default templates and required globals in each starter.

## Task 9 — Verify desktop/mobile draft preview

**Files:** existing editor viewport controls/preview tests; shared CSS and section CSS only if overflow/usability defects are found.

1. Add tests proving the same current draft snapshot renders at desktop and mobile widths and edited values appear without republishing.
2. Use existing desktop/mobile viewport mechanism. Do not create mobile templates or persist viewport choice as storefront state.
3. Inspect both starter designs at 1440, 820, 390 and 320 CSS pixels; fix concrete horizontal overflow or unusable header/hero/gallery/purchase/grid/cart/blog/article layout in shared presentation components.
4. Run editor preview and renderer responsive tests, plus frontend TypeScript/build if CSS/UI changed.

**Done when:** both starters remain usable at narrow widths and preview uses the same persisted draft content.

## Task 10 — Full Fresh Market lifecycle and Artisan completeness

**Files:** backend/frontend integration or E2E test harness already used by the repo; only necessary test helpers.

1. Add the end-to-end failing test before wiring: create store → install Fresh Market → read installed workspace → open editor → edit hero → add/select real Catalog Product and uploaded media → desktop/mobile preview → Validate → Preview → Publish → assert all public routes.
2. Prove Validate returns existing compiler diagnostics for intentionally invalid state and creates no publication or workspace mutation. Prove Preview reflects current draft edits and does not change public snapshot/current publication.
3. Assert published Home/Product/Collection/Cart/Search/Page/Blog/Article and Not Found are served through current runtime and the image/media reference is retained.
4. Install Artisan Boutique into a second fresh store; assert complete defaults/globals, distinct visual settings/layout, independent records and no cross-store leakage.
5. Run the focused end-to-end suite and save exact commands/results in the milestone report.

**Done when:** the acceptance lifecycle passes for Fresh Market and structural/install/compiler checks pass for Artisan Boutique.

## Task 11 — Regression gate and handoff

1. Run touched registry/schema/compiler/workspace/installer/PGlite/editor/renderer/catalog/public-route tests.
2. Run backend and frontend TypeScript checks and frontend production build.
3. Run V4 compiler, immutable publication, current activation, public snapshot, store isolation, media, and V3 compatibility regressions. Compare failures against the known baseline and report only new/touched-module failures as blockers.
4. Run `git diff --check`; inspect the scoped diff and leave unrelated dirty files untouched. Do not create marketplace, payments, delivery, multi-theme, checkout extension, or V3 migration work.
5. Report completed behavior, test results, migrations, and any remaining contract mismatch. Stop after this milestone for review.

## Execution constraints

* Work in the current branch/worktree without resetting, stashing, or overwriting pre-existing changes.
* Stage only milestone files if a commit is requested; this plan does not request a commit by itself.
* Every implementation task ends with focused verification before proceeding.
