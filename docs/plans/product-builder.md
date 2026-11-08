# Product Builder — design plan

Status: phases 1-6 built (phase 6 in part: see below). Date: 2026-10-25.

**Built**
1. Shared rules (conditions, selection and draft validation), now in `@jelly/storefront-schema` (`product-options.ts`) so the API, storefront and builder share one rule set.
2. Persisted categories and templates (`/api/stores/:storeId/taxonomy`, migration `20261023000000_category_taxonomy.sql`, applied to staging).
3. Builder shell at `/admin/products/builder`: basics, category, price and stock.
4. Choices and combinations sections, bulk edit, editing at `/admin/products/builder/[id]`.
5. Interactive buyer preview.
6. Server enforcement on product writes (3 stock-tracked choices, 100 combinations, duplicates, conditions, variant/choice match), checkout validation with pick-several and conditional choices, and storefront pick-several, conditions and required hints.

**Not built yet:** text-input customisations, per-combination photos, an explicit "don't sell this combination" flag (needs a migration), and the condition editor in the builder.

## 0. What already exists (we extend, we do not restart)

- `Product.options` (JSONB) holds `ProductOption[]` with `type: variant | configuration | addon`, `required`, `display`, and values with `priceAdjustmentMinor`. `Product.inventoryOptionIds` says which options are real variant axes.
- `ProductVariant` (own SKU, price, `options` JSONB, `trackInventory`) + `InventoryLevel`.
- Checkout already validates `configurationSelections`, re-prices server-side, snapshots them into `OrderItem.configurationSnapshot` and keys lines by `configurationKey`.
- `Category` has `parentId`; `CategoryOptionDefinition` + `getEffectiveCategoryOptionDefinitions` already give inherited suggestions; the UI has `category-recommendations.tsx`, `product-category-picker.tsx`, `product-options-editor.tsx`.
- Gaps: taxonomy is not persisted server-side; no conditional options; no variant matrix generator/editor; no live buyer preview; no multi-select/quantity/text-input customisations; no variant-specific images; no variant cap.

So this is mainly a **UX + model consolidation**, with a small number of additive migrations.

## 1. The core idea: one concept, three behaviours

Sellers see a single word: **Choice** ("something the customer picks"). Behind it, each Choice has a *behaviour* that the UI sets from plain-language questions, never from jargon:

| Seller question | Behaviour | Stored as |
| --- | --- | --- |
| "Does each combination have its own stock, SKU or photos?" Yes | **Variant axis** (Size, Colour) | `type: variant`, in `inventoryOptionIds`, generates `ProductVariant` rows |
| "Does it just change the price or need to be remembered?" | **Extra choice** (Material, Storage, Mattress firmness) | `type: configuration`, no variants, price add-on |
| "Optional extra the customer can add?" | **Add-on** (Headboard, gift wrap) | `type: addon`, multi-select, price add-on |
| "Customer types something" | **Text field** (engraving) | new `input: text`, optional price, snapshot stores the text |

Rule that kills variant explosion: **only axes that need their own stock/SKU/photo become variants.** A bed = Size (variant, 4 values) × Storage (variant, 2) = 8 variants; Material, Firmness, Headboard stay as price-adjusting choices. Hard cap: 100 variants per product (configurable per plan), 3 variant axes in v1 (matches common platform limits); the UI explains and offers "make this an extra choice instead" when the cap is hit.

## 2. Single-page layout (top to bottom, sections collapse)

1. **Basics** — title, description, photos (drag to reorder; first = cover).
2. **Category** — searchable tree picker (Fashion › Men › T-Shirts) with "Create new category". Picking one fires the template suggestion (§5).
3. **Price & stock** (simple products) — price, compare-at, SKU, quantity. Visible only while the product has no variant axes.
4. **Choices** — empty state: a single button "This product comes in different options (size, colour…)". Suggested chips from the category ("Size", "Colour" — click to add). Each choice is a compact card: name, values as chips (type + Enter), toggle **Required**, toggle **Customer can pick several**, and the one plain question above ("Track stock separately for each?"). Advanced drawer per choice: display style (buttons/swatches/dropdown/images), per-value price change, show-only-when (conditions).
5. **Variants** — appears only when ≥1 variant axis exists. A table generated from the axes: rows = combinations, columns = price, stock, SKU, photo, "available" toggle. Bulk bar: "set price for all / for all Black / stock for all". Grouped by the first axis, collapsible. New combos appear when values are added; removed values archive rows (never hard delete once sold).
6. **Customisations** — text field, file/note, gift wrap: the same card component as Choices, kept visually separate so sellers don't confuse them with stock.
7. **Organise & SEO** — brand, collections, tags, digital delivery (existing panels), collapsed by default.
8. **Sticky right rail (desktop) / "Preview" tab (mobile): live buyer preview** — see §6. Sticky footer: Save draft / Publish.

