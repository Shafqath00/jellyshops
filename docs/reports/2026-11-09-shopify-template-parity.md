# Why our templates fall short of Shopify's, and how we close the gap

Date: 2026-11-09. Prompted by two screenshots from the signed-in editor on Jelly Halo: product photos stacked in an uneven column, and three reviews stretched full width one under another. Builds on `2026-11-06-template-quality-shopify-analysis.md` (design contract, design lint, section frame, colour schemes, presets, product card parts: all done since) and `2026-11-01-theme-editor-shopify-gap-analysis.md`.

## 1. Short answer

Our templates look right in the theme preview and wrong in the editor and on real stores because **the preview is not the same thing as the store**. Shopify has one path: the editor shows the real storefront, rendered from the real theme with the merchant's own products. We have three paths (theme preview with perfect sample data, editor preview, live store) that drift apart. Both problems in the screenshots came from that drift, and from four related causes:

| Cause | What it did | Seen as |
| --- | --- | --- |
| **A. Presentation gated by a store switch** | The thumbnail gallery only appeared when the store was listed in `NEXT_PUBLIC_PRODUCT_MEDIA_STORE_IDS` (a rollout switch meant for photos-per-option). Previews hard-coded it on; the editor and most stores had it off. | Stacked, uneven bed photos |
| **B. Sections with no platform layout** | Newer themes switch off the old global styles. The platform then gave some sections (testimonials) no layout at all, so the theme had to remember every section. | Reviews stacked full width |
| **C. Thin interactive components** | The gallery was a few inline styles: no arrows, swipe, counter, keyboard, zoom or fixed photo shape. | "Looks like a gallery, doesn't work like one" |
| **D. Themes styling component internals** | Each theme re-laid out the gallery with selectors such as `> div:first-child`, so any change to the component broke three themes. | Fragile, inconsistent galleries |

A fifth cause sits under all of them: **we test with perfect data**. Our sample photos are generated at one size and ratio. Merchants upload phone photos, catalogue cut-outs and lifestyle shots of every shape. Nothing checked that a template survives that.

## 2. What Shopify does that we were missing

1. **One render path.** The theme editor is an iframe of the real storefront. There is no separate preview to drift.
2. **Components own their behaviour.** Dawn ships custom elements for each interactive part: `media-gallery`, `slider-component`, `product-modal` (zoom), `variant-selects`, `product-form`, `cart-drawer`, `details-modal`, `predictive-search`. Themes style them; they never re-implement or re-lay them out.
3. **Every section has a sane default layout.** A section dropped into any theme lays out correctly before the theme adds anything.
4. **Settings are bounded.** Photo shape (square, portrait, landscape, adapt to first image), thumbnail position, zoom, gallery layout and mobile layout are section settings with fixed choices. Merchants can't produce a broken combination.
5. **Theme Store review.** Themes must pass performance, accessibility and "works with any content" checks before listing, including long names, missing images and many variants.

## 3. Where we stand against the brief

| Brief item | Status after today |
| --- | --- |
| 1. Professional architecture (tokens, grid, type, spacing, responsive) | **Mostly built**: `--j-*` design contract, section frame and page grid, colour schemes, type scale, design lint at 3 widths. Gap: some sections still rely on theme CSS for layout (cause B). |
| 2. Product galleries | **Done today** (see §4): fixed photo shape, thumbnails below or beside, arrows, swipe, counter, keyboard, full-screen viewer with zoom, grid and "large first" layouts, photos follow the chosen option. Drag-and-drop reordering already exists in the product builder. Still gated: tagging photos to option values (`PRODUCT_MEDIA_STORE_IDS`). |
| 3. Customisation without code | **Largely built**: sections and blocks with add, duplicate, hide, move and drag; nested groups; desktop, tablet and phone values; colour schemes; presets; undo; custom CSS. Gap: no guarantee that every setting combination stays tidy (§5, phase 5). |
| 4. Alignment and spacing problems | **Partly**: the edge, heading, tap-target, card-ratio, header and title-size lint rules pass for every theme. Added today: rows of items that collapse into full-width stacks, and product photo frames of different shapes. Gap: lint runs on sample data only. |
| 5. Real functionality | **Partly**: gallery done; compare, quick add, slide-out bag, reviews, dropdown menus and sticky buy bar work. Not yet audited one by one: slideshow, video, predictive search, variant URL, accordions. |
| 6. Shopify-level engine | **Foundations in place** (registry, renderer, schema validation, design lint, conformance suite). Missing: one render path, a section baseline, messy-data fixtures. |
| 7. Gap analysis | This document. |

