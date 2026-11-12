# Bed showroom: why the theme is not professional yet, and the fix

Date: 2026-11-12. Store checked: `new` (`http://localhost:3000/new`), theme Resthaven (`jelly-resthaven`).
References: DUSK (dusk.com) and Sonno (sonno.co.uk), home pages and one Sonno product page.

## Short answer

The theme code is not the main thing you are looking at. Your store `new` still uses the **page layout from before the Resthaven redesign** (it was published earlier and published designs never change), but it now gets the **new Resthaven stylesheet**, which was written for a different set of sections. So you see an old structure drawn with CSS that no longer expects it. The redesigned theme in `/theme-preview/jelly-resthaven` is noticeably better than your store.

That is the symptom. The root cause is architectural, and it is why every theme so far has needed "endless CSS fixes":

1. **A theme's CSS and the page structure it was written for are not linked.** Nothing records which structure a store has, and nothing moves old stores onto a new structure.
2. **Pages have no layout structure.** A template is a flat list of sections. Two-column layouts (product page, collection with filters) are faked in CSS by listing section types in `:has()` selectors. Any section, setting or order the CSS author did not expect breaks the page.
3. **Themes are skins over shared markup.** A theme restyles about 330 renderer class names through six CSS layers and five token families. A fix in one layer can be undone by another.
4. **Sections do not cope with real data.** Empty data makes sections disappear, grids leave holes, and the preview fills data differently from the live store.
5. **There is no page rhythm.** Every section pads itself, gaps vary from 96 to 208px, and the whole page is one background colour.
6. **Checks run on the preview, never on a merchant's store,** and they check mechanics (edges, contrast), not composition (holes, repetition, empty pages).

And honestly: DUSK and Sonno look professional partly because of **content** (real photography shot the same way, 8 to 24 products on the home page, prices with savings, thousands of reviews, offers). Your store has 3 products with three different photo styles and is named "new". A theme can handle weak content better than ours does, but it cannot create it.

## What I checked

- Your Chrome: `/new` (home), `/new/shop`, `/new/products/utah-ottoman-divan-bed` at 1536px.
- A separate local browser (your Chrome window would not shrink): your home at 390px; DUSK, Sonno and your home at 1440px and 390px with the same measuring script; the Resthaven preview home at 1280px; a Sonno product page at 1440px.
- Code: Resthaven `theme.css`, the renderer's product sections, the live and preview product pages.
- Not checked this time: tablet width, bag/checkout/account on `new`, DUSK product pages (DUSK showed a cookie banner; nothing was clicked).

## What your store shows today

| Page | What is wrong | Why |
| --- | --- | --- |
| Home | "Popular categories" shows the **same photo four times** | Old starter recipe used one `bedroom.png` for every tile. The redesign replaced it, but `new` still has the old one. |
| Home | Same bedroom photo used 5 times down the page | Same: old starter content. |
| Home | Hero runs edge to edge but has rounded bottom corners; on phones three full-width pill buttons stack over the photo | New hero CSS meets an old hero set-up. |
| Home | "New & trending" shows 3 products in a 4-column grid (empty slot); on phones the third card sits alone | Grid does not adapt to the number of products. |
| Home | Gaps between sections are 96, 192, 113, 192, 208, 192, 208, 132px | Each section adds its own padding top and bottom; nothing manages the gap between neighbours. |
| Home | Whole page is one oat colour; two text-only "column" sections in a row | No banding between sections in the old layout; the theme does not provide it automatically. |
| Collection | Plain "All products" title, Filter button, dark scrolling strip mid-page | Old layout (the redesign has a photo banner, a filter sidebar and no dark strip). |
| Product | **The dark scrolling trust strip is squeezed into the buying column**: icons missing, text cut off | Theme CSS (`theme.css` lines 429-432, 497) moves any `trust-strip` into the buying column and expects the new "row" layout; this store has the old dark "scroll" one. |
| Product | **The page ends right after Add to basket**: description, specifications and "You may also like" render nothing | Product has no description/specs; related products on the live store need a shared collection or category (`product-client.tsx:77`), while the preview takes any other product (`template-preview.tsx:54`), so it always looks full in the preview. |
| Product | Product photos: blue headboard on grey, mattress cut-out on white, beige bed in a room | Merchant photos; the theme has no treatment for mixed photo styles. |

## What DUSK and Sonno do (measured)

