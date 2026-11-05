# Bed showroom layout (Sonno-style), building on Resthaven

Requested 2026-11-05: a theme with the layout style of sonno.co.uk (UK bed and mattress retailer).

**Found while starting phase 1:** a first version already exists. **Resthaven** (`jelly-resthaven`, commit 7249b7b,
2026-11-04, spec `docs/superpowers/specs/2026-11-03-resthaven-theme-design.md`) is a Sonno-inspired bed theme in
the Store designs catalog. Its header has the logo in the middle and search only as an icon; it has no scrolling
trust strip, trust row, card savings, Read more, rating line or customer photo gallery, and a plain product page.
So phases 3-5 below **upgrade Resthaven** instead of adding a second bed theme (never change its id or version).
Same approach as Jelly Avenue: we follow the **structure and layout ideas**, with our own design,
name, copy and images. Nothing is copied from Sonno (no logo, photos, text, brand colours as-is or code).

Built as a **declarative theme through the Theme SDK** (`theme.json`, `starter.json`, `theme.css`,
assets), so it is also the first full theme made with our own developer tools. Pieces the SDK cannot
express yet are added to the platform first, where every theme can use them.

## What the reference layout does

**Home page**
1. Announcement bar (offer text with a tick icon).
2. Header: search box on the left, logo in the centre, "Free swatches" and basket with count on the right;
   menu row underneath with dropdowns; a row of small trust points with icons (trial, delivery, made in UK).
3. Large hero photo with a headline and three category buttons along the bottom.
4. "Popular categories": photo tiles with the label on a coloured strip at the bottom.
5. "New and trending": product cards with the old price struck out, the new price large,
   "Save £X" underneath and a small chip ("More colours", "Medium firm").
6. A scrolling strip of trust points (0% finance, free delivery, handmade, warranty, trial).
7. Product story: photo beside a list of three benefits with headings, and a button.
8. Rating summary ("4.8/5 from N reviews") and customer photos ("Loved in homes like yours").
9. "How it works" in three numbered steps.
10. Second product story (mattresses, four benefits).
11. FAQ accordion.
12. Footer.

**Collection page:** title, description cut to two lines with "Read more", a Filter button that opens a
side panel (price, size, colour), Sort, three-column product grid, guide text below the grid.

**Product page:** breadcrumb, star rating line, title with the chosen colour, big gallery with a badge
("60 night trial") and "Click to expand", price with "50% off" chip, **options as tabs with icons**
(Colour, Size, Storage, Headboard, Base) showing big tiles, add-ons ("Professional assembly £39.99 Add"),
Add to basket, delivery note, finance line ("Pay £x a month"), scrolling trust strip, customer photos,
"Why choose" benefits, dimensions table, finance explainer, service promises, FAQ, sticky add to basket.

## What we already have

Announcement bar, header with dropdown menus, hero with buttons, category grid, product grid, sale badge
and struck-out price, image with text, feature columns, testimonials, FAQ, trust badges, collection
toolbar with filter panel and sort (Avenue), product info tabs, specifications table, swatches,
store visit, slide-out bag, fonts (Playfair Display + Nunito Sans fit this style).

## What is missing (platform additions)

| Piece | Where |
| --- | --- |
| Scrolling trust strip (marquee, pauses on hover, still for reduced motion) | new section |
| Header layout "search left, logo centre, icons right" + trust row under the menu | header options |
| Product card: "Save £X", "% off" and a small chip from a product tag | card settings |
| Collection description cut to N lines with "Read more" | collection header option |
| Rating line (stars + "4.8/5 from N reviews", merchant-entered) | new block / section |
| Product options as icon tabs with large tiles | product options layout setting |
| "% off" chip next to the price, finance line ("or £x a month") | product price options |
| Sticky add-to-basket bar on scroll | product page option |
| Customer photo gallery | image gallery section |
| Add-ons on the product page (assembly etc.) | **needs cart work: separate decision** |

## Phase 1 done (2026-11-05)

Trust badges gain `trust-point` blocks (16 icons from `storefront-schema/src/store-icons.ts`, optional link) and a
Scrolling layout (pauses on hover/focus, still for reduced motion, second copy hidden from screen readers). Header:
"Search bar, logo in the middle" layout, words beside icons, an extra link (e.g. Free swatches) and a trust row from
trust-point blocks. New sections Rating (`rating-summary`, merchant-typed numbers, hidden at 0) and Photo gallery
(`image-gallery`, grid or scrolling row). Collection header: "Long descriptions" cut to 2-4 lines with Read more.
Product cards: live cards now get the compare-at price (they never did: the Sale badge only showed in previews),
"Save X" / "X% off" chosen in theme settings > Product cards > Savings, and a chip from a `label:` product tag
(`features/storefront/product-card-data.ts`). Checked on `/theme-preview/*` (Minimal desktop, Avenue phone) with
a temporary demo; not checked in the signed-in editor.

## Phase 2 done (2026-11-05)

