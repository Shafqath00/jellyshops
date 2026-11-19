# Express Bed: bed showroom store

Date: 2026-11-19. Store "Express Bed" (`/express-bed`, id `store-05275cd4-ee12-462f-89b5-093b93f5da32`, GBP), created
under the owner's account on staging, built on the Resthaven theme with the "Midnight oat" style. References:
sonno.co.uk and dusk.com (structure and shopping patterns only; no names, copy, logos or images taken). Builds on
`docs/reports/2026-11-11-bed-showroom-sonno-dusk-analysis.md`.

## Reference comparison

| Area | Sonno does well | DUSK does well | Adopted for Express Bed |
| --- | --- | --- | --- |
| Home order | Offer bar, hero, quick links, popular categories, new and trending, trust icons, feature stories, customer photos, 3-step how it works, FAQ, newsletter | Offer bar, seasonal hero, room tiles, product rows with stars, collection carousel, long SEO text | Announcement, hero with two buttons, 4 category tiles, best sellers with stars, bundle story, shop the room, headboard and mattress stories, trust row, product spotlight, reviews, brand story, customer photos, newsletter |
| Navigation | Short product-type menu (Beds, Storage beds, Kids, Headboards, Mattresses, Furniture), "Free swatches" link | Huge mega menus: by type, by size, by colour, by collection, room tiles | Beds / Mattresses / Headboards as large menus (type and size columns plus photo tiles), About, Contact; "Visit our showroom" link in the header |
| Collection | Read-more description, filter panel, 3 columns | 9 filters with counts, 7 sorts, size quick links, badges, "from" prices, stars | Sidebar filters with counts (size, storage, fabric, comfort, type, price, stock), sort, sale badges, stars, % off |
| Product | Big option tiles, sale label, finance line, dimensions per size, service promises, sticky add to basket | Breadcrumb, stars, colour siblings, size buttons, "Complete the set", fold-outs, reviews | Gallery with zoom, size tiles (Single/Double/King/Super King), price per size with was-price and % off, promise box, fold-out description and details, dimensions per size (cm/inches), reviews, related, recently viewed |
| Trust | 60-night trial, 5-year warranty, 0% finance, free 2-person delivery, UK made, Trustpilot count | Review counts everywhere, awards | Two-person delivery in 5 to 7 days, pay with Klarna, a showroom to visit (owner's terms: no delivery threshold, no sleep trial, no guarantee) |
| Look | Bright, promotional, British, short benefit copy | Stylish, value-led, playful collection names | Calm and premium: warm oat, midnight ink and brass, Cormorant Garamond + Figtree, pill buttons, warm photography |

Service add-ons are built as optional extras on every bed: Professional assembly (£39) and Remove my old bed (£29)
(see `docs/plans/product-add-ons.md`). Not adopted yet: "Complete the set" with add buttons (plan Phase 2), Klarna at
checkout (copy mentions it, Stripe is set up for cards only), free swatch orders, dispatch dates.

## What was built

- Store created through `POST /api/stores` from the signed-in admin (the onboarding flow only creates a first store;
  `/new` is the storefront of the existing store "new").
- Resthaven starter installed, then the draft rewritten: home layout and copy, collection help band, header,
  announcement (4 rotating lines), footer links, main menu with photo tiles, theme style Midnight oat, slide-out bag
  with a free-delivery bar at £299.
- Collections Beds, Mattresses, Headboards; 18 test products (6 each), 4 size variants each with stock, per-size
  prices, some with was-prices, specifications with W x L x H per size, filter tags.
- Pages: About, Contact (shown above the built-in contact form), Questions and answers, Delivery, Returns,
  Privacy and Terms (placeholders), all published. 5 sample reviews, published.
- Published. Checked at 1440 and 390 px: home, Beds collection (size and type filters from the address), product
  page (size choice, price per size, add to basket, slide-out bag), contact, large menu; admin products, collections,
  menus and the theme editor.

## Test data markers

Every test product has the tag `test-product`, SKUs starting `TEST-EB-`, and a description starting "TEST PRODUCT".
Reviews say "Test review"; home testimonials say "(Sample review.)"; delivery times, address and phone are placeholders.

## Update 2026-11-19 (owner's answers)

- No free-delivery threshold, no sleep trial, no guarantee: all removed from copy, pages, product details and the bag
  (no free-delivery bar). Finance is Klarna: announcement, hero, trust row, FAQ and About say so. **Klarna is not yet
  offered at checkout**; enable it in Stripe (payment methods on the PaymentIntent) before relying on the copy.
- Assembly and old bed removal added as priced extras on beds; checked to the bag (King + assembly = £712.99).
- New admin page `/admin/stores/new` ("Add another store", linked under the store switcher and in the account menu):
  name, web address with a live availability check, country (sets the currency) and an optional starting design.
  Checked in the signed-in admin up to the form (taken and free addresses); not submitted, so no extra store exists.

## Re-running

`node scripts/express-bed/build-plan.mjs` writes `plan.json` (needs built packages). `install-in-browser.js` applies
it from a signed-in admin tab (it reads the page's own session; see the file header). It skips what exists and
rewrites layouts, menu and theme settings, so re-running after editing the plan updates the store.

## Known issues seen

- Admin product list shows a different variant's price per product (variants arrive unordered; the storefront
  already picks the cheapest).
- Bag line reads "King · Size: King" (variant title plus option).
- The local Functions emulator returned a few one-off 500s on first load (catalogue browse, navigation context); they
  did not repeat.
