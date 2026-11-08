# Fresh Market Theme and Store Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make Fresh Market visually coherent across its nine existing V4 page types and make the current editor easier to navigate without changing V4 data or publication architecture.

**Architecture:** Retain the V4 starter pack, section registry, shared renderer, workspace APIs, compiler, and publication behavior. Update Fresh Market tokens/default compositions and registered renderer presentation as required, then improve the existing editor layout and prove parity through renderer, editor, responsive, and publication tests.

**Tech Stack:** TypeScript, React, Next.js, V4 storefront schema/registry/renderer packages, Vitest, Playwright.

**Spec:** jellyshops/docs/superpowers/specs/2026-09-24-fresh-market-theme-editor-design.md

## Global Constraints

- Supported page types are exactly Home, Product, Collection, Cart, Search, Page, Blog, Article, and Not Found.
- Do not change the V4 compiler, workspace model, publication pipeline, active-publication behavior, or public runtime architecture unless a concrete defect is discovered.
- Editor preview and public storefront continue to use the shared V4 renderer.
- Do not introduce unrestricted CSS, unrestricted HTML, scripts, or another editor document model.
- Artisan Boutique remains unchanged.
- Keep commerce-critical pricing, variants, quantity, availability, cart totals, and primary actions visible and usable.
- Responsive verification widths are 1440px, 820px, 390px, and 320px.

## Review Focus

- Sparse page/resource context must render a safe empty state without hiding commerce controls; test the owning renderer.
- Missing images and long merchant titles must not create broken media or horizontal overflow; test media and product cards.
- At 320px, Product purchase controls and Cart totals/actions must remain reachable; test through Playwright.
- Global Header/Footer and the optional announcement must not appear twice; test starter composition and editor preview.
- Artisan Boutique output and publication snapshot semantics must remain unchanged; test starter regression and preview/public behavior.

---

### Task 1: Pin Fresh Market and Artisan Boutique starter contracts

**Files:**
- Modify: jellyshops/packages/storefront-registry/src/v4-starter-packs.test.ts
- Modify: jellyshops/packages/storefront-registry/src/v4-starter-packs-validation.test.ts
- Modify: jellyshops/packages/storefront-themes/src/theme-registry.test.ts

**Interfaces:**
- Consumes: getV4StarterPack, listThemes, and current V4 page types.
- Produces: regression assertions for exactly nine Fresh Market templates, valid placements, one shared Header/Footer per template, and unchanged Artisan Boutique output.

- [ ] **Step 1: Add failing starter contract assertions**

Assert Fresh Market has exactly one default template per supported page type and the section compositions listed in the spec. Assert global Header and Footer occur once per template and the announcement is not duplicated. Pin Artisan Boutique's current token values and starter template IDs/content.

- [ ] **Step 2: Run focused tests**

Run from jellyshops: npm run test:unit -- packages/storefront-registry/src/v4-starter-packs.test.ts packages/storefront-registry/src/v4-starter-packs-validation.test.ts packages/storefront-themes/src/theme-registry.test.ts

Expected: new assertions expose any current mismatch.

- [ ] **Step 3: Correct only the Fresh Market starter branch if tests identify a mismatch**

Modify the Fresh Market branch in packages/storefront-registry/src/v4-starter-packs.ts only. Keep the Artisan Boutique branch and shared starter contract unchanged.

- [ ] **Step 4: Rerun the focused tests**

Expected: all starter assertions pass, including Artisan Boutique regression.

### Task 2: Establish Fresh Market tokens and shared chrome

**Files:**
- Modify: jellyshops/packages/storefront-themes/src/fresh-market/tokens.ts
- Modify: jellyshops/packages/storefront-themes/src/storefront-theme-tokens.ts
- Modify: jellyshops/packages/storefront-themes/src/storefront-theme-tokens.test.ts
- Modify: jellyshops/packages/storefront-renderer/src/sections/header.tsx
- Modify: jellyshops/packages/storefront-renderer/src/sections/footer.tsx
- Test: jellyshops/packages/storefront-renderer/src/registry-renderer.test.tsx