Simple T-shirt seller: sections 1, 2, 3 only. Choices stays a one-line prompt.

## 3. Categories & product types

- Persist `Category` per store: `id, storeId, parentId, name, slug, position, source ('platform'|'merchant')`. Platform categories come from a seeded global tree (Fashion, Furniture, Electronics, Home, Beauty, Food, Jewellery, Books, Other…, 2–3 levels) copied into the store on first use (copy, not reference, so merchants can rename/hide without affecting others). Merchants can add their own children anywhere.
- **No separate "product type" table.** A product's type *is* its category. The category carries a *template*. Fewer concepts, nothing rigid.
- `Product.primaryCategoryId` stays; `additionalCategoryIds` stays for storefront navigation.

## 4. Options storage (additive, backward compatible)

Keep `Product.options` JSONB as the source of truth for the seller-defined schema (it is small, always read with the product, and already used by cart/checkout). Extend the option object:

```
ProductOption {
  id, name, type: variant|configuration|addon|input,
  required, multiple (bool), minSelect?, maxSelect?,
  display, position,
  values: [{ id, label, priceAdjustmentMinor, color?, image?, isDefault?, position, available? }],
  visibleWhen?: { optionId, valueIds[] }   // one level, AND of rules not supported in v1
  input?: { kind: 'text'|'note', maxLength, priceAdjustmentMinor }
}
```

Reusable definitions: `OptionPreset` table (`storeId nullable`, name, kind, default values) so "Size: XS–XXL" can be added in a click and shared across products; selecting a preset *copies* values into the product.

## 5. Smart templates

