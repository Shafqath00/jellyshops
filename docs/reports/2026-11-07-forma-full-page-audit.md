# Jelly Forma: full-page audit against Hyper

Audit date: 7 November 2026. Follows `2026-11-07-hyper-forma-visual-audit.md`, which covered only the home and product pages. This audit covers all seven preview pages (home, collection, product, cart, search, information page, 404) plus the shared header and footer, at 1280, 768 and 390px. No theme code was changed during the audit; findings 1 and 2 were fixed afterwards (see the end).

## How it was measured

- **Forma:** the local preview `/theme-preview/jelly-forma` (port 3300), every page and device tab, measured inside the preview frame with a script that records each section's position, height, heading sizes and fonts, card widths, buttons and fields. Full-page screenshots were taken. The working files are in the session scratchpad (`audit/shots/forma-*.png`, `measurements.json`); they are not committed.
- **Hyper:** https://hyper-theme-demo.myshopify.com, the same pages (`/`, `/collections/all`, `/products/arc-chair`, `/cart`, `/search?q=chair`, `/pages/about-us`, a missing page), measured in a real browser one page at a time. A faster headless run was blocked by the demo's Cloudflare check. That run collected no Hyper data, and the check was not bypassed. Hyper was measured in full at 1280px. At 768 and 390px only the header, collection and product pages were measured.
- **Limits:** Forma's sample catalogue has 4 products and Hyper's has 98, so grid density differs partly because of data. Hyper's cart held a different product. The Forma screenshots were taken by growing the preview frame to the page height, which slightly changes sections sized by screen height (none on these pages except the hero, which has a fixed height).

## Summary

The home page and the desktop product page now look close to Hyper. The other pages do not. The biggest problems:

1. **Tablet (768–1023px) has no layout of its own.** The header breaks and the product page falls back to the phone layout with large gaps.
2. **Page titles are hero-sized everywhere.** "Your bag", "Search", "Our story" and the collection title use the 70px hero heading. Hyper uses 28–40px for these.
3. **The footer heading uses the page H2 size** (44px desktop), so the footer looks louder than the page content.
4. **Collection and search have no filter or sort controls**, and the collection page has no breadcrumb.
5. **Several components are unstyled or wrongly weighted**: the cart's quantity stepper and Remove button, the newsletter checkbox, the FAQ arrows and the card buttons.

## Findings by severity

### High: visibly broken

| # | Where | Forma | Hyper | Cause | Fix |
| --- | --- | --- | --- | --- | --- |
| 1 | Header, 768–1023px | Search box squashed to ~70px ("Sea"), logo wraps to two lines, every nav item wraps word by word ("Shop / by / room") | Hamburger, logo, icons on one row; full-width search on the second row; header 145px | `theme.css` has header rules only for ≥1024px (`min-width: 64rem`) and <768px (`max-width: 47.9375rem`); in between the header is a plain flex row | Use the phone header (hamburger + search row) up to 1023px, or give tablet its own compact two-row layout; add a tablet assertion to the spec |
| 2 | Product page, tablet and phone | Each part is its own section with full section padding: gaps of 80–100px between thumbnails → title, delivery note → Finish, Finish → Quantity, Add to cart → description. On tablet the gallery and details stack in one column | Tablet keeps gallery and details side by side. On phone, options → quantity is 20px and Add to cart and Buy now are 16px apart | The grouped purchase-column grid only exists `@media (min-width: 64rem)`; the ≤24px gap check covers desktop only | Apply the grouped layout (zero section padding between product parts) at every width; two columns from 768px; extend the gap assertion to 768 and 390px |
| 3 | Cart quantity stepper | Square boxes; the number overlaps the left border; buttons a different height from the number box | Single pill (− 1 +), 90×38px | Cart stepper inherits generic field rules; no Forma rule for `.jelly-cart-line` quantity | Style the cart stepper like the product stepper as one pill |
| 4 | Newsletter (home) | Large white unstyled square checkbox; "Email" label sits outside the field on the left; Subscribe looks faded (disabled in preview) | Field + Sign Up pill on one line; small consent text | `.jelly-newsletter input[type=checkbox]` sized to the 44px touch target with no visual style | Draw a 20px custom checkbox inside a 44px hit area; label above or as placeholder; show the button at full contrast in previews |

### Medium: unprofessional but working

