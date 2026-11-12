# Shopify theme architecture vs Jelly Shop: gap analysis and plan

Date: 2026-11-12. Follows `2026-11-12-bed-showroom-root-cause-and-architecture.md` (store `new` findings) and goes deeper into architecture.

Sources:
- Shopify developer docs: theme architecture, JSON templates, section schema, theme blocks, settings, Theme Store requirements (shopify.dev/docs/storefronts/themes/...).
- Source code of Shopify's Dawn and Horizon themes (GitHub, read locally, not run).
- DUSK and Sonno live pages. Both are Shopify stores. Sonno reports `schema_name: "Dawn", schema_version: "13.0.0"`, so it is Dawn heavily customised by an agency. DUSK reports a custom theme `"Underscore" 2.3.1`, not from the Theme Store.
- Jelly Shop code on branch `combined/dashboard-and-templates`, the local store `new` (`http://localhost:3000/new`) and its server responses.

Every Jelly Shop statement below was checked in the code or the running store. Items I could not check are marked.

---

## 1. Summary

**Shopify's consistency does not come from a cleverer platform. It comes from one rule: a theme owns all of its markup, CSS, settings and default content, and one author designs it as a whole.** The platform supplies the data, the editor, the composition format (layout → section groups → JSON templates → sections → blocks) and strict quality gates. Dawn and Horizon put each page's core in one "main" section whose structure the merchant cannot break. Every section uses the same container class, colour schemes and card snippet. Every page is rendered complete on the server.

**Jelly Shop deliberately split that ownership.** The platform owns the markup (one shared React renderer, 52 sections, about 334 CSS class names). A theme is declarative: settings, tokens, a starter layout and a CSS file. To look different, a theme must restyle the platform's markup from the outside. Resthaven's CSS targets 180 renderer class names and uses 33 selectors that guess which sections sit next to each other. That split, plus a few missing platform pieces, explains the quality problem:

1. **Layout is faked in CSS instead of being structure.** The product page is 9 to 13 separate sections arranged by CSS. Shopify uses one main section with fixed parts.
2. **Ownership is split, so nobody owns the result.** Platform markup, six CSS layers and theme CSS all affect the same element.
3. **Product and collection pages are drawn in the browser.** The server sends only "Loading product…" / "Loading the collection…". Shopify sends complete HTML.
4. **Old stores and new theme CSS drift apart.** Nothing records the page structure a store has, and nothing migrates it.
5. **System pages are inconsistent.** `/new/xyz` and `/new/products/nope` show Next.js's unstyled 404. Only deeper paths show the theme's 404, and with status 200.
6. **Sections are not data-resilient.** Related products, empty descriptions and grids that leave holes behave differently in the preview and the live store.
7. **Quality gates check the preview, not real stores, and do not measure performance.** Shopify's Theme Store requires Lighthouse performance ≥ 60 and accessibility ≥ 90 on home, product and collection pages, on desktop and mobile, with real content.

Jelly Shop already matches or beats Shopify in several places (section above), so this is not a rebuild. The recommended path keeps declarative themes (no uploaded code) but changes what a theme is made of. Themes would be built from platform-owned **blocks and main sections with fixed structure**, **one token layer** and **named style parts**, rendered on the server and checked on real stores. That is close to the direction Shopify itself took with Horizon (theme blocks, nested blocks, static blocks, text presets).

---

## 2. How Shopify's theme system works

### 2.1 Three parties, three responsibilities

| Party | Owns | Examples |
| --- | --- | --- |
| **Shopify platform** | Data and objects (`product`, `collection`, `cart`, metafields, metaobjects), Liquid, theme editor, composition format, checkout, customer accounts, APIs (Section Rendering, predictive search, recommendations, filtering), CDN, Theme Check, Theme Store review | The editor shows whatever a section's schema declares; it never styles anything. |
| **Theme developer** (Shopify for Dawn/Horizon, agencies for DUSK/Sonno) | **All** HTML, CSS, JS, section and block schemas, theme settings, default templates, presets (theme styles), translations | Dawn: 48 sections, 39 snippets, one `base.css` (3,637 lines) plus 15 section and 39 component CSS files. |
| **Merchant** | Values only: `config/settings_data.json` (theme settings), `templates/*.json` (which sections, in which order, with which settings and blocks), content in the admin | Can reorder, add, remove and restyle within the options the developer exposed. |

The platform never adds CSS to a theme. If something looks wrong, there is exactly one owner: the theme.

### 2.2 Folder structure and composition

```
layout/theme.liquid           page shell: <head>, CSS variables from settings, header group, {{ content_for_layout }}, footer group
templates/product.json        which sections build a product page (JSON, merchant-editable)
templates/product.bed.json    alternate template, assigned per product
sections/main-product.liquid  section = markup + {% schema %} (settings, blocks, presets, enabled_on/disabled_on)
sections/header-group.json    section group: merchant-editable list of sections in the header area
blocks/text.liquid            theme block, reusable across sections, can contain other blocks (Horizon)
snippets/card-product.liquid  shared markup (product card), used by every section that shows products
config/settings_schema.json   theme settings definitions (~130 settings in Dawn and Horizon)
config/settings_data.json     merchant values + presets
locales/en.default.json       every visible string, translated
assets/                       CSS, JS, images
```

