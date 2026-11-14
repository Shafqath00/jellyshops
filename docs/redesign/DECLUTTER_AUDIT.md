# Declutter audit (2026-11-14)

Goal: each page opens with only what most merchants need; everything else is one click away (fold-out, menu, tooltip or detail page). Theme, tokens and components unchanged; only layout, density, grouping and defaults.

Sources: the owner's screenshots (Products, Pages, Blog posts, Files, Custom content, Orders) and a signed-in walk-through on staging data.

## Product create / edit (worst page)

| Too much | Keep | Moved / hidden |
| --- | --- | --- |
| A jump bar of six section links above the form | Title, description, photos, price, stock | Jump bar removed (the page is short enough to scroll) |
| A help paragraph under every card title and every field | Card titles | Card help moved into an (i) tip by the title; field help shows while the field is in use; errors always show |
| "Optional" / "Required" chips on every field | "Required" on the two required fields | "Optional" chips removed (everything else is optional) |
| Low stock warning always open | Track stock, quantity, stock status | Low stock warning moved into "SKU, barcode and low stock warning" (opens itself on an error or a saved value) |
| Shipping always open (weight, size, customs) | — | Shipping is a closed card with a one-line summary; opens on an error |
| Readiness card listing all six checks, done or not | Progress and what is still missing | Done checks hidden |
| Three header buttons (Preview, Duplicate, Archive) | Preview | Duplicate and Archive/Restore under "More actions" |
| Save bar always shown, even with nothing to save | Save bar for new products, drafts (Publish) and unsaved changes | Hidden on a saved, active product until something changes |
| "More details" heading + subtitle | "More options" label | Specifications, personalisation, quantity rules stay closed cards |
| Variants card hint (a paragraph of instructions) | "6 combinations, made from your choices." | Instructions in the (i) tip |
| Inventory card on variant products (only a link to the variants) | Variants table | Card hidden when the product has variants |
| "Set the same value for many combinations" box always open | — | Closed fold-out; opens by itself from 6 combinations |
| Save bar taking two rows on phones | Buttons | Status line hidden on phones unless there are unsaved changes |

Kept on purpose: the search engine preview stays visible (its fields already sit behind "Edit search engine listing", as in Shopify); "Custom data" stays open when the store has defined fields (merchants set those fields up to fill them in, and errors must show beside them).

## Orders list

| Too much | Keep | Moved / hidden |
| --- | --- | --- |
| 8 columns incl. Items and Tags | Order (number + date), customer, payment, fulfilment, total | Items and Tags off by default, back from the new "Columns" menu |

## Order detail

| Too much | Keep | Moved / hidden |
| --- | --- | --- |
| Seven side cards (customer, shipping method, shipping address, billing address, tags, customer note, emails) | One "Customer" card: name, email, phone, shipping address, shipping method | Billing address behind "Billing address"; customer note card only when there is a note; email log behind "Emails sent (n)" (opens itself when one failed) |
| "SKU Not recorded · Physical item" on every line | SKU when there is one, "Digital delivery" when digital | Empty SKU and "Physical item" wording dropped |
| Payment reference always shown | Payment rows, transactions, refunds | Reference behind "Payment reference" |
| "Discounts: Not recorded", "Taxes: Not recorded" rows | Rows that have a value | Rows with no value hidden |
| Timeline with every event (31 on one test order, mostly email retries) | Latest 8 | "Show all 31 events" |
| Tags card explanation line | Tag field | Line removed |

## Products list

| Too much | Keep | Moved / hidden |
| --- | --- | --- |
| 7 columns (incl. Type, Brand or supplier showing "None") | Product (photo + name), status, stock, price, actions | Type and Brand off by default ("Columns") |
| Up to five filter dropdowns + sort | Stock filter, sort | Type, brand, collection and tag under "More filters" (with a count of the ones in use) |

## Other lists

| Page | Moved / hidden |
| --- | --- |
| Customers | Email marketing, Location and Tags off by default (Columns); name, orders, amount spent stay |
| Inventory | "Held by checkouts" off by default; "Waiting for stock" shows only when shoppers are waiting |

## Checked, left as is

| Page | Why |
| --- | --- |
| Pages, Blog posts, Custom content | Already a list on the left and one form on the right; one primary action |
| Files | Five columns, one action per row; fine |
| Collections, Reviews, Settings, Payments, Home | Already short; the earlier redesign made them calm |
| Analytics | There is no separate page (figures live on Home) |

## Shared changes

- `IndexTable` (`components/admin/index-table.tsx`): column option `defaultHidden` + a "Columns" menu (choice remembered per list in the browser), and `moreFilters` / `moreFiltersActive` for a "More filters" menu. Every list can use them.
- `admin-kit.css`: toolbar menu panel; `.jk-side-sub` (a part inside a side card) and `.jk-side-more` (a small "show more" fold-out).
- Product editor `Section` / `Field` (`product-builder/sections/section-parts.tsx`): help as an (i) tip, `description` for a short visible fact, `forceOpen` for closed cards with errors; field hints on focus.
</content>
</invoke>

## Verification (2026-11-14)

- Typecheck clean; admin, product, order and commerce tests pass (tests updated only where the visible UI changed on purpose: Duplicate is under More actions; a saved product shows no Save button until something changes; the SKU fold-out has a new name).
- Signed in on staging store "new" at desktop, with phone (390px) and tablet (820px) frames for the product editor and order page: no sideways scroll.
- Flows: created a product with variants (Size S/M) as a draft, edited a variant's stock and saved, archived it from More actions (confirm dialog); the earlier pass created and edited a simple product, changed stock, bulk-edited a price and bulk-archived. Orders: searched and filtered lists, turned a column on and off, opened More filters, posted an internal comment on test order JS-000004.
- Left on staging: archived test products "ZZ Redesign Test Product v2" and "ZZ Declutter Variants", and one staff comment "ZZ redesign check: internal comment" on test order JS-000004.
- Screenshots: docs/redesign/screenshots/before-declutter-* and after-declutter-*. Order list screenshots are not saved (real customer emails).
