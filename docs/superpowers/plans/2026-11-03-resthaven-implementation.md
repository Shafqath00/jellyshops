# Resthaven Implementation Plan

**Goal:** Deliver the approved bed and mattress showroom theme to the Store designs catalog.

**Architecture:** Register a platform theme and starter pack using the existing shared registry and renderer. Style its storefront and editor previews with scoped, token-driven CSS; use existing commerce and installation flows.

**Spec:** `docs/superpowers/specs/2026-11-03-resthaven-theme-design.md`

1. Create the manifest and starter layouts with merchant-editable content; register discovery and catalog installation.
2. Build the Sonno-inspired responsive styling and original theme assets; implement reusable section options where needed.
3. Integrate product, collection, cart and supporting pages with existing commerce, avoiding unsupported controls.
4. Verify installation, editor, publishing, accessibility and responsive previews; document and commit the completed theme.

## Implementation record (2026-11-04)

- Theme manifest, nine starter templates, category/navigation recipes, original generated bedroom imagery and scoped application stylesheet are implemented and discovered by the platform.
- Product and collection styling uses existing commerce sections. Product grid selectors cover both live/CLI `main` and the merchant editor's `[data-storefront-template]`; the real merchant navigation remains visible on desktop. Gallery placement does not assume a preceding navigation row.
- Passed: 33 focused frontend checks including 20 Resthaven conformance checks; frontend/backend typechecks; starter validation; backend install/settings-edit/publish/immutable-publication integration against PGlite.
- Visually inspected CLI home/product/collection at desktop and phone sizes. Measured four desktop and two phone collection columns with no phone page overflow.
- Remaining acceptance: a complete signed-in merchant-editor browser session through install/edit/publish has not been exercised. Staging and deployment are separate actions. CLI product data remains generic sample data; merchant pages use actual store products.
- Reviewed runtime and preview integration; corrected editor-container selectors, merchant-menu visibility and order-dependent gallery placement.