Rules quoted from the docs:
- "JSON templates can render up to 25 sections, and each section can have up to 50 blocks." Up to 1,000 JSON templates per theme.
- Alternate templates: `product.json` or `product.alternate.json`, assigned per product.
- Section schema: `limit` (1 or 2), `max_blocks` (≤ 50), `presets` (makes a section addable), `enabled_on` / `disabled_on` (by template or by group).
- A section accepts either its own block types or theme blocks (`"@theme"`, plus `"@app"` for app blocks), not both.
- Theme blocks nest: "Theme blocks can accept other theme and app blocks as children." Presets can contain nested blocks.

Render order: layout → header group → template sections (each renders its blocks) → footer group. Everything is rendered on the server into complete HTML. JavaScript only enhances it (drawers, variant changes). Partial updates use the Section Rendering API, which re-renders a section on the server.

### 2.3 Main sections: how page layout stays intact

Every page type has a main section that holds the page's core. In Dawn, `templates/product.json` is `main-product` with blocks `vendor`, `title`, `price`, `variant_picker`, `quantity_selector`, `buy_buttons`, `description`, `share`, followed by full-width sections (`disclosures`, `related-products`). Dawn's `main-product` offers about 20 block types (title, price, SKU, inventory, rating, variant picker, buy buttons, description, collapsible tab, popup, complementary products, custom Liquid, and more) and 52 settings.

Horizon goes further. `product-information` holds two **static blocks**: `_product-media-gallery` and `_product-details`. They are fixed in place, the merchant cannot delete or move them, and `_product-details` holds nested groups of theme blocks. The two-column layout is the section's own markup. The merchant can only change what goes inside each column. **This is why moving or restyling a block never breaks a Shopify product page.**

The Theme Store makes this mandatory: "Main product elements (such as price, vendor, and description) must be individual blocks", and header and footer "must use section groups".

### 2.4 Settings and design tokens

- `settings_schema.json` defines global settings. Dawn groups them as logo, colours, typography, layout, animations, buttons, variant pills, inputs, cards, collection cards, blog cards, content containers, media, popups, drawers, badges, brand, social, search, currency, cart and customer accounts. Horizon has a similar list, plus prices and swatches.
- **Colour schemes** (`color_scheme_group`): each scheme has background, text, button, button label, secondary button, shadow and gradient. `theme.liquid` writes each scheme as a CSS class (`.color-scheme-1 { --color-background: …; --color-foreground: … }`), and every section has a `color_scheme` setting that adds the class. Dawn also derives a contrast colour from brightness. Rule: every background colour setting has a matching foreground setting.
- **Typography**: `font_picker` settings (Shopify font library only; no custom fonts in the Theme Store) plus scale settings. Horizon defines **text presets** (paragraph, h1 to h6) globally. A text block picks a preset, and its custom size and weight controls only appear (`visible_if`) when "Custom" is chosen.
- **Layout and spacing**: `page_width` → `--page-width` used by one `.page-width` class everywhere. `spacing_sections` → `--spacing-sections-desktop/mobile` between sections. Each section has `padding_top` / `padding_bottom` in px, which Dawn shrinks to 75% below 750px.
- Settings never become CSS by magic. The theme writes the CSS variables itself in the layout. Because the same author writes the variables and the CSS that reads them, they always match.

### 2.5 Data and dynamic content

- Liquid objects give every section direct access to the resource (`product`, `collection`, `cart`, `search`).
- **Dynamic sources** connect settings to metafields and metaobjects in the editor.
- **Recommendations API**: related and complementary products are computed by Shopify, so a "related products" section has data on every store, even a small one.
- **Filtering** (facets) and **predictive search** are platform APIs. Themes only draw them.
- Sections show placeholders when content is missing (for example `placeholder_svg_tag`), so a fresh store never shows broken holes.

### 2.6 Editor

The editor is generic: it reads schemas, shows settings, adds sections from presets, nests blocks, and respects `limit`, `max_blocks`, `enabled_on` and static blocks. Theme styles are presets in `settings_data.json`. App blocks plug into sections that accept `@app`. Merchant custom CSS is handled by the platform; the docs say themes "shouldn't add this setting".

### 2.7 Quality control

- **Theme Check** (in the Shopify CLI): a static linter for Liquid, JSON schemas, missing templates, asset sizes, images without sizes and similar problems. (The exact list of checks was not read for this report.)
- **Theme Store requirements** (quoted):
  - Lighthouse performance ≥ 60 and accessibility ≥ 90, averaged over product, collection and home pages, on desktop and mobile. "Test sections must contain real images and content."
  - Required templates: `404.json`, `article.json`, `blog.json`, `cart.json`, `collection.json`, `index.json`, `list-collections.json`, `page.json`, `page.contact.json`, `password.json`, `product.json`, `search.json`, `gift_card.liquid`.
  - Required features include faceted filtering, predictive search, multi-level menus, variant images, image focal points, recommendations, unit pricing, discounts in the cart, and country and language selectors.
  - Colour and typography rules: at least 4 colours, a foreground for every background, `font_picker`.
  - A demo store per preset, with authentic content and a catalogue size that matches the industry.
  - Not allowed: fake urgency, app-dependent features, themes derived from Dawn or Horizon.
