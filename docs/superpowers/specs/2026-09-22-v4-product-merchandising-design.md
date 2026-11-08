# V4 Product Merchandising Design

## Scope

This slice makes the existing V4 Product template merchant-useful without adding routes, a second renderer, or theme-owned commerce data. It is the first vertical slice of the accepted merchant-theme milestone. Collection expansion, generic content sections, theme-setting expansion, and broader editor polish follow as separate slices.

## Goals

- Render a live product gallery, title, price and compare-at price, variants/options, quantity, availability, SKU/vendor, description, and related products through registry-owned Product sections.
- Let a shopper choose an available variant, change quantity, and add the selection through the established cart/commerce service.
- Let merchants arrange and configure those sections in the existing template editor, preview draft layouts, publish them, and see the same section structure on the public V4 Product page.
- Keep product fields authoritative in the catalog and cart state authoritative in the commerce subsystem.

## Non-goals

- No new storefront route or public-runtime architecture.
- No product, variant, inventory, price, or availability copies in theme settings or publication snapshots.
- No checkout redesign, collection work, product recommendation service, or metadata framework.

## Architecture

The existing publication snapshot remains responsible only for template layout, section settings, global layout, and theme settings. The public Product route continues to obtain the active snapshot, resolve the live Product resource, and render through `PublishedRuntimeStorefront`.

The shared renderer receives a narrow live Product presentation context. It contains display-safe product data plus a commerce interaction adapter with actions for selecting options/variant, setting quantity, and adding to cart. The adapter is assembled at the existing Product route/composition boundary from current catalog and cart services. Registry section renderers consume this adapter; they do not perform repository writes, calculate inventory, or invent variant resolution rules.

Editor preview receives the same data shape but a preview-safe adapter. It renders the selected real product and supports local selection state without persisting that state into the workspace. The compiled draft snapshot determines sections and settings; the resource and commerce data stay live.

## Registry and rendering

The registry owns reusable Product section definitions and their editor metadata. Product-specific sections are allowed only on Product templates and are diagnosed by the existing compatibility validation otherwise.

The initial section set is:

- `product-gallery`: media presentation settings only.
- `product-information`: title, vendor/SKU, price/compare-at, and availability display toggles.
- `product-options`: option/variant controls and unavailable-state display.
- `product-purchase`: quantity selector and add-to-cart label/style settings.
- `product-description`: description presentation.
- `related-products`: bounded related-product grid with presentation settings only.

Where a section has merchant-editable visual behavior, its Zod settings schema, default settings, controls, responsive metadata, renderer, and registry test are added together. Product data fields are not settings.

## Interaction and failure behavior

Variant resolution, required-option checks, configured pricing, and stock checks use existing commerce/domain helpers. The renderer disables purchase for an unresolved, unavailable, or out-of-stock selection and exposes the corresponding live availability message. Quantity is bounded by the selected variant's current availability. Add-to-cart delegates to the supplied adapter and reports its result; a renderer never directly mutates cart storage.

If a Product resource is absent, the normal route/resource resolution remains not-found. If a Product has no selectable variant, Product sections render a safe unavailable state. Missing optional fields such as vendor, SKU, compare-at price, media, description, or recommendations omit their respective presentation rather than inventing data.

## Data flow

```text
draft template layout --compile--> V4 preview snapshot --+
active publication -------------------------------> V4 public snapshot --+
live Product + existing commerce/cart adapter ----------------------------> shared Product section renderer
```

Only the left input differs between preview and public rendering. Product and cart information remains live in both paths.

## Testing and verification

- Registry compatibility tests for every Product section and unsupported page types.
- Renderer tests for gallery, price/compare-at, availability, description, related products, and missing optional data.
- Interaction tests proving variant selection, quantity bounds, and add-to-cart delegate to the commerce adapter.
- Editor tests proving a real Product preview, section order/configuration, and draft snapshot preview.
- Public Product route tests proving the active publication layout reaches the same renderer contract.
- Publication regression tests proving draft edits remain private until publish.
- Focused frontend tests, cart integration tests, TypeScript, affected builds, and `git diff --check`.

## Acceptance

A merchant can select a Product template and a real Product, arrange Product sections, configure their presentation, preview live variant/quantity behavior against a compiled draft, publish, and see the same published structure publicly. Changes to catalog, stock, and cart state do not require a theme publication to take effect.