Product page pieces in `storefront-renderer/src/sections/product-showroom.tsx`. "Product options" gains the styles
**Large tiles** and **Tabs with tiles** (one tab per option showing the chosen value and its colour or photo; arrow
keys, Home and End move between tabs; missing required choices are marked; a single option falls back to tiles) and
"Tiles per row" (2-4, two on phones); tile pictures come from the value's swatch image, its preview photo or its
colour. "Product title and price" gains a sale label beside the price (% off or Save amount, only when the "was"
price is higher; uses the theme's badge colours) and a finance line ("or {amount} a month for {months} months",
merchant-chosen months 0-60, 0 = off, payment rounded up, optional link). "Add to cart" gains a bar that stays at the
bottom of the screen once the page's own button has scrolled away (picture, name, price, button; "Choose options"
opens the first tab still waiting for a choice); the page gets room at the bottom while it shows. The product page
now passes price amounts and a formatter (`pricingFor()` in `features/storefront/product-presentation.ts`). The
Rating section already worked on product pages. Add-ons (assembly etc.) not built: they change the cart and orders.
Checked on `/theme-preview/*` (Minimal desktop + 390px, Avenue desktop) with a temporary demo; not checked in the
signed-in editor.

## Phase 5 (2026-11-05): QA done locally, staging install waiting for approval

Playwright spec `jellyshops/e2e/jelly-resthaven-theme.spec.ts` (18 tests): every page at 1280/768/390 without overflow,
unnamed controls or page errors; axe WCAG 2.1 A/AA **with colour contrast** on every page (the rendered page is copied
into its own tab, because the preview frame runs no scripts of its own); Beds dropdown and store links, readable
footer, "% off" and the add to basket bar, cart totals. All pass, and the Minimal and Avenue specs still pass (20).
Found and fixed: the add to basket bar never appeared in the editor/theme preview (its IntersectionObserver belonged to
the preview frame, which runs no callbacks) and missed jumps past the button (an observer only reports changes); it
now listens to scroll on the page's window and checks whether the button is above the screen. Launch checklist:
`docs/jelly-resthaven-launch-checklist.md`. Not done: install on a staging test store (needs the user's go-ahead).

## Phase 4 done (2026-11-05)

Other pages and phone polish, all in Resthaven's `theme.css` (regenerated `jelly-resthaven.css`) and starter:
**footer fixed** (its text took the page background colour on a white panel and was unreadable on live stores since
the theme was made): now a plum band with the newsletter row, store text and three link columns (Shop, Help, About,
linking the pages a new store gets), normal font weight (an old shared rule made header and footer weight 800).
Bag: full-width page with line cards, quantity stepper, sticky order summary; one column under 900px. Search and 404
use the full width instead of the old 780px white card. Product page: first photo full width of its column, quantity
and buttons in a row, outlined Buy now. Form fields, primary/secondary buttons and headings for account, checkout and
contact pages use the theme colours. New preview page `/theme-preview/jelly-resthaven` (sample beds, all pictures are
the theme's own bedroom photo, the theme's own menu via `useStarterMenu`). Checked there at 1280 and 375px (home,
product, cart with items, search, 404, footer). **Not checked:** account, checkout and order pages (they need a
running store), the signed-in editor.

## Phase 3 done (2026-11-05)

Resthaven's starter (`storefront-themes/src/themes/jelly-resthaven/starter.json`) now uses the phase 1-2 pieces:
search-bar header (words beside icons, "Help choosing" link to the FAQ page), a main menu shipped with the theme
(Beds dropdown: Divan, Ottoman, Upholstered; Mattresses; Headboards; Shop all; Help; bed types search the catalogue
until the merchant points them at collections), a light trust row under the menu on home/collection/product/cart/page
(secure checkout, delivery and returns pages, help choosing), a purple scrolling strip on home, collection and product,
home in the showroom order (hero, categories, New and trending with Shop all, strip, story, Rating, Photo gallery,
How it works in three steps, second story, benefits, FAQ, newsletter), collection descriptions cut to two lines and a
three-column grid, product options as tabs with tiles, "% off" label, sticky "Add to basket" bar, "About this bed",
"Dimensions and details". Rating starts at 0 and the gallery has no photos, so both stay hidden on a live store until
the merchant fills them; trust points make no delivery, trial or warranty promises (merchants add their own); finance
is off (0 months). The old "Bedroom navigation" link row is no longer placed (its recipe stays in theme.json so
existing stores keep working). Platform changes that made this possible: `starter.json` can carry `menus`; menu links
can be store paths (`/search?q=…`), put under the store's address by the header, accepted by the Navigation form and
the backend menu service. Resthaven theme.css: full-width strip/specs/rating/gallery on the product grid, light trust
row, purple strip, spaced old price, grid follows "columns", plum tiles/tabs, one-line trust row on phones, no menu
arrow marker; `jelly-resthaven.css` regenerated. Theme id and version unchanged (1.0.0); stores that already
installed Resthaven keep their own copy. Checked in the CLI preview (`jelly-theme dev`) at 1280 and 375px; the
conformance suite caught two search boxes with the same name on the search page (header search now "Search the store").
Not checked: a real install on a staging store, the signed-in editor.


1. **Platform pieces for home and collection:** marquee, header layout + trust row, product card
   extras, "Read more", rating line, customer photo gallery. Tests for each.
2. **Platform pieces for the product page:** option tabs with tiles, "% off" chip, finance line,
   sticky add to basket. (Add-ons only if agreed: they change the cart and order.)
3. **Upgrade Resthaven** (`storefront-themes/src/themes/jelly-resthaven/`): use the phase 1-2 pieces in its
   starter (search-bar header with trust row, scrolling strip, rating, photo gallery, card savings, Read more),
   reorder the home page as above, own copy and images. Regenerate `jelly-resthaven.css`. Passes the conformance suite.
4. **Other pages:** cart, search, information pages, 404, account restyle; phone and tablet polish.
5. **QA:** CLI preview at 1280/820/390, accessibility (axe), Playwright spec, upload + install on a
   staging test store, compare with the preview, launch checklist, docs.
