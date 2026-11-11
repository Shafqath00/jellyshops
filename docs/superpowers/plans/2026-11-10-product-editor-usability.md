# Product editor usability implementation plan

> **For agentic workers:** Execute inline with superpowers:executing-plans. User requested “start” after the single-page recommendation.

**Goal:** Make creating and editing products understandable to first-time sellers.

**Architecture:** Refine the existing ProductBuilder and section components. Keep catalog APIs, product models, media uploads, and variant generation intact. Use existing admin-kit tokens, cards and typography; add no dependencies.

**Tech stack:** React, TypeScript, Next.js, admin-kit CSS, Vitest, Testing Library.

**Spec:** User brief and recommended single-page approach in this chat.

## Design

Left-aligned workbench: main column for details, photos, pricing, inventory, options and variant rows, shipping and optional information. Right rail for status, category and organization. Save bar spans both columns and follows all content on mobile. Retain admin-kit palette and font; quiet neutral cards with emphasis on publishing actions. Avoid adding a second onboarding interface: guidance belongs beside the relevant controls.

## Constraints

- Keep saved products, custom fields, variant values and media assignments compatible.
- Required labels must reflect existing validation; optional fields remain reachable.
- Draft and publish actions must save their stated status in one request.
- Errors inside collapsed details must reveal their field before focus.
- Search collections without dropping selected collections outside the results.

## Review focus

- New product saved as draft versus explicitly published.
- Failed save retains entered values and requested status is not falsely shown as saved.
- Variant products show the existing per-variant price and stock behavior.
- Validation opens nested disclosures and focuses the invalid field.
- Narrow layouts preserve access to status, organization and save controls.

## Task 1: Structure and selling details

- [x] Separate InventorySection from PricingSection; move SKU/barcode with inventory.
- [x] Reorder builder sections, move category into side rail, keep choices and variants adjacent.
- [x] Add optional Section disclosures for personalization, quantity rules and empty custom fields, preserving configured values.
- [x] Add required labels, descriptions, section links and scoped responsive CSS.
- [x] Update relevant section tests and run product-builder tests.

## Task 2: Save and organization interactions

- [x] Add regression tests for draft/publish requests, collapsed error focus, and collection search/selection preservation; observe expected failures.
- [x] Implement explicit save status override, default new products to draft, and state-aware save labels without modifying shared emptyDraft.
- [x] Add searchable collections, selected count and helpful organization descriptions.
- [x] Run focused tests, TypeScript and lint for changed files; inspect rendered editor if local authentication permits.

## Execution record

- Existing checkout is clean and on combined/dashboard-and-templates. Reuse it as requested by desktop workspace defaults.
- No commit, push, deployment or database changes are required.

## Verification

- Product builder and established create route: 25 test files, 223 tests passed.
- TypeScript: `tsc --noEmit` passed.
- ESLint: product-builder folder and create-route test passed with 0 errors; 14 existing warnings in unchanged preview/photo/variant files.
- Browser: reviewed 1440px desktop and 390px mobile layouts; verified empty draft validation focuses the product name. Restored default viewport and left the editor open for review. No products were created or published during browser checks.
- Independent static review found no actionable regressions.