## 4. Fixed today (phase 1)

- **Gallery renders from its own settings**, never from a store switch, so the editor, live store and preview all show the same thing.
- **New gallery component** (`storefront-renderer/src/product-gallery-viewer.tsx`):
  - photos in a fixed-shape frame, with a swipeable strip that snaps to each photo;
  - previous and next arrows, a "2 / 5" counter, and keyboard arrows;
  - thumbnails below, or beside the photo from tablet width up;
  - a full-screen viewer (modal dialog, Escape closes it, focus stays inside) with previous/next and click-to-zoom with panning;
  - goes back to the first photo when the chosen option changes the photo set.
  - **Grid and Large first image** use the same frames, and a click opens the full-screen viewer.
- **New section settings:**
  - Photo shape: Theme default, Square, Portrait 4:5, Landscape 4:3, or Same as the first photo. A chosen shape wins over the theme's.
  - Thumbnails: below or beside the photo.
  - Let shoppers open photos full screen and zoom.
- **Platform layout for the gallery and testimonials** in `storefront-base.css`, written so themes can restyle but never need to re-lay them out. Removed the fragile gallery rules from Halo, Forma and Diode; those three now choose "beside" through the setting instead.
- **Design lint:** new rules `stacked-row` (three or more items each filling the row on desktop) and `gallery` (photo frames of different shapes). All seven themes pass.
- **Checked:**
  - In Chrome on the preview of all seven themes, at desktop and phone width: equal frames, no sideways scroll.
  - Interactions on Halo: arrows, thumbnails, keyboard, full screen, zoom.
  - Tests: 9 for the gallery, 1 for the lint rules; 1,012 in the main groups pass.
  - Not yet checked in the signed-in editor or on a live store.

## 4b. Phase 2 done: messy merchant data (2026-11-09)

Every theme preview has a **Sample data: Tidy / Messy** switch. Messy data (`features/theme-preview/messy-data.ts`, photos from `scripts/build-messy-fixtures.mjs`) is a store filled in the way merchants really do it:
- photos of every shape: tall phone shots, 3:1 banners, a 220px photo, cut-outs on white, off-centre subjects, one product with no photo;
- names from 3 to 89 characters, including an unbroken 56-character word;
- sold-out products, five swatches plus "4 more", a £10,000.00 price;
- a product with twelve photos and nine option values, long descriptions and specifications;
- long collection, page and search titles.

The design lint runs every theme on six pages with messy data at desktop and phone width. A messy finding that the theme already has with its own data counts as known, so the messy run reports only problems the data causes. New rules: `title-lines` (a page title over 4 lines, 5 on phones; hero headlines excluded), `text-spill` (drawn text outside its card or heading), and side thumbnails running below the photo.

What messy data found, and the fixes (all in the platform, so every theme gets them):

| Problem | Themes | Fix |
| --- | --- | --- |
| Long product, collection and page names ran onto 5-6 lines | all | `titleLength()` marks titles over 40 and 70 characters; they step down to the theme's subheading size and drop the narrow width some themes give display titles |
| Twelve side thumbnails made the gallery far taller than the photo | Halo, Diode, Forma | The thumbnail column takes the photo's height and scrolls |
| Unbroken words could push past cards and headings | all | Headings and cards wrap anywhere when they must |
| A product with no photo collapsed its card | Resthaven | The placeholder keeps the card's photo shape |
| The sale badge added height to the card photo | Resthaven | The badge floats over the photo |
| The sign-up consent box was 20px, under the tap minimum | Minimal, Avenue, Harbour | 24px minimum in every theme (also cleared 8 old accepted findings) |

