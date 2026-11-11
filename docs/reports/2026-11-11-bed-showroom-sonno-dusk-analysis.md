# Large bed showroom: Sonno + DUSK analysis and roadmap

Date: 2026-11-11. Builds on `docs/plans/bed-showroom-theme.md` (Resthaven, Sonno-style, phases 1-5 done 2026-11-05).
References studied in the browser on 2026-11-11: sonno.co.uk (home, Prague divan bed page) and dusk.com (home,
Bedroom room page, Beds collection, Ascot ottoman bed page). We follow **structure and shopping ideas only**:
own name, copy, photos, colours and code. Nothing is copied.

## Short answer

Yes, it is possible, and most of it already exists. About two thirds of what both sites show is already in the
platform (built for Resthaven, Forma, Halo and Diode and the parity work since). Resthaven covers Sonno's home and
product page, but it was finished **before** the newer platform pieces existed (reviews, the new gallery, product page
layouts, collection layouts, quick add, compare, search suggestions, bag count, quantity rules, personalisation), so it
does not use them yet.

What is missing is mostly **DUSK's "large catalogue" side**: a menu with picture tiles, filters by size, storage and
fabric that work on a big catalogue, colours sold as linked products, "Complete the set" add-ons and service add-ons
like assembly, dispatch dates, discount codes and real pay-monthly. Four of these touch the cart, checkout or
database, so they are the real work. The theme itself (look, home page, starter) is the easy part.

Recommended approach: **platform pieces first, theme last** (the same approach as Resthaven, Avenue and the
template programme). Every new piece works for every theme. Then rebuild Resthaven's starter and styles as the
flagship showroom. Never change its id (`jelly-resthaven`) or version.

## What each site does best

| | Sonno (focused bed maker) | DUSK (large home store) |
| --- | --- | --- |
| Strength | Selling **one product type** very well | **Finding things** in a big catalogue |
| Header | Search bar, centred logo, "Free swatches", basket with count; trust row under the menu | Search, account, help, bag; two-row menu; **"Shop by room" menu with photo tiles**; finance and review count bar |
| Home | Hero, category tiles, New and trending, scrolling trust strip, product stories, customer photos, How it works (3 steps), FAQ | Offer hero, Shop by room tiles, product row with stars and review counts, "Discover our collections" carousel, awards, SEO text with Read more |
| Collection | Read more description, filter panel, 3 columns | 80 results, **9 filters** (type, storage, colour, stock, price, fabric, collection, assembly, filling), 7 sorts, SEO links row (Single/Double/King…), promo badge on every card, "from £", stars + count, "More colours & sizes available" |
| Product | Option tabs with big tiles (colour, size, storage, headboard, base), "50% off", **Professional assembly £39.99 Add**, finance line, Pay later, "In real life" customer photos, Why choose, **dimensions table per size (cm and inches)**, finance explainer, service promises, FAQ, sticky Add to basket | Breadcrumb, stars, finance line, **promo code note**, **pre-order dispatch dates**, colour swatches that **link to sibling products**, size buttons, **"Complete the set"** (mattress, sheet, bedside table, each with its own size, "Add this to my order"), fold-outs incl. **"Will it fit?"**, reviews |
| Trust | Trustpilot-style rating, 60-night trial, UK made, 2-man delivery to the room | Review counts everywhere, awards, loyalty points |

**Combined showroom:** DUSK's navigation, collection filters and cross-selling around Sonno's product page
(option tabs, add-ons, dimensions, trust and finance) and its warm, reassuring tone.

## Page by page: reuse, adjust or build

Legend: **Reuse** = exists, set it up in the starter; **Adjust** = exists, needs an option; **New** = platform work.

### Header and navigation
| Element | Status | Where |
| --- | --- | --- |
| Announcement bar with offer | Reuse | announcement |
| Search bar left, logo centre, icons with words, "Free swatches" link | Reuse | header `search-bar` layout, extra link |
| Search suggestions while typing | Reuse | `predictive-search.tsx` |
| Bag count on the icon | Reuse | `bagCount` |
| Trust row under the menu | Reuse | header trust-point blocks |
| Dropdown menus, 3 levels, phone fold-out | Reuse | `menu-tree.tsx` |
| **Mega menu: columns of links + photo tiles ("Shop by room", "Shop by type")** | **New** | menu items need an image; renderer mega panel; phone version |
| Finance / reviews info bar | Adjust | trust row items with a link |