`CategoryTemplate` (extends today's `CategoryOptionDefinition`): `categoryId`, ordered list of suggested choices with default values, behaviour, required flag, and suggested spec fields (e.g. Material, Weight). Inheritance down the tree already works (`getEffectiveCategoryOptionDefinitions`); child overrides parent by name. Examples: T-Shirts → Size (variant, required, XS–XXL), Colour (variant, required, swatches). Beds → Bed size (variant, required), Storage (variant), Material (extra), Firmness (extra), Headboard (add-on, optional). Suggestions are **chips, never auto-applied**; applying twice is a no-op (name match). Seeded templates ship as data, so adding an industry needs no code.

## 6. Live preview

Reuse the real storefront product component (`product-client.tsx` / renderer) fed by the in-memory draft via a `ProductDraft → StorefrontProduct` mapper, so the preview cannot drift from production. Preview shows: swatches/buttons per choice, required marker + "Please choose a size" error on Add to cart, price updating from variant price + add-ons, sold-out and unavailable combos disabled, conditional choices appearing/disappearing, add-ons summary. A small toggle for desktop/mobile width. Validation warnings appear next to the preview ("Black / XL has no price").

## 7. Variants, inventory, images

- `ProductVariant` keeps its shape. Add `position`, `imageMediaId` (nullable, FK to media), `available` (seller-disabled combos), `optionKey` (stable sorted `optionId:valueId|…`, unique per product) so regeneration is idempotent and edits survive adding values.
- Generation is a pure function `generateVariantMatrix(axes, existingVariants)` shared in a package (frontend preview + backend validation use the same code): keeps existing rows by `optionKey`, adds new, archives removed.
- Price: variant price is absolute; option/value add-ons are additive; checkout total = variant price + Σ add-ons, all computed server-side (already the case).
- Inventory: stock only on variants (`InventoryLevel`); add-ons/extra choices never hold stock in v1. (Later: a "limited" flag per value if a real need appears.)
- Images: product media can be assigned to a variant or to a colour value; selecting that value in the storefront switches the gallery.

## 8. Conditional options & dependencies (v1 scope)

Single rule per choice: `visibleWhen { optionId, valueIds }`. Hidden choices are not required and their selections are dropped before add-to-cart. Backend validates the same rule (re-evaluates the conditions from the submitted selections; rejects a submitted value whose option is hidden). Unavailable combinations are handled by `available = false` on a variant, not by a rules engine. Cycles are blocked in the editor and re-checked on save. No multi-rule logic, no value-level incompatibility matrix until sellers ask.

## 9. Backend design

Migrations (all additive, safe on staging first, ask before applying):

1. `Category` (+ `CategoryTemplate`/`OptionPreset` seed tables), backfill from existing `categoryMetadata`/`CategoryOptionDefinition` data if any stored.
2. `ProductVariant`: `optionKey`, `position`, `imageMediaId`, `available`; unique `(productId, optionKey)` among non-archived.
3. Order snapshot: extend `configurationSnapshot` entries with `optionType`, `input text`, `valueIds[]` for multi-select (already JSON, no column change).

API (all under `/api/stores/:storeId/…` with `requireStorePermission`): categories CRUD + tree, templates read, option presets CRUD, product create/update accepting `options` + `variants[]` in one transaction, and `POST …/products/validate` (dry-run returning human-readable problems used by both preview and Publish).

Validation (shared zod in a package): ≥1 value per choice, unique labels, variant matrix complete & ≤ cap, no variant without price, conditions acyclic, required choices not hidden by default, digital vs physical rules. Publish is blocked on errors; warnings (no photo, no SKU) never block.

Cart/checkout/order: add `selectedValueIds[]` for multi-select, `text` for inputs; server re-resolves variant from the variant-axis selections (no client-supplied variant trust), re-prices, evaluates conditions, enforces required; `configurationKey` already makes distinct configs separate cart lines. Orders store labels + prices at purchase time, so later edits never rewrite history. Reservation logic is unchanged because it is per variant.

Performance: options live in the product row (no joins); variant list fetched once per product; matrix computed client-side; storefront snapshot compiles options+variants into the published publication already, so live pages do no extra queries.

## 10. Frontend architecture

```
features/product-builder/
  ProductBuilder.tsx            // page shell, state (useReducer draft), autosave draft, dirty guard
  state/draft.ts, reducer.ts    // ProductDraft, actions, selectors
  sections/BasicsSection, CategorySection, PricingSection, ChoicesSection,
           VariantsSection, CustomisationsSection, OrganiseSection
  choices/ChoiceCard, ValueChips, ConditionPicker, PresetMenu, TemplateChips
  variants/VariantTable, BulkBar, matrix.ts (shared package)
  preview/BuyerPreview.tsx, draftToStorefrontProduct.ts
  validation/validateDraft.ts (shared package)
```

Existing `product-form.tsx` (374 lines), `product-options-editor.tsx`, `category-recommendations.tsx` and `product-category-picker.tsx` are migrated into this structure rather than rewritten from scratch; the old form stays behind a flag until parity.

## 11. Buyer experience

Product page renders choices in seller-defined order; required choices get a marker; Add to cart is enabled but shows inline errors (better than a silently disabled button); unavailable values are struck through with "Unavailable" and a reason on tap; price shows "From ₹X" until the variant is resolved, then exact price with add-ons itemised; variant image swaps the gallery; text inputs show remaining characters; cart lines display chosen options; order confirmation, emails and admin order detail show the snapshot.

## 12. Edge cases

- Seller edits option values after sales: values get stable ids; removing archives, renaming changes label only; orders keep snapshots.
- >100 variants: block with explanation; suggest converting an axis to an extra choice.
- Variant axis added to a product that already has stock: existing single variant becomes the first matrix row ("Default") and keeps its stock/SKU; seller assigns it explicitly.
- Same value in different axes (e.g. "Large"): ids are per option, so no clash.
- Untracked inventory: `trackInventory=false` per variant keeps working.
- Digital products: no variant stock, delivery per variant optional, shipping hidden.
- Imported/Provider-synced products (`provider-sync.ts`): read-only choices when `externalId` is set.
- Concurrent edit: product `updatedAt` optimistic check on save.
- Price change between cart and checkout: server reprices; cart shows the updated total (existing behaviour).

## 13. Roadmap (each phase shippable, behind a per-store flag, ask before staging DB writes)

1. **Shared logic**: option/variant types + zod, `generateVariantMatrix`, `validateDraft`, with unit tests. No UI change.
2. **Taxonomy**: persisted categories, seeded tree, templates, category picker backed by API.
3. **Builder shell + Basics/Category/Pricing**, simple products end to end, replaces the simple path of the current form.
4. **Choices + Variants sections** and variant migration columns; template chips; bulk edit.
5. **Live buyer preview** wired to the real storefront component.
6. **Customer side**: multi-select, text inputs, variant images, required/inline errors, cart & order snapshots, checkout validation.
7. **Conditions** (single-rule), then presets, then polish, a11y pass, Playwright journeys (T-shirt, bed), docs, remove old form.

## 14. Decisions I recommend (open for your call)

- "Choice" as the single seller-facing term, with behaviour derived from one yes/no question.
- Cap of 3 variant axes / 100 variants for v1.
- Categories copied per store from a platform seed, no separate product-type table.
- Conditions limited to one rule per choice in v1.
- Stock only at variant level.