- Human review by Shopify before listing.

### 2.8 Theme creation workflow (developer)

1. Start from Shopify's Skeleton theme with the CLI.
2. `shopify theme dev` against a real development store (real data, hot reload).
3. Build the layout, snippets (card, price, media), sections and blocks; write schemas.
4. Define settings and colour schemes; write the CSS variables in the layout.
5. Write default templates for every page type, header and footer groups, and presets per industry (`/listings`).
6. Run Theme Check and Lighthouse; test with real catalogue sizes.
7. Build a demo store per preset.
8. Submit; Shopify reviews and lists it.
9. Ship versions. Merchants update by installing the new version, and their settings and templates come across when setting and section IDs stay compatible. Keeping IDs compatible is the developer's job. (Shopify's update mechanics are described from general knowledge, not re-read for this report.)

### 2.9 Built-in vs developer vs store customisation (DUSK, Sonno)

- **Sonno**: Dawn 13.0.0 as the base, then an agency rewrote large parts. Its product page is a custom `pdp-main` section; its spacing utility is `section-py`; its banding class is `bg-primary`. Add-ons ("Add mattress & save", "Professional assembly"), finance lines and swatch tiles are custom sections or blocks. So: platform structure from Shopify, base system from Dawn, polish and conversion features from the agency.
- **DUSK**: a fully custom theme ("Underscore"). Shopify supplies only the platform.
- Lesson: professional stores sit on a coherent base system (Dawn) plus a designer who controls every pixel of the markup. The base system alone (unmodified Dawn) looks clean but generic. The polish is design work done inside one owner's code.

---

## 3. Jelly Shop today (verified)

| Area | What exists (file evidence) |
| --- | --- |
| Packages | `storefront-schema` (zod schemas), `storefront-registry` (sections, blocks, controls, presets, starter packs), `storefront-renderer` (one React renderer for editor and live), `storefront-themes` (theme manifests, tokens, fonts, folder themes), `storefront-ui`, `theme-sdk`, `theme-cli`. |
| Published design | `runtime-v4.ts`: snapshot with `theme {presetId, id, version, settings, artifactId}`, `templates` (id, type, handle, layout as untyped JSON), `globalSections`, `menus`, `templateDefaults`, `assignments`. No record of which starter or structure a store was built from. |
| Old models still in code | `StoreDesignDocument` (schema v1 with `globalSettings`, header/pages/footer) used in 15 non-test files, including `storefront-page.tsx`, `editor-store.ts`, `repository.ts` (localStorage `jelly-shop-state-v1`); runtime v4 in 7 files. |
| Page types | 19, including checkout, account and order pages. Theme templates are used for home, product, collection, cart, search, page, blog, article and 404; checkout, account, wishlist and order pages are built into the app and themed only by CSS. |
| Sections | 52 in the registry. Each has 21 to 56 settings, about 20 of them shared style settings. `supportedPages` limits most content sections to the home page: hero, image with text, multicolumn, testimonials, FAQ, newsletter, featured collection and product grid cannot be added to product or collection pages. `allowedRegions`: header group = announcement + header only; footer group = footer only. |
| Blocks | 24 block types (heading, text, button, image, video, group, app, column, slide, collection card, testimonial, FAQ item, spec row, trust point, …). Groups nest up to 3 levels (`MAX_BLOCK_DEPTH`). Presets on 19 sections; variants in `section-variants.ts`. |
| Product page | 13 separate sections in the Resthaven starter (gallery, rating, information, options, purchase, trust strip, description, specifications, dimensions, reviews, related, recently viewed + globals). The two-column layout comes from `theme.css:429-432` `:has()` rules. |
| Themes | Declarative. Folder themes have `theme.json` (manifest; Resthaven 127 settings), `starter.json` (menus, global sections, 7 templates; header/footer are referenced from every template as `{kind:"global"}`), `theme.css`, `assets/`. Built-in themes are in `theme-registry.ts`. Themes cannot add or change markup, except "recipes" (up to 20 sections composed from fixed elements). Theme styles (`theme-styles.ts`), up to 8 colour schemes, text styles h1-h4/body/small, `extends` for generated themes. |
| CSS | Loaded for a storefront: `globals.css` (870 lines), `storefront-base.css` (1,586), `section-defaults.css` (284), `theme-kit.css` + `theme-kit-late.css` (411), theme file (Resthaven 567 compiled / 713 source), plus inline styles from settings. Token families in Resthaven's CSS: `--j-*`, `--jelly-*`, `--rh-*`, `--store-*`, `--theme-*`. Resthaven targets 180 renderer class names and uses 33 `data-section-type` selectors. |
| Rendering | Next.js. Home is rendered on the server (12 section types in the HTML). **Product and collection pages send only a loading screen**: `curl /new/products/utah-ottoman-divan-bed` contains "Loading product…" and 3 section types (announcement, header, footer); `/new/shop` contains "Loading the collection…". The page is resolved in a `useEffect` in `product-client.tsx` (lines 100-120). |
| 404 | `/new/foo/bar` → theme 404 with **status 200**; `/new/xyz` and `/new/products/nope` → Next.js's unstyled "404 This page could not be found" (no `not-found.tsx` under `app/[storeSlug]`). |
| Data | Custom data and metaobjects, dynamic-source bindings, catalogue browse API with facets (`catalog/browse.ts`), predictive search in the browser, reviews, recently viewed. Related products: live = shared collection or category only (`product-client.tsx:77`); preview = any other product (`template-preview.tsx:54`). |
| Editor | Section and block tree, presets, drag on the preview, undo/redo per page, phone and tablet values, Show on, element selection, scoped custom CSS, translations, saved sections, theme styles, publish history, restore session. |
| Versioning | Theme `version` must never change (stores pin it). Migrations and upgrade preview/rollback exist only for uploaded theme packages (`theme-packages/upgrade-service.ts`), not for built-in and folder themes. |
| Quality | `validate-theme.mjs`, conformance suite (`describeThemeConformance`), design lint (`e2e/design-lint.spec.ts`, preview only, CI job non-blocking), axe in the theme specs, settings fuzz, messy sample data. **No Lighthouse or performance budget anywhere** (no matches in e2e, scripts or CI). |
| Generation | One script per theme: `build-halo-theme.mjs`, `build-diode-theme.mjs`, `build-resthaven-settings.mjs`, `generate-forma-assets.mjs`; `new-theme.mjs` only for themes that extend Minimal or Avenue. Starters are hand-edited JSON (Resthaven `starter.json` 46 KB). |