Result: all 7 themes pass with tidy and messy data at every width checked.

## 4c. Phase 3 done: section baseline (2026-11-09)

**New page `/theme-preview/platform-baseline`** draws every section the platform offers (50 section types, 60 entries counting each preset) with no theme at all: no theme stylesheet, no theme kit and none of the old default rules in `globals.css`. That is exactly what a new, scaffolded or uploaded template starts from. The page has the same Tidy/Messy data and Desktop/Tablet/Phone switches as the theme previews. The design lint measures it on all 7 pages at three widths, with both data sets, using the layout rules (edges, sideways scroll, tap targets, stacked rows, photo shapes, spilled text, title lines).

**What it found.** With the old default rules off, the platform gave sections almost no layout of their own: no buttons, no product grid (cards stacked full width), no section spacing, the header's shopping icons stacked with their labels showing, header and footer outside the page edges, banners with no text over the photo, "Text over image" and "Text only" heroes laid out as split heroes, unstyled sign-up forms, option values as plain words, 11px quantity buttons on phones, headings of some sections at body size, and photo shapes that changed with each photo. Every newer template (Forma, Halo, Diode) had to rebuild all of this in its own CSS, which is cause B and D above.

**Fix: one shared default layer**, `src/app/themes/section-defaults.css` (loaded before the platform rules and every theme, also in the CLI preview):
- Every rule sits entirely inside `:where()`, so it has no priority: any theme rule wins, even a bare `h2 { }`. Colours and sizes come from the design tokens.
- It applies to storefronts with `data-jelly-legacy-styles="off"`: every new, scaffolded, generated-from-scratch and uploaded template. Minimal, Avenue, Resthaven and Harbour keep the old defaults they were designed on. Forma, Halo and Diode were designed with their own complete CSS, and the defaults changed their look (centred page text, smaller footer text, more space), so their manifests set `sectionDefaults: false` (root value `"own"`; `usesSectionDefaults()` in storefront-themes). The old defaults in `globals.css` now switch off for any value of the attribute.
- Checked by comparing 168 full-page pictures of all 7 templates (8 pages × 3 widths) before and after: identical apart from two photos that had not finished loading in the "before" picture.
- It covers announcement, header (with phone menu and 44px icon targets), footer, section spacing and headings, buttons and fields, every hero layout, image banner, slideshow, image with text, custom content, rich text, collection list, journal, mosaic, testimonials, trust badges, FAQ, sign-up form, store visit, product cards and grids, the product page (price, options, quantity, Add to cart, details, specifications), collection header, bag, search, 404 and page text.
- Tests (`section-defaults.test.ts`): every selector has no priority and is limited to those storefronts, colours come from tokens, the file loads first, and the baseline page draws every section.

**Empty presets.** "Rich text", "FAQ" and "Feature columns" added an empty section; they now come with sample blocks. Testimonials stay empty on purpose (no invented quotes on a live store; the editor hint explains it). Logo list, photo gallery and apps need the merchant's own images or links, so they still start empty.

## 4d. Phase 4 done: component behaviour (2026-11-09)