| # | Where | Forma | Hyper | Fix |
| --- | --- | --- | --- | --- |
| 5 | Page titles (cart, search, page, 404, collection) | 70.4px desktop / 44px tablet+phone, same as the hero | Cart 40px, collection 40px, search 32px centred, 404 32px centred; 28px on tablet/phone | A "page title" size (≈40px desktop, 28px phone) separate from the hero H1 |
| 6 | Footer | "Help & information" at 44px; one link column; divider spans only the left ~45%; 434px tall with mostly empty space | Newsletter + three 16px-headed link columns + contact strip; 441px tall but full | Footer column headings at body/H4 size; support several link columns; full-width divider |
| 7 | Collection page | Centred 70px title, banner photo, 130px gap, then a 3-column grid of 378px cards; no filters, sort, product count beside the grid or breadcrumb | Breadcrumb, 40px left title, filter sidebar (availability, price, colour), sort, grid/list toggle, 4 columns of 209px cards (3 on tablet, 2 on phone) | Collection toolbar (count, sort, filter button), breadcrumb, 4 columns on desktop; smaller left-aligned title |
| 8 | Product cards (all grids) | Square-cornered outlined "View product" boxes; the card with swatches pushes its button 30px lower than its neighbours | Pill buttons; parts aligned across a row | Pill (or text) card button matching the theme; pin the button to the card bottom so rows line up |
| 9 | Cart actions | "Remove" is a large black primary pill; "Continue shopping" has the same weight as "Checkout"; "Order summary" at 44px; subtotal "£1197.00" without a thousands separator | Small × to remove; only Check out is primary; free-shipping progress, order note and shipping estimate | Remove as a text/icon button; Continue shopping as a secondary/text link; summary heading at H3/H4; format money with separators |
| 10 | Search page | Search field only 218px wide, with the button overlapping its edge; result count touches the field; result cards 278px (different from collection 378px) | 650px search field with category select; filters and sort like the collection; same card width as collection | Full-width search row; same grid and toolbar as the collection |
| 11 | Product details | Grey "Add to cart" with no message (disabled until a finish is picked); Walnut greyed without explanation; "Quantity" label inline with round −/+ but a squarer number box; brand "Jelly Forma" on the page but "FORMA STUDIO" on cards; description loose under the gallery with no headings | Quantity pill beside Add to cart; Buy now below; Specifications / Product details / Materials & care accordions; "Perfect match with" upsell | Say "Choose a finish" next to the disabled button or preselect the first option; mark sold-out values; one stepper style; one vendor value; description and specs as accordions |
| 12 | FAQ | Browser-default ▶ markers | Custom + / − icons | Hide the default marker and draw a theme icon |
| 13 | "You may also like" | 3 cards in a 4-column row, leaving the 4th empty | Fills the row | Match the column count to the number of products, or show 4 |

### Low

| # | Where | Note |
| --- | --- | --- |
| 14 | Information page | Paragraph runs straight into the next heading (~20px); needs space above H2 in rich text |
| 15 | 404 | Only one button; Hyper also shows a search link and a service strip. Adding search or popular products is cheap |
| 16 | Feature columns (home) | Text only; Hyper's equivalent uses icons. Without them the section reads as a wall of headings |
| 17 | Tablet home | Feature columns wrap 2 + 1, leaving an orphan; use 3 or 1 |

## What matches Hyper

- Shared content edges: every page's content starts at the same left edge (49px desktop, 17px phone), and nothing overflows sideways at any width.
- Home page header, category strip and hero at desktop and phone, as fixed in the earlier refinement.
- Desktop product composition: gallery with thumbnail rail and a grouped buying column.
- Fonts load correctly (Manrope). Hyper uses Instrument Sans with 15px body text; Forma uses 16px, which is fine.

## Recommended order

1. **Tablet layer** (findings 1, 2, 17): header and product layout for 768–1023px, plus assertions at 768px in `e2e/jelly-forma-theme.spec.ts`. Largest visible defect, theme CSS only.
2. **Type and footer** (5, 6, 14): page-title size, footer heading size, link columns, divider.
3. **Components** (3, 4, 8, 9, 12): cart stepper and actions, newsletter checkbox, card button, FAQ icon.
4. **Collection and search toolbars** (7, 10): need renderer support (filter and sort UI exist for Avenue's collection toolbar and should be reused, not rebuilt).
5. **Product page content** (11, 13): accordions for details and specifications, disabled-button message, upsell row.

Steps 1–3 are theme CSS only. Steps 4–5 need renderer or section changes and should be reviewed before building.

## Checks to add

Geometry checks that would have caught these:
- Header height ≤ 160px and no nav item taller than one line, at 768px.
- Product parts gap ≤ 24px at 768 and 390px.
- Page-title font size ≤ 44px on cart, search, page and 404 at 1280px.
- Footer headings ≤ 24px.
- Card buttons in the same row share one top position.

## Fixed after the audit

- **1 (tablet header)** and **2 (product spacing on tablet and phone)**: fixed in `jelly-forma/theme.css`. Tablet header 100px with a wrapped menu → 121px with menu button, logo, icons and full-width search. Tablet product page: two columns, page 2793 → 1877px tall. Phone product page: 3054 → 2813px, parts 0px apart (plus the 24px top spacing of options and purchase). Desktop page heights unchanged on every page. Covered by the new test "tablet and phone: compact header and continuous purchase column".
- **Phase 1 polish** (same day): 3 cart stepper is one pill; 4 newsletter has email and Subscribe on one row, a drawn 24px checkbox and a small consent line; 5 page titles (collection, cart, search, page, 404) are 28–40px instead of 44–70px, collection header left-aligned; 6 footer headings at body size, two link columns (new "Shop" column in the starter), divider across the footer; 8 card buttons are pills pinned to the card bottom so a row lines up; 9 Remove and Continue shopping are text links, order summary heading smaller, the box fits its content, preview prices formatted "£1,197.00"; 12 FAQ uses a +/− icon; 14 space above headings and bullet lists in page text; 17 three feature columns side by side on tablet. New Playwright test "polish: …" checks each of these.
- Not yet fixed: 7 and 10 (collection/search toolbar, 4 columns), 11 and 13 (product page content), 15 and 16 (404 extras, feature icons). These are Phase 3.