### Home
| Element | Status | Where |
| --- | --- | --- |
| Offer hero with category buttons | Reuse | hero (overlay, spotlight, countdown for sales) |
| Shop by room / Popular categories tiles | Reuse | collection list (grid, bento, carousel) |
| New and trending with stars and review counts | Reuse | product grid + `productCard.showRating` (real reviews) |
| Scrolling trust strip | Reuse | trust badges, scrolling |
| Product stories with benefits | Reuse | image with text + feature columns |
| "Discover our collections" carousel | Reuse | collection list carousel |
| Customer photos ("In real life") | Adjust | photo gallery exists (merchant photos); photos from reviews are **New** |
| Rating summary from real reviews | Adjust | `rating-summary` takes typed numbers; should read the store's real review totals |
| How it works (3 steps), FAQ, newsletter | Reuse | feature columns, FAQ, newsletter |
| Awards strip | Reuse | logo list |
| SEO text with Read more | Adjust | rich text + a "cut to N lines" option (collection header has it) |

### Collection
| Element | Status | Where |
| --- | --- | --- |
| Read more description, breadcrumb | Reuse | collection header |
| Quick links row (Single, Double, King…) | Reuse | Custom content group of small buttons (Halo's concern pills) |
| Sidebar or panel filters, sort, Show more | Adjust | `ProductListBrowser`: filters are only stock, price and colour, worked out in the browser from **every** product of the collection |
| **Filters by any option or tag (size, storage, fabric, type, assembly) with counts** | **New** | filter definitions per store; facets from options/tags |
| **Big catalogues (hundreds of products)** | **New** | the collection page loads all products at once; needs a backend list with filters, sort and pages |
| Card: "from £", was/now, Save, chip, stars + count | Reuse | product card parts |
| Card: promo badge ("Extra 15% off") | Adjust | needs discount codes (below) or a tag-driven badge |
| Card: "More colours available" + colour dots | Adjust | swatches part exists; linked sibling products are **New** |
| Card: second photo on hover | **New (small)** | card media part |

### Product
| Element | Status | Where |
| --- | --- | --- |
| Gallery with lightbox, zoom, side thumbnails | Reuse | `ProductGalleryViewer` |
| Badge on the photo ("60-night trial") | **New (small)** | gallery setting |
| Product page layouts | Reuse | `pageLayout` |
| Breadcrumb, stars + count linking to reviews | Adjust | product information + review summary |
| Option tabs with big tiles, sold-out states, `?variant=` | Reuse | product options "Tabs with tiles" |
| % off label, finance line, sticky Add to basket | Reuse | product-showroom pieces |
| Quantity rules, personalisation | Reuse | built 2026-11-08/10 |
| Back-in-stock form | Reuse | `BackInStockForm` |
| **Colours as sibling products** (DUSK) | **New** | product "family" link; swatches go to the sibling page |
| **Service add-ons** (assembly, old bed removal) | **New, cart + order** | add-on lines tied to the main line |
| **"Complete the set"** (mattress, sheet, bedside with own size) | **New, cart** | product picks + mini option picker + add several lines at once |
| **Dimensions per size, cm/inches switch, diagram** | **New (medium)** | specification rows per variant/size; toggle |
| Why choose, service promises, finance explainer, FAQ | Reuse | feature columns, tabs/chapters, FAQ |
| "Will it fit?" / Delivery / Care fold-outs | Reuse | product info tabs (expandable) |
| **Dispatch dates / pre-order** ("dispatch 27 Dec - 2 Jan") | **New, database** | per-variant dispatch window or lead time; shown on product, bag, order |
| Reviews with summary, list, write form | Reuse | `product-reviews` |
| Review photos | **New, database** | photo upload on reviews + moderation |
| Recently viewed | **New (small)** | browser-only list like compare |

### Bag, checkout and after
| Element | Status | Where |
| --- | --- | --- |
| Slide-out bag, free delivery bar | Reuse | cart drawer |
| Add-on lines shown under their bed | **New** | goes with add-ons |
| **Discount codes** ("Extra 20% applied at checkout") | **New, checkout + database** | no discount engine exists today |
| **Pay monthly / pay later** (Klarna etc.) | **New, payments** | the finance line is text only; Stripe can offer Klarna through the existing PaymentIntents (needs testing per Connect account) |
| Delivery date choice at checkout | **New, checkout** (optional) | 2-person delivery slots |
| **Free fabric swatches** (pick up to N, free order) | **New** | sample products at £0 with a limit, or a request form |

## The new platform pieces, sized

| # | Piece | Size | Touches |
| --- | --- | --- | --- |
| 1 | Mega menu with photo tiles + phone version | M | menu data (image per item), renderer, editor menu form |
| 2 | Catalogue at scale: backend product list with facet filters, sort, pages; filter settings per store (which options/tags) | L | backend route, storefront loader, `ProductListBrowser`, admin settings |
| 3 | Product families (colours as linked products) | M | product field + migration, builder, card + product page swatches |
| 4 | Add-ons: services and "Complete the set" | L | cart lines with a parent, checkout pricing, order lines, emails, admin order page |
| 5 | Dimensions per size with cm/inches, gallery badge, hover photo, recently viewed | M | renderer, registry, small schema |
| 6 | Dispatch dates / pre-order per variant | M | migration, builder, product page, bag, order |
| 7 | Discount codes | L | migration, admin, checkout pricing, Stripe amounts, orders |
| 8 | Pay monthly through Stripe (Klarna) + finance line from the provider | M | checkout, Stripe Connect settings, testing in the sandbox |
| 9 | Review photos + rating section from real totals | M | migration, media upload, moderation, sections |
| 10 | Free fabric swatches | S-M | sample product type + limit, or request form |
| 11 | Delivery date choice at checkout | M | checkout, order, admin; optional |

## Areas that need a major redesign

1. **Collection pages and filtering**: built for small catalogues today (everything loaded and filtered in the
   browser, three fixed filters). A real showroom needs a backend-driven list.
2. **Cart and order model**: lines cannot be linked (bed + assembly + mattress) and there are no discounts.
3. **Menu model**: menu items are text and links only.
4. **Resthaven itself**: its starter and CSS predate the parity work; it should be rebuilt on the newer pieces
   (reviews, gallery viewer, page layouts, collection layouts, quick add, chapters) and pass the current design lint
   with tidy and messy data.

Everything else (sections, editor, rendering, theme SDK) can be reused.

## Recommended phases

Each phase ends with tests, a commit and a check-in, as usual.

1. **Navigation**: mega menu with photo tiles, Shop by room page in the starter, recently viewed.
2. **Catalogue at scale**: backend list with facets, sort and pages; store filter settings; card hover photo.
3. **Product page extras**: product families, dimensions per size with cm/inches, gallery badge, rating section and
   review totals.
4. **Add-ons**: service add-ons and "Complete the set" through cart, checkout, orders and emails.
5. **Money**: discount codes, then Klarna through Stripe (sandbox first).
6. **Delivery**: dispatch dates / pre-order; free fabric swatches; delivery date at checkout if wanted.
7. **Showroom theme**: rebuild Resthaven's starter and CSS combining both sites, new photos (ChatGPT, recorded in
   SOURCES.md), demo catalogue of 40+ beds and mattresses, design lint, Playwright, axe, staging install and a
   signed-in check.

Phases 1-3 and 7 need no checkout changes and give the biggest visible jump. Phases 4-6 change money and orders and
need staging migrations (asked for each time).

## Decisions needed

1. **Upgrade Resthaven or a new showroom theme?** Recommended: upgrade Resthaven (id and version unchanged; stores that
   installed it keep their copy). A new id only if Resthaven should stay as the smaller, simpler bed theme.
2. **Beds only, or bedroom + home (DUSK-wide)?** Affects menu, demo catalogue and copy.
3. **Colours as variants or as linked products?** Variants are simpler and already work; linked products give each
   colour its own page and photos (better for search engines, more work for merchants).
4. **Which money features first?** Discount codes, pay monthly, or neither yet.
5. **Order of phases**: start with 1-3 + 7 (visible, no checkout risk) or with add-ons (4) because they matter most
   for bed sales.
