# Product Create Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the single-page product builder easier for sellers to scan and complete while preserving its current product and gallery behavior.

**Architecture:** Refine the existing Next.js builder route and its focused section components with the current Jelly Shop tokens and Tailwind utilities. Keep all product state and persistence in `ProductBuilder`; use native disclosure elements for optional fields and responsive layout classes to move the preview below the form on narrow screens.

**Tech Stack:** TypeScript, React 19, Next.js 16, Tailwind CSS 4, Vitest, Testing Library, Playwright/Codex browser.

**Spec:** `docs/superpowers/specs/2026-10-25-product-create-page-design.md`

## Global Constraints

- Keep product creation on one page.
- Preserve existing product data, gallery, choices, variant, validation, and save behavior.
- Keep optional description, original price, SKU, and infrequent fields available behind plain-language expanders.
- Use the Jelly Shop palette: ink `#14213d`, paper `#fffdf8`, soft paper `#f7f4ed`, citrus `#ffd85a`, and line `#dcd8ce`.
- Keep Aptos/Segoe as the working text face and use the existing rounded display face sparingly for the page title.
- Support mobile and desktop layouts, visible keyboard focus, and reduced motion.
- Do not change catalog APIs, the legacy product form, or rollout flags.

## Review Focus

- Small screens: the preview must follow the form in reading order and the save action must remain usable without covering fields. Test in browser at a narrow viewport and inspect the sticky save bar.
- Products with existing optional values: description, original price, and SKU must remain visible/editable after loading. Test the disclosure default-open behavior for populated drafts.
- Category API failure: the message must explain that category selection is optional and must not disable unrelated fields or saving. Test an unavailable category response.
- Empty and full galleries: the cover treatment and thumbnails must preserve add, replace, reorder, unlink, and alt-text actions. Run the existing photo gallery tests.
- Keyboard interaction: disclosure controls and gallery buttons must remain reachable with clear focus. Inspect keyboard navigation in browser.

---

### Task 1: Establish the page hierarchy and responsive frame

**Files:**
- Modify: `jellyshops/src/app/admin/products/builder/page.tsx`
- Modify: `jellyshops/src/features/product-builder/ProductBuilder.tsx`
- Modify: `jellyshops/src/features/product-builder/sections/BasicsSection.tsx`
- Modify: `jellyshops/src/features/product-builder/BuyerPreview.tsx`
- Test: `jellyshops/src/features/product-builder/sections/optional-fields.test.tsx`

**Interfaces:**
- Consumes: `ProductBuilder({ initial?: Product })` and current `BuyerPreview` props.
- Produces: the same form and preview behavior in a clearer responsive frame; no new persistence interface.

- [ ] **Step 1: Add a focused accessibility regression test**

In the `ProductBuilder` test suite, add `it("keeps the product sections, shopper preview, and save action easy to find", ...)` and assert the accessible headings `Product details`, `Photos`, `Category`, `Choices`, and `Price & stock`, plus the shopper preview and `Save product` button are present.

- [ ] **Step 2: Run the test and confirm the new page heading assertion fails**

Run from `jellyshops`: `npm run test:unit -- src/features/product-builder/product-builder.test.tsx`
Expected: the new test fails on the current page heading/hierarchy.

- [ ] **Step 3: Refine the builder frame**

Rename the “The basics” section to “Product details” so its purpose is plain. Update the route header and form wrapper so the task title is compact, the editing column has a readable maximum width, the preview is a quiet sticky desktop aside, and the preview follows the form below the mobile breakpoint. Keep the save bar within the form flow and preserve its existing save, publish, and uploading states.

- [ ] **Step 4: Run the focused builder test**

Run from `jellyshops`: `npm run test:unit -- src/features/product-builder/product-builder.test.tsx`
Expected: PASS, including existing save, validation, and preview behavior.

### Task 2: Make essential and optional fields distinct

**Files:**
- Modify: `jellyshops/src/features/product-builder/sections/section-parts.tsx`
- Modify: `jellyshops/src/features/product-builder/sections/BasicsSection.tsx`
- Modify: `jellyshops/src/features/product-builder/sections/CategorySection.tsx`
- Modify: `jellyshops/src/features/product-builder/sections/PricingSection.tsx`
- Create: `jellyshops/src/features/product-builder/sections/optional-fields.test.tsx`

**Interfaces:**
- Consumes: the existing `Section`, `Field`, `BasicsSection`, `CategorySection`, and `PricingSection` props.
- Produces: the same controlled draft updates, with optional description, original price, and SKU in accessible native disclosures.

