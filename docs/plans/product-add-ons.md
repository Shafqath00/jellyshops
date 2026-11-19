# Product add-ons: services and "Complete the set"

Date: 2026-11-19. Asked for by the owner after the Express Bed build (Sonno sells assembly with an "Add" button on the
bed page; DUSK offers a mattress, sheet and bedside table with their own size pickers under the bed).

## What already exists

- **Optional extras on a product** (option type `addon` in `storefront-schema/src/product-options.ts`): each value can
  carry a price (`priceAdjustmentMinor`), shoppers may pick several, the product page shows "+ £39", the bag line keeps
  the picks, and checkout re-prices them on the server (`backend/src/commerce/checkout-cart.ts`), so the order line and
  emails show them. The product builder calls this "Optional extra".
- **Complementary products block** (`complementary-products` in the Main product details column): a list of other
  products with photo, name and price, each a link to its own page. No size choice, no add button.
- **Quick add** on cards: adds a one-variant product to the bag through `CommerceDataProvider.cart`.

## Plan

### Phase 1: services as optional extras (done for Express Bed, 2026-11-19)

Assembly (£39) and old bed removal (£29) are an "Extras" optional choice on every Express Bed bed. They are part of
the bed's bag line, so removing the bed removes them, refunds follow the line, and nothing in the cart or order model
changes. Merchants set them up in the product builder (Choices > Optional extra). Limits: the extra is per line, not
per quantity (two beds with assembly cost £39 once per line, priced by quantity as today), and it cannot have its own
stock.

### Phase 2: "Complete the set" with add buttons (built 2026-11-19)

Built as planned with these choices: the existing `complementary-products` block gained `source` (related | pairs),
`addToBag` and `matchSize`; blocks saved before keep links only. "pairs" = `pairProducts()` in
`features/storefront/recommendations.ts` (collections the product is not in, one per collection first). Size choices =
`setChoicesFor()` in `product-card-data.ts` (one stock option; skipped when a required non-stock choice, required
personalisation, a quantity rule or two stock options are present: the row links to the product instead). The Add
button uses the existing `StorefrontCartAccess.setQuantity` (current quantity + 1) and fires `jelly:cart-changed`
(the bag count updates; the slide-out bag does not pop open, so shoppers can add several). Renderer `SetItem` in
`sections/product-blocks.tsx`; styles at the end of the complementary rules in `storefront-base.css`; tests
`storefront-renderer/src/complete-the-set.test.tsx` (incl. axe) and `features/storefront/complete-the-set.test.ts`.
The editor preview shows the rows with disabled Add buttons (sample products have no size choices, so they link).

Original plan:

1. Registry: `complementary-products` gains `addMode` (links / add buttons) and `pickSize` (on/off).
2. Renderer: each item shows a small size select built from that product's variants (sold-out sizes disabled) and an
   "Add" button; "Add selected" adds every ticked item. It uses `CommerceDataProvider.cart` (extended with
   `add(variantId, quantity)`), the same path quick add uses, and sends `jelly:cart-added` so the slide-out bag opens.
3. Data: the live product page passes each recommended product's variants (id, size label, price, stock) through the
   existing recommendation rule (`recommendProducts`), with "same size as the main product" pre-selected when the
   names match (King bed suggests a King mattress).
4. Editor preview uses sample products; tests for size matching, sold-out sizes, keyboard use and axe.

Each added product is its own bag line, priced and stock-checked by checkout like any other line.

### Phase 3: linked add-on lines (cart and order change, only if needed)

Only needed for services that must follow quantity or need their own stock or tax code (for example "assembly per
bed" on a quantity of 3). Adds `parentLineKey` to bag lines, server-side validation that a child line has its
parent, order items with `parentItemId` (migration), grouped display in the bag, emails, admin order page and
refunds. Bigger and riskier; Phase 1 covers the common case.

## Not in scope

Discount codes on add-ons (discounts already apply to the whole order), delivery date slots, free swatch orders.