Each interactive part was checked against its Shopify counterpart (Dawn's custom elements). Results:

| Part | Before | Now |
| --- | --- | --- |
| Stock (product page, bag, quick add, cards, search) | A product whose stock is not counted, and every digital product, arrives as "available" with no stock number; the storefront read that as sold out in 11 places. On the product page it showed "Available", then Add to cart refused it. The bag's + button was disabled. | One rule in `src/lib/variant-stock.ts` (`isVariantBuyable`, `variantMaxQuantity`; untracked limit 99 per add) used everywhere. |
| Option values | Every value was marked available, so sold-out sizes and colours never showed. Where themes did mark one, it was disabled, so the shopper could not see its price or ask to be told when it is back. | `optionValueState()`: a value with no buyable variant (given the other choices) is shown as sold out but stays selectable; only a value no variant has cannot be chosen. Struck through, swatches with a diagonal line, "sold out" read out by screen readers. |
| Variant in the address | Not kept: a link could not open a chosen size or colour, and a refresh lost the choice. | `?variant=<id>` is read on load and kept up to date (`use-variant-address.ts`), keeping other parts of the address. |
| Slideshow | Paused on hover and focus only (none of that exists on touch screens), no swipe, no arrow keys; the editor did not show the selected slide. | Pause/Play button whenever slides move on their own (WCAG 2.2.2), swipe, left and right arrow keys, the selected slide shown in the editor. |
| Video | YouTube and Vimeo players loaded with the page. | A cover picture (the merchant's or YouTube's) with a play button; the player loads on click. Autoplay is skipped for shoppers who ask for less motion. Nothing loads in the editor. |
| Phone menu | Stayed open on Escape and when tapping the page; its button always said "Open menu". | Escape (focus back to the button) and a tap outside close it; the button reads "Close menu" while open. |
| Header dropdowns, slide-out bag, full-screen photo viewer, accordions | Already correct: keyboard, Escape, focus trap, outside click. | Unchanged. |

Tests: `packages/storefront-renderer/src/component-behaviour.test.tsx` (14) and `src/features/storefront/product-behaviour.test.ts` (7). Checked in the browser on the theme previews (sold-out size, phone menu, slideshow controls) and on the staging store "new" read-only (a variant link and a reload keep the choice). The design lint passes for every theme.

Not built (each is a feature of its own): predictive search (suggestions while typing), a count on the header bag icon, and the sticky buy bar and quantity rules beyond the stock limit (minimum, steps of N), which need new product settings.

## 5. Roadmap

Each phase ends with tests, a browser check and a commit, and starts only after a go-ahead.

1. **Gallery and baseline fixes**: done (above).
2. **Messy-data fixtures** (done, see 4b). One shared set of awkward sample stores: photos of mixed shapes, one photo, twelve photos, no photo, 80-character names, sold-out variants, 30 options, empty collections, long reviews. The theme preview, the conformance suite and the design lint all run on it, so "looks fine with our photos" stops being the test.
3. **Section baseline.** Render every section with platform CSS only (no theme) at three widths and lint it. Any section that breaks gets its layout moved into the renderer's section primitives (`SectionFrame`, `Stack`, `Grid`, `MediaFrame`). After this, a theme can only change looks, not break layouts.
4. **Component behaviour audit.** A checklist and tests per interactive component, modelled on Dawn's custom elements:
   - slideshow: autoplay with pause, swipe, dots, reduced motion;
   - header menus and mega menu;
   - predictive search;
   - variant picker: URL `?variant=`, photo follows the option, sold-out states;
   - cart drawer;
   - accordions and tabs;
   - video: deferred loading, poster image;
   - sticky buy bar;
   - quantity rules.
5. **One render path.** The theme preview and the editor build pages through the same loader as the live store (`resolveStorefrontRoute`), with fixtures in place of the API. Add an automatic editor-vs-live comparison on the fixtures.
6. **Safe customisation.** A "settings fuzz" test sets random but valid combinations of each section's settings and runs the lint, so no combination a merchant can pick produces overlap, overflow or stacked rows. Also adds "Reset section to the template's design".
7. **Media rollout.** Switch photos-per-option on for every store. This is a backend and frontend config change (`PRODUCT_MEDIA_STORE_IDS=*`), only after a staging check with real products.

## 6. Decisions needed

- Phase order. Recommended: 2 → 3 → 4, because fixtures and the section baseline catch problems in every template at once, before more templates are built.
- When to switch photos-per-option on for all stores (phase 7). It changes staging and production config.