### Where Jelly Shop already matches or beats Shopify

- Per-device (phone and tablet) values for spacing, alignment and text style. Shopify has only a few mobile settings.
- Undo/redo, restore session, drag on the preview, element-level selection.
- Scoped custom CSS per section and per theme, with safety checks.
- Colour schemes (up to 8, named, contrast fallback), text styles, theme styles, section presets with content.
- Nested groups (3 levels), app blocks (allow-listed providers), metaobject pages, translations of section text.
- Publish history with restore; immutable publications (the live store never changes until Publish).
- Faceted browse API, reviews, back-in-stock, quantity rules, personalisation (several of these are apps on Shopify).

The gap is not features. It is structure, ownership and verification.

---

## 4. Feature-by-feature comparison

Columns: **Shopify** · **Jelly today** · **Missing / wrong** · **Effect on quality** · **Fix**.

| # | Area | Shopify | Jelly today | Missing / wrong | Effect | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Who owns markup | Theme owns all markup, CSS, JS | Platform owns markup; theme adds CSS on top | Theme cannot shape structure; theme CSS reaches into 180 internal classes | Every renderer change can break themes; themes fight platform CSS | Keep declarative themes, but give them structure through blocks, variants and named parts (section 7) |
| 2 | Page shell | `layout/theme.liquid` + header/footer section groups | Each template lists `{kind:"global"}` refs for announcement, header, footer; `storefront-frame.tsx` draws chrome for built-in pages | No single layout; groups hold one fixed section each | Header/footer behave differently on built-in vs template pages | A layout per theme with real header and footer groups (any allowed section) |
| 3 | Templates | JSON per page type + alternates (`product.bed.json`), ≤ 25 sections | Templates per page type + alternates + assignments | Sound. No section cap (merchants can make 40-section pages). | — | Add caps (25 sections, 50 blocks) |
| 4 | Main sections | One main section per page, static blocks fix the layout | Product page = 13 sections laid out by CSS `:has()`; collection = header + grid sections | **Missing** | Any reorder, new section or setting can break the page (seen on `new`) | Main product, Main collection, Main cart, Main search, Main article with static blocks |
| 5 | Blocks | Section blocks or theme blocks (reusable, nestable), static blocks, `@app` | 24 global block types, groups 3 deep, app blocks | No static blocks; product parts (price, title, options, buy buttons) are sections, not blocks; each section lists its own allowed blocks | Product page cannot be composed inside one structure | Turn product parts into blocks; add static blocks; allow `@theme` style "any content block" |
| 6 | Where sections can go | Any template unless `enabled_on`/`disabled_on` | `supportedPages` whitelist: most content sections home-only | Wrong default | Merchants cannot add a FAQ, columns or a product row to product/collection pages; old starters used `custom-content` workarounds | Default to "everywhere" with `disabledOn` for page-specific sections |
| 7 | Presets / theme styles | Section presets; theme presets in `settings_data` + `/listings` per industry | Section presets + variants; theme styles (4 per theme); starter packs | Starters are not per-industry presets of one theme with their own demo content | Each new look needs a new theme | Theme = base + presets (style + starter + demo content) |
| 8 | Theme settings | ~130 settings | Resthaven 127 settings (built by script from Diode's) | Comparable | — | Keep; generate from one shared schema |
| 9 | Tokens → CSS | Theme writes variables in layout; same author writes CSS | Variables from `resolveStorefrontThemeTokens` (`--jelly-*`, `--theme-*`, `--store-*`), contract `--j-*`, theme `--rh-*`/`--tk-*` | Five families; aliases of aliases | Values set in one family are overridden in another; "endless CSS fixes" | One family (`--j-*`), generated; themes set values only |
| 10 | Colour schemes | `color_scheme_group`, class per scheme, every section picks one | Up to 8 schemes, `data-scheme` on the section frame, contrast fallback | Themes' own colour rules not fully on scheme roles (noted in earlier phases); no automatic banding | Sections inside dark schemes keep page colours in places; pages are one colour | Finish scheme roles; theme-defined scheme sequence |
| 11 | Typography | `font_picker`, global text presets (Horizon), custom only on demand | 28 fonts, text styles h1-h4/body/small, block text presets | h5/h6 missing; free sizes still exposed in Advanced | Inconsistent heading sizes when merchants tweak | Presets first, custom behind "Custom" |
| 12 | Containers and spacing | One `.page-width`; `spacing_sections`; per-section padding scaled on mobile | `SectionFrame` + contract tokens; per-section spacing presets + exact px; themes add their own `padding-block` (Resthaven `.jelly-section { padding-block: var(--rh-section) }`) | Two spacing systems at once | Gaps 96-208px on `new` | Spacing owned only by the section frame |
| 13 | Responsive | Breakpoints in the theme CSS (750/990 px in Dawn) | Phone < 768, tablet 768-1023, desktop ≥ 1024; per-device values | Themes add their own breakpoints (900px in Resthaven, 1024 elsewhere) | Layout jumps at different widths per section | One breakpoint set in tokens; lint refuses others |
| 14 | Product card | One snippet used everywhere | One `StorefrontProductCard` with parts, used everywhere | Good. Square/4:3 per theme; no packshot treatment | Mixed merchant photos look messy | Media frame with "packshot" mode |
| 15 | Product page | Main section; recommendations API; variant images; pickup; add-ons in custom themes | Separate sections, live related needs shared collection | Recommendations missing; layout fragile | Page ends after Add to basket on `new` | Main product + recommendations service |
| 16 | Collection page | Main collection grid + facets (platform filtering) | Collection header + grid, backend browse API with facets, sidebar/chips layouts | Collection is drawn in the browser; facets not in the URL | Slow first paint, no shareable filters, SEO | Server-render + facets in the URL |
| 17 | Cart | Template with main cart sections, cart drawer | Cart template (`cart-summary`) + slide-out bag | Comparable | — | Keep |
| 18 | Search | Template + predictive search API | Search template + suggestions in the browser from the synced catalogue | Search needs the whole catalogue in the browser | Does not scale to large catalogues | Server search endpoint |
| 19 | System pages | 404, password, gift card, contact as templates | 404 template reachable only for deep paths, status 200; unknown first-level and product paths show unstyled Next 404 | **Wrong** | Broken brand experience, wrong status codes | `not-found.tsx` under `[storeSlug]` rendering the theme 404 with status 404 |
| 20 | Rendering | Complete HTML on the server; Section Rendering API for updates | Home server-rendered; product and collection client-rendered after load | **Wrong for core pages** | Flash of "Loading…", worse LCP and SEO, preview/live differences | Resolve the route on the server; client only for interaction |
| 21 | Data binding | Liquid objects, dynamic sources, metafields | Bindings + custom data + metaobjects | Comparable | — | Keep |
| 22 | Placeholders | Sections show placeholders when content is missing | Sections return `null` when data is missing (e.g. `RelatedProductsSection`) | Missing contract | Empty pages and holes | Data contract + fallback per section |
| 23 | Translations | All theme strings in `locales/*.json` | Section text translatable; built-in words ("Add to cart") are not | Partial | Non-English stores mix languages | Locale files for built-in strings |
| 24 | Custom code | Custom Liquid section/blocks | Scoped custom CSS, app blocks (allow-list); no custom HTML | By design (safety) | — | Keep; maybe a sanitised "custom HTML" block later |
| 25 | Theme updates | New version; settings/templates carried over when IDs match | Packages: migrations + upgrade with preview/undo; folder/built-in themes: none; theme `version` frozen | **Missing for the themes we ship** | Old stores break when theme CSS changes (store `new`) | Structure revision + migrations for all themes |
| 26 | Static checks | Theme Check | `validate-theme.mjs`, conformance suite, schema checks | Comparable for schemas; no check that theme CSS stays off internals | Themes keep reaching into the renderer | Lint rule: theme CSS may use only tokens and named parts |
| 27 | Visual / performance checks | Lighthouse ≥ 60 perf, ≥ 90 a11y on real content; human review | Design lint + axe on preview sample data; no Lighthouse; CI lint non-blocking | Missing performance; no real-store checks | Problems found by the user, not by tests | Lighthouse budgets + lint on a demo store |
| 28 | Demo content | Demo store per preset, industry-sized catalogue | Preview sample data (tidy/messy); one staging test store | No standard demo catalogue per category | Themes look good only on curated samples | Demo content packs per category (≥ 24 products, real photo style) |
| 29 | Theme generation | Human designers, Skeleton base | Per-theme build scripts; hand-edited starters | No single pipeline | Each theme is a one-off | One generator from a brief: tokens, presets, starter, demo content |

---

## 5. Root causes (checked against your list)

| Suspected cause | Verdict | Evidence |
| --- | --- | --- |
| Incorrect theme architecture | **Yes, the main one.** Split ownership: the platform owns markup, the theme restyles it from outside. | Resthaven: 180 renderer classes, 33 `data-section-type` selectors; product layout in `:has()` rules (`theme.css:429-432`). |
| Missing reusable component system | **Partly.** Components exist (product card, gallery, toolbar, primitives `Stack/Grid/MediaFrame` used by one section). **Main sections and static blocks are missing.** | Product page = 13 sections; `layout.tsx` primitives used only by Multicolumn. |
| Inconsistent design tokens | **Yes.** Five token families; contract `--j-*` exists but others alias and override it. | Token counts in section 3. |
| Poor template composition | **Yes.** Flat section lists; header/footer refs repeated in each template; home-only whitelists push workarounds. | `starter.json`; `supportedPages`. |
| Missing page-level design rules | **Yes.** No rule for page rhythm (gaps, banding) or for what each page type must contain. | Gaps 96-208px on `new`; product page empty below Add to basket. |
| Container widths, grids, spacing | **Partly fixed earlier** (one container rule, `SectionFrame`), **but themes still add spacing and breakpoints of their own**. | `.jelly-section { padding-block: var(--rh-section) }`; 900px breakpoint in Resthaven. |
| Weak responsive standards | **Partly.** Per-device values are strong; breakpoints are not enforced. | Same. |
| Inconsistent global styles | **Yes.** Six CSS layers, one of them (`globals.css`) shared with the admin. | Line counts in section 3. |
| Theme-generation logic | **Yes.** One script per theme, hand-written starters, no demo content standard. | `scripts/`. |
| Missing validation and visual checks | **Yes for real stores and performance.** Good checks exist for the preview. | No Lighthouse; lint only on preview; CI non-blocking. |
| Missing standard presets and section schemas | **Partly.** Schemas are standard (zod + registry). Sections carry ~20 generic style settings each, so the editor offers many ways to break a design and few designed choices. Presets exist for 19 of 52 sections. | Registry counts. |
| (Not on your list) Rendering | **Yes.** Product and collection pages are client-rendered. | `curl` evidence. |
| (Not on your list) Versioning | **Yes.** No structure revision or migration for shipped themes. | Store `new`. |
| (Not on your list) Routing | **Yes.** Theme 404 unreachable for most bad URLs; wrong status. | `curl` evidence. |

---

## 6. Theme and template lifecycle (target for Jelly Shop)

1. **Brief**: category, audience, references, brand words, catalogue size (`docs/theme-briefs/`).
2. **Tokens**: colour schemes (with AA checks), fonts, text presets, spacing scale, radius, shadow, motion; written by the generator into the theme manifest.
3. **Component choices**: which variant of each platform block and main section (for example card style "tinted square", header "search first", product page "gallery left, sticky details"). No CSS yet.
4. **Named parts CSS** (optional, small): only for things tokens and variants cannot express. It may target only documented parts (`[data-part="price"]`), never internals.
5. **Templates**: one per required page type, each with its main section and a designed default order. Header and footer groups; scheme sequence for banding.
6. **Presets**: 2 to 4 per theme (style + starter + demo content), each a complete store look.
7. **Demo content pack**: a category catalogue with ≥ 24 products in one photo style, reviews, menus, pages.
8. **Checks**: schema and token lint, "no internals" CSS lint, conformance, design lint and composition rules on the demo store at 390/820/1280, axe, Lighthouse budgets, merchant-edit fuzz (reorder, scheme swap, font swap, remove optional blocks).
9. **Install**: the starter goes into a draft; the snapshot records `theme id`, `version` (unchanged forever) and a new **structure revision**.
10. **Merchant edits**: within blocks and settings. Main sections keep the layout; tokens keep colours and type; the section frame keeps spacing. A merchant can make things ugly by choice, but not broken by accident.
11. **Theme change**: a new structure revision ships with a migration; stores get an upgrade offer with preview and undo.

---

## 7. Proposed Jelly Shop theme architecture

### 7.1 Decision: keep declarative themes, change their building blocks

Two options were considered:

- **A. Themes own markup** (a template language or sandboxed components, like Liquid). It gives full design freedom, but it is a large security and performance surface, it is hard to review, and it conflicts with the earlier decision (2026-11-03) of "declarative themes, no uploaded code".
- **B. Platform owns markup, themes compose it (recommended).** The platform provides a complete, designed component system: main sections with static blocks, nestable content blocks, and variants of each. A theme picks variants, sets tokens, arranges templates and adds small named-part CSS. This is the direction of Shopify's Horizon (theme blocks, static blocks, text presets) without uploaded code.

With B, quality comes from the platform's components being designed once, well. Themes stay small, and old stores keep working because structure is versioned.

### 7.2 Layers

```
Store values      settings, templates, content            (merchant)
Theme             tokens, variant choices, presets, templates, named-part CSS, demo content   (theme author / generator)
Templates         layout (header group, main, footer group) + ordered sections, structure revision
Sections          main sections (static blocks, fixed layout) | content sections (hero, rows, stories…)
Blocks            content blocks (heading, text, button, image, video, group…) | product blocks (title, price, options, buy, promise, fold-out…)
Primitives        SectionFrame (scheme + spacing), Container, Grid (count-aware), MediaFrame (room/packshot), Card, Button, TextPreset
Tokens            one family --j-* (colour roles per scheme, type presets, spacing, layout, radius, shadow, motion, breakpoints)
```

Rules:
- Only the bottom two layers write CSS rules; themes write token values and named-part rules.
- Every section is wrapped by `SectionFrame`, which alone decides vertical spacing (scale S/M/L/none; neighbours with the same scheme share one gap) and the scheme class.
- Grids choose columns from the item count, or switch to a carousel (no empty slots).
- Every section declares a data contract (needs, fallback, placeholder in the editor).

### 7.3 Standard template and section structure

**Layout** (per theme): announcement + header group, main, footer group.

**Required templates** (each with a main section):

| Template | Main section and static blocks |
| --- | --- |
| Home | none (content sections) |
| Product | `main-product`: static `media` (gallery variants) + static `details` (title, rating, price, options, quantity, buy buttons, promise box, fold-outs, add-ons as blocks) |
| Collection | `main-collection`: static `banner` + static `toolbar` + static `grid` (filters sidebar/chips/drawer variants) |
| Collections list | `main-list-collections` |
| Search | `main-search`: static `toolbar` + static `results` |
| Cart | `main-cart`: static `items` + static `summary` |
| Page, Contact | `main-page`, `main-contact` |
| Blog, Article | `main-blog`, `main-article` |
| 404, Password | `main-404`, `main-password` |

**Content section catalogue** (~25, all allowed on every template unless page-specific): hero (4 layouts), slideshow, image with text, image banner, collection list (grid/bento/carousel), product row (grid/carousel/tabs), featured product, multicolumn, rich text, FAQ, testimonials, rating band, logo list, gallery, video, newsletter, trust/promise strip, store visit, custom content, apps, recently viewed, related products, spacer/divider.

**Standard section settings**: content settings (4-8, designed), then the universal four (colour scheme, width, spacing, show on), then a collapsed "Advanced" group with exact values.

**Caps**: 25 sections per template, 50 blocks per section.

### 7.4 Global design system (tokens)

| Group | Tokens |
| --- | --- |
| Colour roles (per scheme) | background, surface, text, muted text, heading, accent, button, button text, secondary button, border, sale, success, error; AA contrast enforced |
| Type | heading and body font, 7 presets (display, h1-h4, body, small, caption) each with size (fluid), line height, weight, tracking, case |
| Spacing | 4/8-based scale `--j-space-1…10`; section spacing none/S/M/L per device |
| Layout | page width (narrow/normal/wide), gutters per breakpoint, 12-column grid, breakpoints 768/1024/1280 only |
| Shape | radius (none/small/medium/pill) per component group: buttons, cards, media, fields |
| Elevation | shadow none/soft/medium |
| Motion | duration, easing, reduced-motion respected |

### 7.5 Rendering, routing, data

- Resolve every theme page on the server (route, template, resources). The client takes over only for cart, variant changes and filters.
- `app/[storeSlug]/not-found.tsx` renders the theme's 404 template with status 404 for every unknown store URL.
- A server endpoint re-renders one section with new parameters (the equivalent of Shopify's Section Rendering API) for filters, variants and recommendations.
- A recommendations service (same collection → same type → bestsellers → newest), used by both the preview and the live store.
- Retire `StoreDesignDocument` (v1) and the localStorage repository from the storefront.

### 7.6 Versioning

- Add `structureRevision` to the snapshot and the starter. The theme `version` stays frozen.
- Migrations per theme from revision N to N+1 (reuse `applyThemeMigrations` and the package upgrade flow: preview, apply to the draft, undo).
- The design lint fails when a store's revision is behind its theme's.

### 7.7 Quality gates (blocking in CI)

1. Schema, token and starter validation (exists).
2. **"No internals" CSS lint**: theme CSS may use only `--j-*` tokens and `[data-part]` selectors.
3. Conformance suite per theme (exists).
4. Design and composition lint on the **demo store** (not only the preview) at 390/820/1280, tidy and messy data: edges, contrast, tap targets, titles, plus new rules: empty grid slots, repeated photo, gap variance, empty main column, structure revision behind.
5. axe WCAG AA on every template (exists for theme specs).
6. **Lighthouse budgets**: performance ≥ 80 and accessibility ≥ 95 on home, product and collection, mobile and desktop (stricter than the Theme Store's 60/90).
7. Merchant-edit fuzz: reorder sections, swap schemes, change fonts, remove optional blocks, then rerun 4 and 5.

---

## 8. Roadmap

Foundations first. Each phase ends with a commit, tests, a browser check at 390/820/1280, and a report. Acceptance criteria are listed per phase.

| Phase | Work | Acceptance criteria |
| --- | --- | --- |
| **1. Correct rendering and routing** | Server-resolve product, collection, search and cart routes; theme 404 for every unknown store URL with status 404; remove `StoreDesignDocument` and localStorage fallbacks from the storefront path. | `curl` of product and collection pages contains the product/collection markup and no "Loading"; `/new/xyz`, `/new/products/nope`, `/new/a/b` all show the theme 404 with status 404; storefront tests pass. |
| **2. Versioned structure** | `structureRevision` in snapshot and starters; migrations and upgrade flow for folder and built-in themes; Resthaven old → current migration. | Store `new` can be upgraded to the current Resthaven layout and undone, with its text, photos and menus kept; lint flags stores behind their theme. |
| **3. Composition model** | Main sections with static blocks (product, collection, search, cart, page, article, 404); product parts become blocks; layout + real header/footer groups; `disabledOn` instead of home-only whitelists; caps 25/50. | Resthaven product and collection pages use main sections; zero `:has()` layout rules and zero `data-section-type` selectors in Resthaven CSS; every content section can be added to every template where it makes sense. |
| **4. One design system** | Single `--j-*` token layer generated from the theme; `SectionFrame` owns spacing and banding; count-aware `Grid`; `MediaFrame` packshot mode; named parts list (`data-part`); new themes skip `globals.css` legacy rules, `theme-kit` and section defaults. | Resthaven CSS ≤ 300 lines using only tokens and parts; no-internals lint passes; home gaps come from one scale; no empty grid slots at 1-8 products. |
| **5. Data contracts** | Contract + fallback + editor placeholder per section; recommendations service shared by preview and live; locale files for built-in strings; facets in the URL; server search. | No section renders nothing on a fresh store without explaining why in the editor; related products shown on every product page with ≥ 2 products in the store; preview and live use the same data functions (test). |
| **6. Quality gates** | Demo content packs (bed showroom first: ≥ 24 products, one photo style, reviews, menus, pages); composition lint rules; Lighthouse budgets; merchant-edit fuzz; CI blocking. | All gates green for Resthaven on the demo store; CI fails on a deliberately broken section. |
| **7. Resthaven as the reference theme** | Rebuild Resthaven on phases 1-6: tokens, variants, templates, presets (2-3 looks), demo content; migrate `new`. | Section 9 checklist passes; side-by-side review with DUSK/Sonno pages on rhythm, density and finish. |
| **8. Second category from the same system** | Generator: brief → tokens, variant choices, templates, presets, demo content; build furniture or fashion with no new platform code. | The second theme passes every gate with no hand-written CSS beyond named parts; build time is days, not weeks. |

Effort is not estimated here. Phases 1 and 2 are small and unblock everything else. Phase 3 is the largest.

---

## 9. Production-ready theme: acceptance checklist

**Coverage**
- [ ] Templates: home, product, collection, collections list, search, cart, page, contact, blog, article, 404, password; each with its main section.
- [ ] Built-in pages (checkout, account, order, wishlist) use the theme's tokens and pass the same visual checks.
- [ ] Every store URL renders a themed page with the correct status code.

**Structure**
- [ ] No theme CSS targets renderer internals (lint).
- [ ] Product and collection layouts survive any block reorder, removal or setting change (fuzz).
- [ ] Store snapshot structure revision equals the theme's.

**Design system**
- [ ] All colours from scheme roles; AA contrast in every scheme and theme style.
- [ ] All text from the 7 presets; no ad-hoc sizes in theme CSS.
- [ ] Section spacing from the scale only; gap variance within one step on every page.
- [ ] Breakpoints 768/1024/1280 only.

**Content resilience**
- [ ] Demo store and messy data: no empty grid slots, no repeated hero/category photo, no section missing without a fallback.
- [ ] Product page has full-width content below the buying area on a store with ≥ 2 products.

**Quality**
- [ ] Design lint zero findings at 390, 820, 1280 (tidy, messy, demo store).
- [ ] axe WCAG AA zero violations on every template.
- [ ] Lighthouse mobile and desktop: performance ≥ 80, accessibility ≥ 95 on home, product, collection.
- [ ] Server HTML of product and collection pages contains the main content.
- [ ] Keyboard-only run through header menu, filters, variant picker, bag, checkout.

**Merchant experience**
- [ ] Each section shows ≤ 12 settings before Advanced.
- [ ] 2-3 presets (theme styles + starters) that each look finished on the demo content.
- [ ] Upgrade to a newer structure revision previews and undoes cleanly.

---

## 10. Not verified in this report

- Shopify Theme Check's full list of checks and the exact theme update mechanics (described from general knowledge).
- Horizon was read, not run; Dawn was read, not run.
- DUSK product pages; tablet width of `new`; the checkout journey.
- Effort estimates.