- [ ] **Step 1: Add tests for optional-field disclosure and category failure copy**

Create `optional-fields.test.tsx`. Add `it("keeps optional product details tucked away until requested", ...)` and assert description, original price, and SKU are inside closed `<details>` elements for an empty draft. Add `it("opens optional details that already contain saved values", ...)` and render `BasicsSection`/`PricingSection` with saved description, compare-at price, and SKU to assert the relevant `<details open>` state. Add `it("explains that category is optional when categories cannot load", ...)` and assert the category error says the seller can save without choosing one.

- [ ] **Step 2: Run the test and confirm it fails**

Run from `jellyshops`: `npm run test:unit -- src/features/product-builder/sections/optional-fields.test.tsx`
Expected: FAIL because optional controls are currently always expanded.

- [ ] **Step 3: Clarify section hierarchy and tuck away optional fields**

Use sentence-case section headings and concise helper copy. Keep product name, photos, category, choices, price, and stock easy to find. Put description and optional pricing/SKU fields in native `<details>` elements; default them open when editing a product that already has corresponding values. Render the category failure as a recoverable inline message that says the product can still be saved without a category; do not block unrelated controls.

- [ ] **Step 4: Run focused builder tests**

Run from `jellyshops`: `npm run test:unit -- src/features/product-builder/sections/optional-fields.test.tsx src/features/product-builder/product-builder.test.tsx`
Expected: PASS, including the new disclosure and category-error assertions and existing create/update/category tests.

### Task 3: Simplify gallery and section surfaces

**Files:**
- Modify: `jellyshops/src/features/product-builder/sections/PhotosSection.tsx`
- Modify: `jellyshops/src/features/product-builder/sections/ChoicesSection.tsx`
- Modify: `jellyshops/src/features/product-builder/sections/ChoiceCard.tsx`
- Modify: `jellyshops/src/features/product-builder/sections/VariantsSection.tsx`
- Modify: `jellyshops/src/features/product-builder/BuyerPreview.tsx`
- Test: `jellyshops/src/features/product-builder/photos-section.test.tsx`
- Test: `jellyshops/src/features/product-builder/choices-and-variants.test.tsx`

**Interfaces:**
- Consumes: current media, option, variant, and preview props.
- Produces: the same gallery and commerce interactions with a clear cover photo, quieter secondary thumbnails, less competing card chrome, and cohesive preview styling.

- [ ] **Step 1: Add one gallery visual-structure assertion**

In `photos-section.test.tsx`, add `it("explains how to add the first product photo", ...)` and assert the empty gallery gives a clear first action. Add `it("identifies the cover photo and groups its actions", ...)`; assert the first photo card has the accessible name `Cover photo`, and that its alt-text, replace, reorder, and remove controls are found inside that card.

- [ ] **Step 2: Run photo and choice tests before styling**

Run from `jellyshops`: `npm run test:unit -- src/features/product-builder/photos-section.test.tsx src/features/product-builder/choices-and-variants.test.tsx`
Expected: the new empty-state and cover assertions fail while existing behavior tests pass.

- [ ] **Step 3: Apply the shared visual treatment**

Style the first photo as the cover and reduce emphasis on secondary cards while keeping all gallery actions and tags discoverable. Simplify choice and combination surfaces with consistent spacing, clear labels, and restrained separators. Match the preview to the form's hierarchy and keep focus states visible; honor `prefers-reduced-motion` if introducing any transition.

- [ ] **Step 4: Run gallery and choice tests**

Run from `jellyshops`: `npm run test:unit -- src/features/product-builder/photos-section.test.tsx src/features/product-builder/choices-and-variants.test.tsx`
Expected: PASS, including all existing upload, retry, replacement, reorder, tagging, and variant tests.

### Task 4: Verify the finished page

**Files:**
- Verify: `jellyshops/src/features/product-builder/`

**Interfaces:**
- Consumes: completed tasks 1–3.
- Produces: browser-verified desktop and mobile builder with the same saved product behavior.

- [ ] **Step 1: Run builder test suites and typecheck**

Run from `jellyshops`: `npm run test:unit -- src/features/product-builder`
Expected: all product builder tests pass.

Run from `jellyshops`: `npm run typecheck`
Expected: no new errors in the changed builder files; report any unrelated pre-existing failures separately.

- [ ] **Step 2: Review desktop and mobile browser states**

Open `/admin/products/builder` at desktop and narrow viewport widths. Verify the form hierarchy, photo cover treatment, preview placement, optional disclosures, category error copy, sticky save bar, and visible keyboard focus. Confirm no horizontal overflow and no controls are obscured.
