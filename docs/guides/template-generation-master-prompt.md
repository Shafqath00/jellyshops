# Jelly template generation: master prompt

Use this prompt whenever a Claude session (or any generator) creates or reworks a Jelly Shop theme or starter template. Paste the whole "Prompt" block, then fill in the brief at the end.

Background and reasoning: `docs/reports/2026-11-06-template-quality-shopify-analysis.md`.

Status note (2026-11-06, phase 8): the pipeline is live. The fastest route is a **brief file** (section "Generation pipeline" below): `scripts/new-theme.mjs` turns it into a theme folder built on Jelly Minimal or Jelly Avenue (`extends`), with no CSS, and the design lint is the gate before review. The full prompt below is for themes that need more than a brief can say; its "Today's equivalents" table is kept for reference.

## Generation pipeline (brief → theme folder → lint gate)

1. Write a brief: `docs/theme-briefs/<theme-id>.json` (example: `docs/theme-briefs/jelly-harbour.json`). Fields: `id`, `name`, `extends` (`jelly-signature` = Jelly Minimal's look, `jelly-avenue` = Jelly Avenue's editorial look), `description`, `colors` (`background`, `surface`, `text`, `secondary`, `primary`, `accent`, `dark`; #rrggbb), `typography` (`headingFont`, `bodyFont` from the platform fonts), optional `buttons.radius` (`square`/`soft`/`rounded`/`pill`), optional `copy` (`announcement`, `heroEyebrow`, `heroHeading`, `heroText`, `heroButton`, `footer`) and `images` (`hero`, `heroAlt`; https).
   A generator (a Claude session with this prompt's sections 2–5 as guidance) only has to produce this JSON.
2. `node scripts/new-theme.mjs docs/theme-briefs/<theme-id>.json` writes `packages/storefront-themes/src/themes/<theme-id>/theme.json` and `starter.json`. It refuses colours below WCAG AA (text, soft text, button text, text on the accent, text on the dark scheme) and unknown fonts, derives the four colour schemes (keeping the dark one in the base design's dark slot), and copies the base design's pages with the brief's copy and pictures.
3. `node scripts/generate-theme-index.mjs`, then `npm run build:storefront-packages` in `jellyshops/`.
4. Gate before review: `cd jellyshops && JELLY_E2E_FRONTEND_PORT=3300 npx playwright test e2e/design-lint.spec.ts`. Every theme with `extends` is linted at `/theme-preview/<theme-id>` (7 pages × 3 widths plus colour contrast); it passes when it adds no problem beyond its base design's known ones. Also `node scripts/validate-theme.mjs <folder>` and the conformance suite (`npx vitest run packages/theme-sdk/src/conformance.test.tsx`; generated themes are included automatically).
5. Review `/theme-preview/<theme-id>`, including the style guide, then repack the backend packages (`node scripts/prepare-shared-packages.mjs`, reinstall `@jelly` in `backend/`).

Never hand-edit a generated theme's CSS (it has none): change the brief and run the script again (a test checks that the committed folder equals the script's output for its brief).

---

## Prompt

```text
You are building a production-ready storefront template for Jelly Shop, a multi-tenant
e-commerce platform. Your output must look like a professionally designed theme from a
premium theme store on the day a merchant installs it, with the merchant's own products,
collections, logo and store details, and without the merchant fixing any layout.

You do not invent a new design system. You fill in Jelly's Design Contract. Quality comes
from following the contract exactly, not from adding custom CSS.

## 1. What you produce (data, not code)

Produce only these files for the theme folder packages/storefront-themes/src/themes/<theme-id>/:
1. theme.json  – id, name, version "1.0.0" for a new theme (never change id or version of an
   existing theme), engines, description, settingsDefaults (token values, palette, schemes,
   fonts, buttons, fields, cards, badges, cart type), settingsSchema only if the theme needs
   extra settings, sections (recipes) only if no existing section or preset can do the job.
2. starter.json – menus, globalSections (announcement, header, footer), templates for
   home, product, collection, cart, search, page, not-found. Built only from existing section
   types and their presets.
3. theme.css    – signature details only (at most 150 lines for a new theme). Written
   unscoped (& = theme root). Reads tokens only; no hex colours, no pixel values except
   1px hairlines.
4. A short REPORT.md: design rationale (3–6 sentences), every place the contract could not
   express the design, and the lint results.

Do not write React components, do not change the renderer, do not add section types, unless
the brief explicitly asks for it. If the design needs something the contract cannot express,
stop and list it in REPORT.md instead of hacking around it.

## 2. Design Contract (mandatory)

Grid and layout
- Every section sits on the shared section grid: margin | content | margin.
- Page widths: narrow, normal, wide (pick ONE for the theme). Content widths for text: narrow
  (about 36rem) or normal (about 42rem).
- Page margin: one value for desktop, at least 16px on phones. Never set a section's own
  outer padding or container width.
- Every section's content starts and ends on the same left and right edge at 1280, 820 and
  390px. Only sections marked full width may go edge to edge, and their text still aligns to
  the page edge.

Spacing
- Use only the spacing scale: 3xs, 2xs, xs, sm, md, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl.
- Section rhythm: choose ONE default (sm, md or lg) for the theme; adjacent sections must not
  double their spacing (a section with the same scheme as the one above uses rhythm-top none
  or sm).
- Spacing scales down automatically on tablet and phone; do not set phone values to fix a
  layout. Phone/tablet values are for deliberate differences only.

Typography
- Four font roles: body, subheading, heading, accent. At most two font families in total.
- Text presets: h1, h2, h3, h4, body, small, caption. Fluid sizes (clamp) come from the
  presets. A page uses at most four heading sizes. Sections pick a preset, never a pixel size.
- Line height and letter spacing per preset: tight, normal or loose.
- Measure: body text 45–75 characters per line (use content width narrow/normal).

Colour
- Palette of 5–8 colours. Colour schemes (2–5) are built from palette references: background,
  surface, text, muted text, border, accent, primary button background/text, secondary button
  background/text.
- Every section picks a scheme. Never set a free hex colour on a section or block.
- All text and buttons meet WCAG AA contrast in every scheme (4.5:1 body, 3:1 large text and
  UI). Check each scheme before you finish.

Components
- Product cards: one card design for the whole store, one image ratio (square, portrait 4:5,
  or landscape 4:3), consistent title/price/badge order. Every product list uses it.
- Buttons: primary and secondary only, from theme settings (radius, border, case, font role).
- Badges, prices, swatches, form fields: from theme settings only.
- Media: every image sits in a media frame with a fixed ratio and focal point, so photos of
  any shape fit.

Responsiveness
- Breakpoints are fixed: phone up to 767px, tablet 768–1023px, desktop 1024px and up.
- Grids give explicit mobile columns (1 or 2). No horizontal scrolling at 390px except
  deliberate carousels. Tap targets at least 44px.
- Header on phones: menu and search on one side, logo centred or left, account and bag on
  the other side.

## 3. Allowed building blocks

Use existing section types only (pick presets where available):
header, announcement-bar, footer, hero, slideshow, image-banner, image-with-text, image-text,
image-mosaic, category-grid, featured-collection, product-grid, multicolumn, testimonials,
faq, newsletter, rich-text, logo-list, trust-strip, rating-summary, image-gallery,
journal-teaser, contact-store-info, custom-content, product-information, product-gallery,
product-purchase, product-options, product-description, product-tabs, product-specifications,
product-stock-counter, related-products, collection-header, collection-description,
collection-product-grid, cart-summary, search-results, page-content, blog-header,
article-list, article-header, article-content, not-found-message, spacer-divider.

Per-section limits: keep to the section's own semantic settings (layout, width, height,
columns, media, content) plus colour scheme, width, spacing and show-on. Do not use the
"Advanced" style settings (free fonts, free colours, opacity, shadow, gradients, minimum
height, custom CSS) in a starter.

## 4. Page recipes (minimum content)

Home (4–8 sections, each with a clear job; no two similar sections next to each other):
 1. Hero or slideshow: one headline (max 8 words), one supporting line (max 20 words),
    one or two buttons pointing at real collections.
 2. Featured products from the store's newest or best-selling products (bound, not copied).
 3. Collections (category grid or collection list) bound to the store's first collections.
 4. Brand story (image with text) with editable copy.
 5. Trust or benefits (multicolumn or trust strip: delivery, returns, secure checkout).
 6. Optional: testimonials, FAQ, journal, newsletter (newsletter last before the footer).
Product: gallery left / details right on desktop, stacked on phones; title, price, options
(swatches when the option has colours), quantity, add to cart, description, specifications
or tabs, delivery and returns info, related products.
Collection: header (title, description, optional image), toolbar (filter, sort, count),
product grid with the store card, pagination or load more, empty state.
Cart, search, page, 404: clear heading, the main content, one helpful next step
(continue shopping, popular collections).
Header: logo (or store name), main menu from the store's collections with dropdowns,
search, account, bag. Footer: about text, 2–4 link columns, newsletter, social links,
policies, payment/copyright line.

## 5. Store data and empty states

- Store name, logo, contact details, social links and policies come from store settings and
  bindings; never hard-code a store name.
- Product and collection sections bind to the store's data (newest, best-selling, first N
  collections). Use hideWhenEmpty (or the section's empty state) so a store with no products
  shows no empty grid on the live site, and a designed placeholder in the editor.
- Stock photography (if used for hero/story) must match the brief, be high resolution,
  have meaningful alt text, and be easy to replace (one image per setting).
- Copy: short, specific to the store type, British or the store's language, no lorem ipsum,
  no exaggerated claims.

## 6. Quality checks before you finish (report each as pass/fail in REPORT.md)

 1. Shared content edges at 1280, 820, 390px (±1px), full-width sections excepted.
 2. Section spacing values are on the rhythm scale; no doubled gaps.
 3. Heading sizes only from presets; at most four on a page.
 4. No horizontal scroll at 390px; tap targets ≥ 44px.
 5. AA contrast for every scheme and every button style.
 6. One product card ratio per list; every product list uses the store card.
 7. Installed on an empty store: no empty grids or grey boxes on the live site.
 8. Installed on a store with 12 products, 3 collections and a logo: home, collection and
    product pages show that data with no manual edits.
 9. Theme settings changes (palette, fonts, buttons) reach every page.
10. theme.css has no hex colours and no pixel values except hairlines.
11. node scripts/validate-theme.mjs passes; the conformance suite passes
    (describeThemeConformance(<theme-id>)); the design lint passes
    (e2e/design-lint.spec.ts, see "Generation pipeline").

If a check fails, fix the data (settings, presets, scheme) and run it again. Do not fix it
with custom CSS unless the fix is a signature detail.

## 7. Brief

Store type and products:            <e.g. bed and mattress showroom>
Audience and price level:           <e.g. families, mid-range, finance offered>
Brand personality (3 words):        <e.g. calm, trustworthy, warm>
Reference feel (no copying):        <e.g. editorial and image-led, like a premium furniture retailer>
Palette ideas or brand colours:     <hex values or "propose">
Fonts (or "propose"):               <two families at most>
Must-have sections or features:     <e.g. finance line by price, trust badges, store visit>
Theme id and name:                  <kebab-case id, display name>
```

---

## Today's equivalents (until the roadmap lands)

| Contract term | Use today |
| --- | --- |
| Shared section grid | the theme's `.jelly-container` rules; make header, sections and footer share one edge value |
| Spacing scale | the theme's own scale (contract `--j-space-*`; kit themes alias them as `--tk-1 … --tk-12`), never literal px |
| Text presets | theme settings text styles H1–H4/Body/Small (`theme-style-settings.ts`) and block `blockTypePreset` |
| Colour schemes | theme settings `colorSchemes.schemeN` and section `styleScheme`; avoid `styleBackground`/`styleText` hex |
| Presets with content | not available (`SectionPreset` has no settings/blocks); write the variant's settings into starter.json |
| Design lint | not built; measure edges and padding by hand in `/theme-preview/<theme>` at 1280/820/390 (the JavaScript used in the 2026-11-06 report's appendix) |

Notes for whoever runs it: after changing packages, repack the backend tarballs (`node scripts/prepare-shared-packages.mjs`, then reinstall `@jelly` in `backend/`); run `node scripts/generate-theme-index.mjs` after adding a theme folder; keep files LF.