**Interfaces:**
- Consumes: ThemeTokens, resolved --jelly-* CSS variables, and current Header/Footer section props.
- Produces: restrained Fresh Market tokens and shared chrome styles that use the existing variables and props.

- [ ] **Step 1: Add failing token and chrome assertions**

Test resolved Fresh Market colors, typography, radii, section spacing, and container width. Test Header/Footer retain store identity, navigation/cart controls, and fit a narrow viewport without overflow.

- [ ] **Step 2: Run focused tests**

Run from jellyshops: npm run test:unit -- packages/storefront-themes/src/storefront-theme-tokens.test.ts packages/storefront-renderer/src/registry-renderer.test.tsx

- [ ] **Step 3: Update Fresh Market tokens and existing shared renderer styles**

Use semantic theme variables, modest radii/borders, readable type sizes, and predictable gutters. Do not add new theme renderer contracts or change section props.

- [ ] **Step 4: Rerun focused tests**

Expected: Fresh Market assertions pass; other theme expectations remain unchanged.

### Task 3: Align existing section renderers and Fresh Market page defaults

**Files:**
- Modify as needed: jellyshops/packages/storefront-registry/src/v4-starter-packs.ts
- Modify only if an existing setting cannot express a required presentation: jellyshops/packages/storefront-registry/src/sections/commerce.ts and content.ts
- Modify as needed: jellyshops/packages/storefront-renderer/src/sections/home-sections.tsx
- Modify as needed: jellyshops/packages/storefront-renderer/src/sections/hero.tsx
- Modify as needed: jellyshops/packages/storefront-renderer/src/sections/product-grid.tsx
- Modify as needed: jellyshops/packages/storefront-renderer/src/sections/product-sections.tsx
- Modify as needed: jellyshops/packages/storefront-renderer/src/sections/collection-sections.tsx
- Modify as needed: jellyshops/packages/storefront-renderer/src/sections/content-pages.tsx
- Modify as needed: jellyshops/packages/storefront-renderer/src/sections/theme-pack-sections.tsx
- Test: jellyshops/packages/storefront-renderer/src/registry-renderer.test.tsx
- Test: jellyshops/packages/storefront-registry/src/v4-starter-packs.test.ts

**Interfaces:**
- Consumes: existing section settings schemas, runtime contexts, theme variables, and registered renderer props.
- Produces: the nine page compositions and responsive presentation without route-specific rendering or new page types.

- [ ] **Step 1: Add failing render cases for all nine page types**

Use existing section nodes and representative runtime data. Assert semantic headings, image alt text, Product price/availability/variants/quantity/Add to cart, Collection and Search results, Cart totals/checkout, Page content, Blog list, Article content, and Not Found action.

- [ ] **Step 2: Run focused renderer and starter tests**

Run from jellyshops: npm run test:unit -- packages/storefront-renderer/src/registry-renderer.test.tsx packages/storefront-renderer/src/section-support.test.ts packages/storefront-registry/src/v4-starter-packs.test.ts

- [ ] **Step 3: Fix presentation only in existing registered renderers**

Use theme variables and responsive layout in the current section renderers. Preserve commerce details and primary actions. If a concrete gap requires a registry setting, add a bounded validated schema/control and tests for validation and rendering; do not add arbitrary style fields.

- [ ] **Step 4: Keep starter defaults focused**

Adjust only Fresh Market section settings/order as required. Do not populate every available section and do not change Artisan Boutique defaults.

- [ ] **Step 5: Rerun focused renderer and starter tests**

Expected: all nine page tests pass and the starter remains registry-valid.

### Task 4: Clarify editor navigation, hierarchy, inspector, and preview