| | Ours (`new`) | Sonno | DUSK |
| --- | --- | --- | --- |
| Products on the home page | 3 | 8 | 24 |
| Images on the home page | 10 (5 the same) | 31 | 160 |
| Section backgrounds | 1 (oat) | sand / white / sand bands | brown / sand / off-white bands |
| Section headings | 44px light serif, all the same | 36px bold serif, centred | 20-24px sans; the photos carry the page |
| Product card photo | 4:3, no card | square, white card, info box of equal height | square, white card, equal height |
| Card content | name, price | name, was/now price, "Save £", colour/firmness chip | name, colours, price, stars + count, offer badge |
| Buttons | 50px pills | 32-38px, 6px corners, one brand colour | 39-46px pills, uppercase |
| Header | 134px | 220px: search, logo, basket, menu, promise row | 221px: two menu rows + promise row |
| Product page | 7 sections, layout made by CSS | one "main product" section holding gallery and buying column, then full-width bands with alternating backgrounds | — |

The structural point is the last row. On Sonno (a Shopify theme), the gallery, options, add-ons, Add to basket and payment box are **one section that owns its own two-column layout**. Everything below is full width and uses one shared spacing class (`section-py`) and a background class (`bg-primary`). Layout and rhythm come from structure, not from CSS that guesses which sections will be next to each other.

## Root causes, in order of impact

### 1. Theme CSS and page structure drift apart (no structure version, no migration)

- A published design is frozen. A theme's CSS is not: every store gets the newest stylesheet.
- The Resthaven redesign (phases 1-6) rewrote both the CSS and the starter page layout. Stores installed earlier kept their old layout but got the new CSS. Nobody can tell which structure a store has, so the CSS cannot adapt, and there is no step that moves a store to the new layout.
- The theme rule "never bump a theme's `version`" (published stores pin it) makes this worse: version cannot be used to mark structure changes.
- The tools exist in part: the Theme SDK has migrations (`applyThemeMigrations`, upgrade preview/rollback), but only for uploaded theme packages, not for built-in folder themes like Resthaven.

### 2. Templates have no layout structure

- A template is an ordered list of sections. Two-column pages are built in CSS, for example Resthaven `theme.css:431`:
  `main:has(> [data-section-type="product-gallery"]) > :is([data-section-type="rating-summary"], …, [data-section-type="trust-strip"], …) { grid-column: 2 }`
- Every combination of section, setting and order is a new case for the CSS author. A merchant adding, moving or restyling a section creates a layout nobody designed. That is the "random CSS fixes" loop.
- Shopify themes solve this with composite sections (main product, main collection) whose blocks live inside the section's own markup.

### 3. Themes restyle shared markup through too many layers

- Layers loaded for a storefront: `globals.css` (870 lines), `storefront-base.css` (1586), `section-defaults.css` (284), `theme-kit.css` + `theme-kit-late.css` (411), the theme file (Resthaven 567), plus inline styles from section and block settings.
- Token families in Resthaven's CSS alone: `--j-*` (143 uses), `--jelly-*` (141), `--rh-*` (200), `--store-*` (59), `--theme-*` (50).
- The renderer emits about 334 `jelly-*` class names, and any theme may target any of them. There is no published list of the parts a theme is allowed to style, so themes reach into internals and break when the renderer changes.

### 4. Sections are not built for real merchant data

- Data-driven sections return nothing when data is missing, so pages collapse (product page above).
- Product grids keep their column count whatever the number of products (3 in 4 columns, 6 in 4).
- Preview data and live data are filled differently (related products), so the preview always looks better than the store.
- No handling for mixed photo styles (cut-out vs room shot): no padded "packshot" frame, no consistent photo backgrounds.

### 5. No page rhythm system

- Each section sets its own padding (`.jelly-section { padding-block: var(--rh-section) }`, plus per-section clamps), so neighbours add up to 192-208px and the gaps vary.
- Colour schemes exist (phase 3 of the template work), but nothing alternates them; the starter has to do it by hand, and old stores never did.

### 6. Quality checks look at the wrong thing

- The design lint and theme specs run on `/theme-preview/*` with sample data. The merchant's published store is never checked.
- Rules cover edges, contrast, tap targets, title sizes. They do not catch: empty slots in a grid, the same photo repeated, gaps that vary, a product page with nothing below Add to basket, a section placed where the theme CSS does not expect it.

### 7. Content

Not a code problem, but it decides half of the impression: consistent photography, enough products to fill rows, prices with savings, reviews, an offer. The platform should help (photo guidance, a "store readiness" checklist, sensible fallbacks), but no theme will make 3 products with three photo styles look like Sonno.

