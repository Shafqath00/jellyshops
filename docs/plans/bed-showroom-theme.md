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

## Phases

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