**Files:**
- Modify: jellyshops/src/app/admin/online-store/editor/page.tsx
- Modify: jellyshops/src/features/store-editor/components/template-resource-selector.tsx and its test
- Modify: jellyshops/src/features/store-editor/components/template-hierarchy.tsx and its test
- Modify: jellyshops/src/features/store-editor/components/preview-canvas.tsx
- Modify: jellyshops/src/features/store-editor/components/editor-shell.test.tsx
- Modify: jellyshops/src/features/store-editor/components/inspector/theme-settings-panel.tsx and its test

**Interfaces:**
- Consumes: current selection/template/resource state, settings schema, shared renderer, and existing PublishControls callbacks.
- Produces: distinct page/template controls, section tree, inspector, and preview while all mutations continue through current workspace APIs.

- [ ] **Step 1: Add failing editor interaction/layout tests**

Assert Page type, Template, and Preview resource are separately labeled; selecting a section keeps the hierarchy available and reveals its settings; Desktop/Tablet/Mobile updates preview dimensions; narrow screens show Sections/Preview/Settings one panel at a time.

- [ ] **Step 2: Run focused editor tests**

Run from jellyshops: npm run test:unit -- src/features/store-editor/components/template-resource-selector.test.tsx src/features/store-editor/components/template-hierarchy.test.tsx src/features/store-editor/components/editor-shell.test.tsx src/features/store-editor/components/inspector/theme-settings-panel.test.tsx

- [ ] **Step 3: Refine the existing editor page layout**

Keep fixed chrome, left section list, center preview, and right settings at desktop sizes. At narrow sizes expose explicit panel navigation. Limit scrolling to the section list, inspector, and canvas. Preserve commands, autosave, Validate, Preview, and Publish callbacks.

- [ ] **Step 4: Rerun focused editor tests**

Expected: navigation, selection, and responsive panel assertions pass without API changes.

### Task 5: Prove Fresh Market responsive rendering and preview/public parity

**Files:**
- Modify: jellyshops/e2e/starter-responsive.spec.ts
- Modify only if a non-secret store selector is needed: jellyshops/e2e/fixtures/merchant-auth.ts
- Modify: jellyshops/src/features/storefront/published-v4-routes.test.ts
- Modify: jellyshops/src/features/store-editor/preview-context.test.ts

**Interfaces:**
- Consumes: existing authenticated merchant fixture, dedicated Fresh Market test store, page/template selector, public routes, and draft preview.
- Produces: all-nine-page coverage at 1440, 820, 390, and 320px and a draft/public parity assertion.

- [ ] **Step 1: Add the Fresh Market page/width matrix**

Select each default template and a valid preview resource where required. Assert no horizontal overflow or clipped primary content. Specifically check header navigation, hero/media, Product purchase controls, Collection/Search grids, Cart totals/action, article reading width, and editor controls at 320px.

- [ ] **Step 2: Add draft-preview/public isolation coverage**

Persist a harmless draft text/style change, verify draft preview reflects it, and verify the active public snapshot remains unchanged before Publish. Do not change publication behavior.

- [ ] **Step 3: Run browser and route tests**

Run from jellyshops: npm run test:e2e -- e2e/starter-responsive.spec.ts

Run: npm run test:unit -- src/features/storefront/published-v4-routes.test.ts src/features/store-editor/preview-context.test.ts

Expected: the page/width matrix passes and public routes remain publication-backed.

### Task 6: Run the Fresh Market/editor verification gate

**Files:** no additional implementation files.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: verified Fresh Market/editor slice with unrelated dirty files preserved.

- [ ] **Step 1: Run focused tests**

From jellyshops run npm run test:unit with the registry starter tests, theme token tests, renderer tests, editor selector/hierarchy/shell/inspector tests, published route tests, and preview-context tests listed above.

- [ ] **Step 2: Run TypeScript and production build**

From jellyshops run npm run typecheck and npm run build. Expected: both exit successfully.

- [ ] **Step 3: Check the intended diff**

Run git diff --check and git status --short. Do not stage or alter unrelated dirty files, generated output, or local credentials.