## Answer to "where is the problem?"

| Area you asked about | Verdict |
| --- | --- |
| Theme architecture | **Main cause.** No link between CSS and structure (cause 1); no layout model in templates (cause 2). |
| Component structure | **Main cause.** Composite sections missing (main product, main collection); sections not data-resilient (cause 4). |
| Design system | **Contributing.** Tokens exist (`--j-*` contract) but are one of five families; no rhythm or banding rules (causes 3, 5). |
| Page generation logic | **Contributing.** Starters are hand-written JSON; stores are never moved to newer starters (cause 1). |
| Styling approach | **Contributing.** Themes as skins over 334 internal class names, six layers (cause 3). |
| Rendering process | **Fine.** One renderer for preview and live works; the gap is data filling (cause 4), not rendering. |

## Target architecture

Five layers, each with one job. A theme may only touch the top two.

1. **Tokens** (one family, `--j-*`): colours per scheme, type scale, spacing scale, radius, shadow, motion. Themes set values; nothing else defines tokens.
2. **Theme recipe**: section presets, default settings, scheme assignments, and a small CSS file that may style only a documented list of named parts (`data-part="card-media"`, `data-part="price"` …), never renderer class names or `data-section-type` combinations.
3. **Primitives** (platform-owned, tested once): Section shell (applies scheme and spacing), Container, count-aware Grid (picks columns or a carousel from the number of items), Media frame (room shot vs packshot), Card, Button, Heading, Price, Rating.
4. **Composite sections** that own their layout: Main product (gallery + buying column as blocks inside one section: title, rating, price, options, add-ons, buy buttons, promise box, fold-outs), Main collection (banner, toolbar, filter sidebar, grid), Header, Footer. A merchant can reorder blocks inside them; they cannot break the two-column structure.
5. **Templates**: an ordered list of sections, plus a **structure revision** saved in the published design. When a theme's starter changes, it ships a migration from the previous revision; stores are offered the upgrade with a preview and an undo, like Theme SDK package upgrades already do. The theme `version` stays untouched.

Rules that come with it:

- **Rhythm**: the Section shell sets one spacing value from the scale. Two neighbours with the same background share one gap; a change of background gives each its own padding. Themes choose the scale, not per-section paddings.
- **Banding**: a theme declares a scheme sequence (for example page, soft, page, dark) that new sections follow by default.
- **Data contract per section**: each section declares what data it needs and its fallback (related products: same collection, then same type, then newest products; empty description: fold-out hidden, and the page still ends with full-width content).
- **Quality gate on real stores**: the design lint also runs against a published store address, with new composition rules (empty grid slots, repeated photo, gap variance, empty product page, structure revision behind the theme's).

## Implementation plan

Each phase ends with Resthaven checked on the preview **and** on a real store at 1280, 820 and 390px.

| Phase | Work | Done when |
| --- | --- | --- |
| 1. Structure revision + migration | Save a structure revision in published designs; migration from the old Resthaven starter to the redesigned one (keeps the merchant's text, photos and menus); upgrade offer with preview and undo for folder themes. | `new` can be moved onto the current Resthaven layout and back. |
| 2. Composite Main product and Main collection | Build both sections with blocks; Resthaven starter uses them; delete the `:has()` layout rules from `theme.css`. | Moving or restyling a block cannot break the product or collection layout; no `data-section-type` selectors left in Resthaven's CSS. |
| 3. Rhythm, banding, count-aware grids, data fallbacks | Spacing and scheme sequence in the Section shell; Grid chooses columns/carousel from item count; packshot frame; related-products fallback chain shared by preview and live. | Home gaps from one scale; no empty grid slots at 3, 5, 6 or 7 products; product page never ends at Add to basket. |
| 4. One token family, named parts | Resthaven reads only `--j-*` tokens and styles only named parts; old layers stop applying to it. | Resthaven CSS ≤ 300 lines, no renderer class names in it. |
| 5. Real-store quality gate + readiness checklist | Design lint against a store address with the composition rules; admin checklist (photo style, product count, reviews, logo, store name). | `new` passes; the checklist explains what content is missing. |
| 6. Make it the base for other themes | Generator (`new-theme.mjs`) produces a recipe on these primitives; Minimal and Avenue move over. | A generated theme passes the gate with no hand fixes. |

Recommendation: start with phase 1. It fixes what you see on `new` today, and it is needed anyway before any further layout change, or every older store breaks again.
