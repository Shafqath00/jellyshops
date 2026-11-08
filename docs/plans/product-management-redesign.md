# Product management redesign (Shopify-inspired) — gap analysis and phases

Status: analysis only, nothing built. Date: 2026-10-28.

## What exists

- **Frontend**: `/admin/products` list (search, status filter, sort, cursor paging), `/admin/products/new` and `/[id]` (classic `product-form.tsx`), `/admin/products/builder` (+ `/[id]`) single-page builder (basics, category, price/stock, choices, variants, buyer preview), `/admin/products/stock`, `/admin/products/collections`.
- **Backend** (`backend/src/catalog`): product + variants (`sku`, `priceMinor`, `compareAtPriceMinor`, `options`, `trackInventory`, `quantity`, `reserved`), `specifications`, vendor, productType, tags, status, media with `appliesTo`, categories/brands/collections, taxonomy API, inventory read/update with optimistic revision, reservations at checkout.
- **Metafields**: `MetafieldDefinition` / `MetafieldValue` tables (owner types include product and variant, namespace/key, type, validations, `storefrontVisible`), `backend/src/custom-data/`, and an admin page at Settings → Custom data. Not yet editable inside the product editor.

## Gaps against the brief

| Area | Gap |
| --- | --- |
| Description | Plain textarea. No rich text, no sanitised HTML pipeline. |
| Pricing | Compare-at exists. No cost per item, profit, margin, unit pricing, per-product tax setting. |
| Inventory | SKU and quantity exist. No barcode, continue-selling-when-out-of-stock, low-stock threshold, adjustment history/log, multi-location. |
| Shipping | No physical toggle beyond `fulfillmentType`, no weight, dimensions, origin country, HS code. |
| Variants | Builder generates and bulk-edits. Missing: variant images, variant weight/barcode/cost, "don't sell this combination" flag. |
| Metafields | Backend ready; no product-editor panel, no variant-level UI, definitions need file/colour/reference types checked. |
| SEO | No page title, meta description or search preview fields; handle exists. |
| List page | No images-with-inventory-status polish, category/collection filters, bulk select/actions, duplicate, archive, delete. |
| Editor shell | Two editors (classic and builder) with overlapping scope. |

## Decision needed first

Two editors exist. Recommendation: build the Shopify-style layout (main column cards, right rail for status/organisation, sticky save bar) **on the builder** (`features/product-builder`), then retire the classic form. The builder already owns variants, choices, buyer preview and server-side rule enforcement.

## Phases (each: migration if needed, API + validation, UI, tests, commit; staging DB writes need approval)

1. **Editor shell + pricing**: Shopify layout and save bar, right rail, cost/profit/margin (live), unit pricing, tax toggle. Migration: cost, unit-price fields on variant.
2. **Rich text description**: TipTap-style editor (bold/italic/underline, headings, lists, links, alignment, tables), server-side HTML sanitiser, safe storefront rendering of the description.
3. **Inventory**: barcode, continue-selling, low-stock threshold and warning, `InventoryAdjustment` log table written by order, cancel, restock and manual adjust; history view. Multi-location deferred unless a location table is wanted.
4. **Shipping**: weight/unit, dimensions, origin, HS code, physical toggle; exposed to the fulfilment/order snapshot.
5. **Variants completion**: variant images, per-variant barcode/weight/cost, disable combination.
6. **Metafields in the editor**: product and variant panels using existing definitions, inline "add definition", type validation on write, storefront access via `storefrontVisible`.
7. **SEO**: title, meta description, handle, live Google-style preview, length guidance; emitted in storefront metadata.
8. **Products list**: thumbnails, inventory status, category/collection filters, bulk select + actions (activate, archive, delete, add to collection), duplicate, large-catalogue paging.
9. **QA**: Playwright journeys (simple product, variant product, order → stock), docs, remove classic form.

Existing products stay compatible: every new column is nullable/defaulted and additive.
