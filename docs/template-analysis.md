# Template system: Jelly Shop vs Shopify (gap analysis)

Date: 2026-11-16. Status: **Phase 1 (research and gap analysis, sections 1-5) approved; Phase 2 (architecture and roadmap, sections 6-8) for review.**

No code was changed for this report.

## How this was checked

| Source | What was used |
| --- | --- |
| Jelly Shop code (branch `redesign/jelly-shop-ui`) | `docs/schemas/sections.json` (generated from the registry: every section, block and setting), `storefront-registry`, `storefront-renderer`, `storefront-themes` (`platform-settings.ts`, `PLATFORM_SETTING_IDS`), editor in `features/store-editor/`, store routes in `app/[storeSlug]/`, the theme scorecard (`docs/reports/theme-scorecard.md`). |
| Shopify Theme Store | Dawn listing (features list, "Advanced customization options"). |
| Dawn demo store | `theme-dawn-demo.myshopify.com`, read live today: theme `Dawn 15.0.0`; section ids of home, collection, product, cart, search, blog, collections list and 404 pages. |
| Shopify theme editor | The user's store, live theme **Tinker** (Horizon family), opened in the user's Chrome. Seen today: editor top bar, Header / Template / Footer groups, Hero section panel. Nothing was saved. Chrome stopped returning screenshots after the Add block picker opened (a known extension problem on this machine), so the deeper editor detail (Add section library, theme settings, product template tree) comes from the same editor studied on 2026-11-06 (`docs/reports/2026-11-06-template-quality-shopify-analysis.md`). |
| Shopify Theme Store home and **Pebble** (added 2026-11-16 at the user's request) | `themes.shopify.com` top and new themes; Pebble listing (features, 5 presets); Pebble demo store `pebble-little.myshopify.com` (theme `Pebble 1.4.0`): section ids on 10 page types, blocks inside the product main section, design tokens, screenshots of the home page. See section 3.6. Pebble's theme editor in the user's store (Pebble installed on trial; read only, nothing saved): section tree, custom section settings, the full block and section libraries, theme settings, product template. See section 3.7. |
| Shopify developer docs | Section schema (attributes and limits), input setting types; JSON templates, section groups and theme blocks as summarised in `docs/reports/2026-11-12-shopify-theme-architecture-gap-analysis.md` (Dawn and Horizon source read there). |

Labels used below: **[seen]** observed today in the browser, **[docs]** Shopify developer docs, **[code]** checked in Jelly's code today.

---

## 1. Summary

Jelly Shop already has most of the *pieces* of a Shopify-style template system: JSON templates per page type, alternate templates with assignments, sections with typed settings and blocks, nested blocks, section presets, colour schemes, text styles, theme styles, draft vs publish, undo/redo, phone and tablet values, and one renderer for the editor and the live store. In several places it goes further than Shopify (per-device values, publish history with restore, scoped custom CSS checks, built-in reviews and filters).

What keeps Jelly templates below Shopify quality is not a missing feature list. It is five structural gaps:

1. **Themes cannot own their design.** On Shopify a theme writes all of its own markup and CSS. On Jelly the platform owns the markup and a theme restyles it from outside. Six of the seven complete themes still style renderer internals (scorecard: 5 to 46 internal class names per theme) and three different styling models are in use (platform base, "own" CSS, legacy global rules).
2. **Only one page type is composed like Shopify.** Shopify puts each page's core in one main section with fixed parts. Jelly has that for the product page in Resthaven only (`main-product`); the other six themes stack separate product sections and line them up with CSS.
3. **No header and footer section groups.** Shopify lets merchants add any allowed section to the header and footer areas [seen: "Add section" under Header and Footer]. Jelly's header region accepts only announcement + header, the footer region only the footer [code].
4. **Settings are wide and low-level.** A typical Jelly section exposes its own settings plus 21 shared style settings and many blocks add 22 more; Shopify sections expose settings about the section's job, with colours as palette references. Jelly has improved this (four universal settings up front, Advanced collapsed) but many sections still carry an "older choice" background and free px values.
5. **Fewer content types and pickers.** Shopify has pickers Jelly lacks (video, menu, page, blog, article, product list, collection list, metaobject) and section types Jelly lacks (contact form, collage, video section, image compare, pull quote, marquee, blog posts, collection list page, gift card, password template).

The current Theme Store leader **Pebble** (section 3.6) sharpens two of these. Its designers build most layouts from **one generic section filled with reusable blocks** (group, grid, text, accordion, marquee, icon, card), and its product page is **one main section holding any of those blocks**. Jelly's equivalents (Custom content, Main product) exist but have a much smaller block set. In Pebble's editor (section 3.7) the block picker offers about 55 block types and the section library about 85 presets, while Jelly's Custom content offers 7 blocks. Pebble also ships **five complete presets** of one theme, each with a demo store, and makes the cart drawer, search, quick add and popup editable sections.

Top priorities for Phase 2:
- one theme styling model with no internals
- a rich reusable block library (grid, accordion, marquee, icon, card, product blocks) usable in Custom content and in Main product
- main sections with static blocks for every page type
- header, footer and overlay section groups
- a short semantic settings model with palette-only colours
- several complete presets per theme, each with demo content
- the missing pickers and sections

---

## 2. Jelly Shop today

### 2.1 How a template is defined

| Layer | Where it lives | What it holds |
| --- | --- | --- |
| Theme definition | Built-in: `packages/storefront-themes/src/theme-registry.ts` (Minimal `jelly-signature`, Avenue). Folder themes: `src/themes/<id>/theme.json` + `starter.json` + `theme.css` + `assets/` (Resthaven, Diode, Halo, Forma, Harbour), indexed by `scripts/generate-theme-index.mjs`. Uploaded: theme packages (`backend/src/storefront/theme-packages/`). | Manifest (id, frozen version, `extends`), settings defaults, colour schemes, fonts, theme styles (`theme-styles.ts`), recipes. |
| Theme settings schema | `storefront-themes/src/platform-settings.ts` (one schema for all themes since 2026-11-13). | 131 settings, section 2.4. |
| Starter (default content) | `starter.json` per folder theme, `v4-starter-packs.ts` for built-ins; earlier layouts in `layout-history.json`. | Menus, global sections (announcement, header, footer), templates per page type with ordered sections and blocks. |
| Section definitions | `storefront-registry/src/sections/*.ts` (`layout`, `content`, `commerce`, `main-product`, `product-extras`), presets in `presets.ts` + `section-variants.ts`, elements in `section-elements.ts`. | Type, category, supported pages, allowed regions, allowed blocks, max blocks, controls (settings), defaults, presets. 55 sections, 35 block types, 31 presets on 21 sections. |
| Section rendering | `storefront-renderer/src/sections/*.tsx`, registered in `render-registry.tsx`, wrapped by `RegistrySectionRenderer` + `SectionFrame`. | React markup; settings turned into CSS variables and data attributes. |
| Stored design | Postgres: workspace generations (draft), immutable publications, active-publication pointer; runtime snapshot (`runtime-v4`): theme {id, version, settings}, templates, global sections, menus, assignments, layout revision. | Draft vs published; layout revisions with upgrade and Undo. |
| CSS | `section-defaults.css`, `storefront-base.css`, `platform-base.css`, `theme-kit.css` / `theme-kit-late.css`, per-theme file, plus inline styles from settings. | Platform layout, shared component design, theme identity. |

### 2.2 Page types

Templates built from sections: home, product, collection (also Shop all), search, cart, page, blog, article, 404. Built into the app and themed only by CSS: checkout, account pages (login, register, recover, overview, orders, order, addresses), wishlist, order confirmation, compare, contact, password page. Alternate templates per product/collection with assignment. Missing as templates: collections list, contact (as a section-built page), password, gift card.

### 2.3 Rendering, preview and editor

- **Rendering:** one renderer for editor preview and live store. Since 2026-11-12 store pages are laid out on the server (product, collection, search and cart HTML contains the sections) and every unknown store address shows the theme 404 with status 404.
- **Previews:** `/theme-preview/<theme>` (sample data, tidy/messy switch, all page types, three widths), full-page design preview on Store designs, theme CLI preview.
- **Editor** (`features/store-editor/`): page picker, section and block tree (search, hide/show, delete), add section from presets with sketches, saved sections, drag to reorder on the preview, floating toolbar (move, duplicate, hide, delete), element-level selection (parts of a section), nested groups three deep, desktop/tablet/phone preview with separate tablet and phone values, Show on, undo/redo per page, restore last session, colour palette with recent colours, rich text editor, translations, theme settings panel, theme styles and saved looks, publish + version history with restore, scoped custom CSS per section and per theme, reset design.

### 2.4 What already works well (keep)

- JSON-style templates, alternate templates, assignments, caps of 25 sections per template and 50 blocks per section (same as Shopify).
- Draft vs publish with immutable publications and restorable history (Shopify has no publish history for theme edits).
- Per-device values for spacing, alignment, text style, direction and gap on tablet and phone (Shopify has very few mobile settings).
- Colour schemes (up to 8, named, contrast fallback), text styles h1-h4/body/small, theme styles (4 per theme), section presets with content and sketches.
- Nested blocks three deep, app blocks (allow-listed providers), metaobject pages, dynamic-source bindings.
- Essential sections cannot be deleted or hidden (`essential-sections.ts`).
- Layout revisions with upgrade preview and Undo for shipped themes.
- Quality gates: design lint (tidy + messy data, three widths), axe with contrast, conformance suite, settings fuzz, merchant-edit fuzz, Lighthouse script, theme scorecard.
- Built-in commerce sections that are apps on Shopify: reviews, back-in-stock, compare, recently viewed, dimensions, personalisation, quantity rules, faceted browse API.

---

## 3. How Shopify builds themes

### 3.1 Theme structure [docs]

```
layout/theme.liquid        page shell: <head>, CSS variables from settings, header group, content, footer group
templates/*.json           page type templates (index, product, collection, ...) + alternates (product.bed.json)
sections/*.liquid          section = markup + {% schema %}; header-group.json / footer-group.json are section groups
blocks/*.liquid            theme blocks: reusable across sections, can contain other blocks
snippets/*.liquid          shared markup (product card, price, media)
assets/                    CSS, JS, images
config/settings_schema.json  global setting definitions
config/settings_data.json    merchant values + theme style presets
locales/*.json             every visible string, per language
```

The theme author writes all markup, CSS and JS. The platform supplies data, the editor, the composition format and checks. Every page is rendered complete on the server.

### 3.2 JSON templates and section schemas [docs]

- **JSON template**: an ordered list of sections with their settings and blocks. Up to 25 sections per template; alternate templates assigned per product, collection or page.
- **Section schema attributes**: `name`; `tag` (`article`, `aside`, `div`, `footer`, `header`, `section`); `class`; `limit` (1 or 2 per template or group); `settings`; `blocks`; `max_blocks` ("a limit of 50 blocks per section", static blocks do not count); `presets` (makes the section addable, optional `category`); `default` (for statically rendered sections); `locales`; `enabled_on` / `disabled_on` (by page type or section group; mutually exclusive).
- **Blocks**: either section-local block types or theme blocks (`@theme`) plus app blocks (`@app`). Theme blocks nest. **Static blocks** are rendered by the section itself, cannot be removed or moved, and hold the page's fixed structure (Horizon's product media + details).
- **Setting input types**: basic `checkbox`, `number`, `radio`, `range`, `select`, `text`, `textarea`; specialised `article`, `article_list`, `blog`, `collection`, `collection_list`, `color`, `color_background`, `color_palette`, `color_scheme`, `color_scheme_group`, `font_picker`, `html`, `image_picker`, `inline_richtext`, `link_list`, `liquid`, `metaobject`, `metaobject_list`, `page`, `product`, `product_list`, `richtext`, `text_alignment`, `url`, `video`, `video_url`. Settings can be shown conditionally (`visible_if`) and connected to metafields (dynamic sources).

### 3.3 Global settings [seen 2026-11-06, docs]

Tinker groups: Logo and favicon (incl. inverse logo for transparent headers) · Colour palette (6 swatches + add) · Typography (four font roles Body/Subheading/Heading/Accent; text presets Paragraph and Heading 1-n with size from a list, line height and letter spacing as Tight/Normal/Loose, case; "sizes automatically scale for all screen sizes") · Page (background, width) · Animations · Badges · Buttons (primary and secondary, palette colours, border, radius, font role, case) · Cart · Drawers · Icons · Input fields · Popovers and modals · Prices · Product cards · Search · Swatches · Variant pickers · Custom CSS · Theme style. Dawn adds colour schemes (background, text, button, button label, secondary button, shadow, gradient), page width, section spacing, cards, content containers, media, social, currency and customer accounts. Colours inside sections are palette or scheme references, not free hex.

### 3.4 Page types [seen today on the Dawn demo]

| Page | Dawn sections found on the demo store |
| --- | --- |
| Header group (every page) | `announcement-bar`, `header` |
| Home | `image_banner`, `rich_text`, `featured_collection`, `collage`, `video`, `multicolumn` |
| Collection | `banner` (main-collection-banner), `product-grid` (main-collection-product-grid) |
| Product | `main` (main-product with blocks: media gallery, title, price, variant picker, buy buttons, pickup, description, accordions), `image-with-text`, `multicolumn`, `related-products` |
| Cart | `cart-items`, `cart-footer`, `featured-collection` |
| Search | `main` (main-search) |
| Blog | `main` (main-blog) |
| Collections list | `main` (main-list-collections) |
| 404 | `main` (main-404), status 404 |
| Footer group (every page) | `footer` |

Pattern: every page type has a main section; header and footer come from section groups; extra content sections sit around the main section. Theme Store also requires page, contact, password and gift card templates [docs].

### 3.5 The theme editor [seen today + 2026-11-06]

- **Top bar**: exit; tabs Sections / Theme settings / Apps; theme name with Active badge; page picker (Home, Products with alternate templates and "Assigned to N products", Collections, Collections list, Gift card, Cart, Checkout and customer accounts, Pages, Blogs, Blog posts, Search, Password); Sidekick (AI); inspector toggle; phone preview toggle; undo / redo; more; **Save**.
- **Left panel**: tree in three groups, **Header** (Announcement bar, Header, Add section), **Template** (Hero, Featured collection, Media with text, Collection list, Add section), **Footer** (Add section, Media with text, Footer, Policies and links). Sections expand to show blocks and "Add block".
- **Selecting** a section outlines it in the preview with a name tag, adds `?section=<id>` to the address, opens its settings below the tree, and shows a floating toolbar (Ask for changes, duplicate, hide, delete).
- **Hero settings panel** [seen]: Media 1 and Media 2 (Image/Video, Select, Explore free images), mobile media options, Section link (link + open in new tab), Layout (Direction Vertical/Horizontal, alignment, position), Width, Height, Appearance (Background colour as "Palette color", Media overlay on/off, overlay colour, Solid/Gradient, Blurred reflection), Padding Top/Bottom in px (slider + number), collapsible Theme Settings, Custom CSS, Remove section.
- **Add section**: search, Sections/Apps tabs, Generate (AI), categories (Banners, Collections, Forms, Layout, Products, Storytelling, Text) with designed presets and a live thumbnail.
- **Reorder** by dragging in the tree; hide with the eye icon; remove from the panel or toolbar.
- **Draft vs publish**: edits are kept until Save; saving the live theme changes the store; draft themes are separate copies published as a whole. "Restore last session" offered after an unsaved session.

### 3.6 Current Theme Store reference: Pebble [seen today, 2026-11-16]

Added at the user's request as the main "latest Shopify template" reference.

**Theme Store home** (`themes.shopify.com`): "Top themes" are Allure ($100, 91%), **Pebble ($400, 99% positive)** and Swift ($220, 100%); "New to the Theme Store": Veloza, Omega, Attitude, Azimuth. The store promises every theme "product recommendations, reviews, discounts" and free updates. All of these are paid third-party themes; the bar is set by premium designer themes, not Dawn.

**Pebble listing** (by FoxEcom, "Fashion storytelling in motion"). Its three selling points:
1. "Fluid Layout Flexibility: using new theme blocks … reuse blocks, nest content, and build complex layouts with ease across all pages."
2. "Storytelling in Motion": scroll animations.
3. "Mobile Flow, Perfected": fluid typography, tap-friendly layouts.

Features listed: cart notes, in-store pickup, quick buy, slide-out and sticky cart; countdown timer, contact form, EU translations (EN/FR/IT/DE/ES), FAQ page, in-menu promos, product badges, promo banners and popups, quick view, recommended products, trust badges; animation, colour swatches, image rollover and zoom, lookbooks, product tabs, product videos, delivery info, size chart, slideshow, combined listings; breadcrumbs, enhanced search, infinite scroll, mega menu, filtering and sorting, sticky header, swatch filters. **5 presets** (Pebble, Rawjoy, Wellina, Framia, Bunie): one theme code, five complete store designs, each with its own demo store.

**Pebble demo store** (`pebble-little.myshopify.com`, theme `Pebble 1.4.0`), section ids read from each page:

| Page | Sections |
| --- | --- |
| Every page (groups) | `header`; footer group = a custom section + `footer`; overlay sections `cart-drawer`, `search-drawer`, `quick-add-drawer`, `popup` |
| Home (16 sections) | slideshow, collection tabs, scrolling cards, collection highlight, product tabs, layered scrolling cards, custom section, highlight text with image, custom section, products highlight, product suggestion, products bundle, testimonials parallax, two custom sections, flex carousel |
| Product (12 + groups) | `main` (theme blocks: breadcrumbs, badges, title, price, description, buy buttons, accelerated checkout, icon block, pickup availability, video testimonials, accordion, share, promotion text) then 6 custom sections, slideshow, products combine, testimonials parallax, product recommendations |
| Collection | breadcrumbs, `main-collection-banner`, `main` (grid), custom section |
| Collections list | breadcrumbs, hero banner, flex carousel, 3 custom sections, 2 featured collections |
| Search | `search-header`, `search-results` |
| Cart | `main` |
| Blog | breadcrumbs, `main`, custom section |
| Contact | breadcrumbs, `main`, 2 custom sections, store locator |
| 404 | `main` + featured collection, status 404 |

What this shows:
- **"Custom section" is the workhorse.** About a third of all sections on the demo are one generic section (`custom_section_*`) filled with theme blocks: group, grid, text, heading, accordion, marquee, separator, icon, media, card. Designers build most bespoke layouts by nesting reusable blocks, not by writing a new section each time. Jelly's "Custom content" section is the same idea but far less capable (12 blocks, one group level per direction, no grid, accordion, marquee, icon or card blocks).
- **The product main section is a stack of theme blocks**, not fixed product sections, so the merchant can add an accordion, icons or video testimonials inside the buying column.
- **Every page has extra content sections around its main section**, including collection, contact, blog and 404 pages, and the 404 page recommends products.
- **Overlays are sections**: cart drawer, search drawer, quick add and the newsletter popup are editable sections in a group, not hard-coded app parts.
- **Design tokens** (217 `:root` custom properties): page widths (`--page-width`, `--page-width-narrow`), type scale `--font-size--mega-title`, h1-h6, paragraph, small, line heights tight/normal/loose for heading and subheading, `--spacing-scale-sm/md/default`, separate font roles for heading, subheading, button, navigation and product card badges, field and button radii. At least 7 colour schemes in use (`color-scheme-1` … `color-scheme-9`, plus `color-scheme-inverse`).
- **Rhythm**: section padding 80-100px on desktop, set per section; hero and highlight sections have 0.
- **Look**: floating rounded header over the hero, rounded image cards (about 16-24px), product mini-cards laid over lifestyle photos with a "Shop" pill, pill buttons and fields, strong photography, timed popup.

### 3.7 Pebble in the theme editor [seen today, user's store, Pebble on trial, nothing saved]

**Editor tree (Home page)** in four groups:
- **Header**: Header, Add section.
- **Template** (17 sections): Slideshow: Minimal, Collection tabs: Carousel, Scrolling cards, Collection links, Product tabs: Carousel, Scrolling cards: Layered, Marquee, Highlight text with image, Marquee, Products highlight, Product suggestion, Products bundle, Testimonials: Parallax, Custom section, Marquee, Image cards: Carousel, Add section. Each name is "section: variant" (the preset it was added from).
- **Footer**: Add section, Custom section, Footer.
- **Overlay group**: Cart drawer, Search drawer, Quick add drawer, Popup, Add section.

**A custom section, expanded**: Add block › Group (Add block › Subheading "our story", Heading "Delicate ruffles…", Text, Button) › Group (Add block › Image with badges: Circle). The tree shows each text block's own words in italics, so merchants find content by what it says.

**Custom section settings**: "Read How-to" link at the top · Layout: Container Full/Fixed, Direction Vertical/Horizontal, Vertical on mobile (on/off), Alignment, Position, Horizontal gap, Vertical gap (px) · Mobile layout: separate horizontal and vertical gap · Appearance: Use colour scheme in container, Colour scheme (picker with swatch), Border None/Solid, Corner radius (px) · Padding with a **Desktop / Mobile** switch, Top and Bottom (px) · Theme Settings (collapsed) · Custom CSS · Remove section.

**Add block picker** (one block library for every custom section, plus Apps tab; searchable; each item shows a live preview on the right):
- Top: Contact form, Featured collection, Line item property (product pages), Spinning icon badge.
- Banners: Image with badges: Circle / Rectangle, Marquee, Marquee: Icon with text, Marquee: Lookbook cards.
- Basic: Article card, Button, Card layered, Collapsible text, Countdown timer, Countdown timer: Icon with text, Counter, Divider, Heading, Icon, Icon box: Card, Icon box: Standard, Icon list, Image, Image card, Image card: Countdown timer, Image comparison, Images stack, Press, Subheading, Testimonial, Text, Video, Video card, Video testimonials.
- Collection: Collection card. Custom: Custom liquid. Forms: Newsletter.
- Layout: Accordion, Breadcrumbs, Grid, Group.
- Product: Buy buttons, Description, Group, Lookbook card, Pickup availability, Price, Product badges, Product card, Product inventory, Product overlay card, Product recommendations, Product review stars, Product title, Share, Variant picker.
- Products: Frequently bought together. Storytelling: Locator, Section header: Horizontal, Section header: Vertical.

About 55 block types, all usable inside any custom section and inside the product details column.

**Add section library** (searchable, categories, live thumbnail, about 85 presets):
- Banners: Hero banner, Hero banner: With marquee, Images stack banner, Slideshow: Centered, Slideshow: Minimal.
- Basic: Collage: Editorial, Collection list: Circle thumbnail, Comparison gallery, Comparison table, Countdown timer, Highlight text with image, Icon boxes, Image cards: Carousel / Flex carousel, Lookbook banner, Lookbook carousel, Marquee (+ Gallery, Icon with text, Lookbook cards), Media gallery, Progress timeline, Scrolling cards (+ Layered), Shop the look.
- Collections: Collection links: Background / Image / Scrolling / Spotlight, Collection list: Carousel / Flex carousel / Grid, Collection tabs: Carousel / Grid.
- Custom: Custom liquid, Custom section. Forms: Contact form, Newsletter. Layout: Masonry section.
- Products: Featured collection: Carousel / Grid, Product highlight points, Product suggestion, Product tabs: Carousel / Grid, Products bundle, Products bundle: Choose, Products highlight.
- Storytelling: Blog post: Featured grid / Grid, Brand story gallery, Counter grid, FAQ: Banner / Image / Tabs / Texts, Feature grid, Icon with text, Image card layered, Image with text (+ Stacked), Press, Press with image, Rich text, Scrolling layers, Store locators, Testimonials: Carousel / Grid / Parallax / Slider / Split / Split full frame, Text with Badges, Video cards: Flex carousel.

**Theme settings groups**: Logo · Layout · Animations · Typography · Colors · Input fields · Buttons · Product badges · Product cards · Collection cards · Blog cards · Cart · Search · Dialogs · Social media · Prices · Custom CSS · Theme style. Several groups start with a "Read How-to" link.
- **Typography**: three fonts (Body, Heading, Highlight) plus extra weights to load; paragraph size (px); then a block per text role, each choosing Body or Heading font, weight, size as % of the paragraph size, letter spacing, case: **Subheadings, Headings (desktop and mobile size scale), Product card title, Product card price, Product card badges, Navigation**, Buttons.
- **Colors**: **15 colour schemes** shown as "Aa" swatches with an **Add scheme** tile ("Colour schemes can be applied to sections throughout your online store"), then badge colours by type (New badge, Hot badge, … background and text).

**Product template** (Default product; alternates shipped: **2-columns, flash-sale, inside-thumbnails**, plus Create template; "Preview: <product>" chooser at the top of the tree):
- **Product information** section with two fixed children: **Product media** (static, no Add block) and **Product details** (static column with Add block) holding: Breadcrumbs, Group (title, price…), Variant picker, Product inventory, Buy buttons (with children), Policies (group), Pickup availability, Video testimonials, Accordion (with rows), Share, Promotion alert, Product recommendations (complementary).
- Then 10 full-width sections: Custom section, FAQ: Texts, Slideshow: Centered, Products combine, Marquee, two Custom sections, Testimonials: Parallax, Custom section, Product recommendations.
- The product details "Add block" offers the same library as custom sections, plus the Product blocks.

**Other editor details seen**: top bar with Sections / Theme settings / Apps, theme name with Trial badge, page picker (Home page, Products, Collections, Collections list, Gift card, Cart, Checkout and customer accounts, Pages, Blogs, Blog posts, Search, Password), Sidekick, inspector, phone toggle, undo/redo, Save; floating toolbar on the selected section (Ask for changes, duplicate, hide, delete).

**What it means for Jelly**
1. The real gap is the **block library**, not the section list. Pebble's ~85 section presets are mostly designed starting points over ~55 shared blocks. Jelly has 7 general blocks in Custom content.
2. **Static columns + free blocks** is the product page model: fixed media column, fixed details column, any block inside the details. Jelly's Main product has the fixed columns but only 9 part types.
3. **Typography by role** (subheading, card title, card price, badges, navigation, buttons) and **many colour schemes** (15, add more) are what make a theme look consistent while still being flexible.
4. **Overlay group** makes drawers and popups editable like any section.
5. **Help in the editor**: "Read How-to" links on complex sections and settings groups; block content shown in the tree.
6. **Mobile values**: Pebble offers separate mobile values only for gaps, padding, heading scale and direction. Jelly already does more (tablet and phone for many settings).

---

## 4. What a merchant can edit when they pick a Jelly template

Every section below also has the **shared section settings** and every styled block the **shared block settings**.

**Shared section settings (21)**, grouped as the editor shows them:
- *Section* (up front): Colour scheme (scheme 1-8), Width (Page / Narrow / Full), Spacing (None / Small / Medium / Large / Custom), Show on (all / desktop + tablet / desktop / tablet + phones / phones).
- *Advanced* (collapsed): padding top and bottom (px), own colours (on/off, background, text), gradient colour and angle, heading font, size and weight, body font and size, alignment, minimum height, shadow, opacity, Custom CSS (max 2,000 characters, scoped).
- Phone and tablet values for heading size, alignment and padding.

**Shared block settings (22)** on heading, text, button, image, video and group: width fit/fill, max width, text style preset (h1-h4, body, small), text colour, background on/off + colour, gradient colour and angle, opacity, shadow, border (style, width, colour), corner radius, min height, margin top/bottom, padding on four sides, Show on; phone/tablet values for padding and text style.

**Element styles**: parts of a section (for example a hero's eyebrow and image, a footer's newsletter heading) can be selected on their own and get colour, font, size, weight and alignment (buttons also colours and corners, images corners).

**Theme settings (131)**: Colours (6: background, surface, text, secondary, primary, accent) · Colour schemes (count 4-8, each name, background, text, button, button text) · Typography (heading font, body font, heading weight, heading size, body size; 28 fonts) · Text styles (h1-h4, body, small: size, font, line height, letter spacing, case) · Buttons (radius, size, case, border width, hover) · Layout (content width, section gap) · Product cards (19: image ratio, style, alignment, radius, shadow, hover, card style, order, show title, title lines, show price, savings, button, brand, hover image, rating, compare, photo fit, swatches) · Badges (sale, position, shape, colours) · Fields (radius, border width, height) · Cart (slide-out bag / page / sheet, free delivery threshold) · Animations (reveal, smooth scroll) · Social links (8) · Languages · Custom CSS · Logo and favicon. Plus Theme styles (4 designed looks per theme) and Saved looks.

### 4.1 Sections and their own settings

Settings types: T text, RT rich text, TA textarea, I image, L link, C colour, S select/segmented, R range/number, B on/off, P product, Co collection, F font.

**Header and footer (global)**

| Section | Own settings | Blocks (max) |
| --- | --- | --- |
| Announcement bar | Message (T), Link (L), Seconds per message (R); message style | text, announcement message (6) |
| Header | Store name (T), Logo (I), Logo width (R), Logo position left/centre (S), Sticky (B), Over the first image (B), Logo over images (I), Show search / account / wishlist / bag (B), Header layout classic / search bar / split / minimal / category bar / search first (S), Delivery note (T), Menu style dropdown / mega (S), Mega photo shape (S), Words next to icons (B), Extra link text, link, icon | menu, trust point |
| Footer | Store name (T), About (RT), Contact email (T), Copyright (T), Newsletter on/off, heading, text (RT), Payment methods (T) | menu, link heading, link, social link, contact item |

**Content sections (allowed on every section-built page)**

| Section | Own settings | Blocks (max) | Presets |
| --- | --- | --- | --- |
| Hero | Eyebrow (T), Image (I), Layout split / overlay / text / spotlight / statement / countdown (S), Callouts (TA), Countdown date and end text (T), Height (S), Alignment (S), Image darkness (R) | heading, text, button (4) | 3 |
| Slideshow | Height, Alignment, Image darkness, Autoplay (B), Seconds per slide (R) | slide: image, eyebrow, heading, text, button text + link (6) | 1 |
| Collection list (category grid) | Heading, Text (RT), Layout grid / bento / carousel, Columns, Image shape | collection card: title, image, link (8) | 3 |
| Image with text | Eyebrow, Image, Image position left/right | heading, text, button, group | 3 |
| Image banner | Image, Height, Alignment, Image darkness | heading, text, button, group (4) | 1 |
| Image text (older) | Content alignment | heading, text, button | 0 |
| Custom content | Direction, Alignment, Gap, Content width | heading, text, button, image, video, app, group (12) | 1 |
| Rich text | (shared only) | heading, text, button | 1 |
| Multicolumn | Heading, Columns, Alignment | column: title, text; heading, text, button (8) | 3 |
| Testimonials | Heading, Layout grid / carousel | testimonial: quote, name, product, stars, photo (6) | 1 |
| FAQ | Heading, Text (RT) | question + answer (12) | 1 |
| Newsletter | Button label, Alignment | heading, text | 1 |
| Featured collection | Heading, Text, Collection (Co), Order, Products to show, Columns, View all text + link, Hide when empty, Empty message | none | 1 |
| Product grid | as Featured collection + Heading alignment | product tab: name, collection, order (4) | 3 |
| Featured product | Product (P), Eyebrow, Why it is special (TA), Photo, Button text, Photo position | none | 1 |
| Shop the look | Eyebrow, Heading, Text, Image, Photo position | hotspot: product, left %, top % (6) | 1 |
| Trust badges | Layout row / scroll, Speed, Show icons | trust point: text, icon, link; heading, text (10) | 1 |
| Rating | Heading, Source manual / reviews, Average, Count, Text, Link + text, Alignment | none | 1 |
| Photo gallery | Heading, Text, Layout grid / scroll, Photos per row, Photo shape | gallery image: photo, caption, link (24) | 1 |
| Logo list | Heading, Logo height, Grey logos | logo: image, name, link (12) | 1 |
| Store visit and contact | Heading, Text, Address, Opening hours, Phone, WhatsApp, Email, Map link, Photo | contact item (6) | 0 |
| Metaobject entries | Heading, Metaobject handle (typed), Layout, Columns, Entries, Show details, Link entries | none | 1 |
| Apps | Content width, Gap | app: provider, embed link, name, height (6) | 1 |
| Recently viewed | Heading, Products to show, Columns | none | 0 |
| Journal teaser, Image mosaic (theme-pack) | Eyebrow, Summary, Body, Columns, Overlay, Layout, Alignment, Full bleed, Background (free colour), Heading font, Top spacing, Link, Image, Product, Collection | heading, text, button | 0 |
| Spacer / Divider / Spacer with divider | Size or spacing | none | 0 |

**Page-specific sections**

| Page | Section | Own settings | Blocks |
| --- | --- | --- | --- |
| Product | Main product (Resthaven) | Photos left/right, Photo column narrow/medium/wide, Keep in view media/details/none, Gallery layout thumbnails/stacked/grid, Photo shape, Thumbnails below/left, Zoom (B), Label on photo, Image fit | parts (16): rating, title and price, options, add to basket, stock counter, trust strip, description, info tabs, specifications (each with the settings of the matching section below) |
| Product | Product gallery | as above + Product page layout (6 choices) | none |
| Product | Title and price | Vendor, SKU, Specifications, Compare-at price, Availability (B), Sale label none/%/amount, Monthly payments months + text + link | none |
| Product | Options | Style buttons/select/tiles/tabs, Tiles per row, Link other colours (B) | none |
| Product | Add to basket | Quantity (B), Button label, Sticky bar (B) | none |
| Product | Description | Heading, Plain/expandable, Start open | none |
| Product | Info tabs | Accordion/chapters, Open first | info tab: title, text (8) |
| Product | Specifications | Heading, Product's own specs (B), Leave out measurements, Table/expandable | spec row (12) |
| Product | Dimensions | Heading, Diagram (I), Note, cm/in, Switch (B) | none |
| Product | Stock counter | "Only a few left" threshold, Show plentiful count | none |
| Product | Reviews | Heading, Empty text, Allow writing, Reviews shown | none |
| Product | Related products | Heading, Products to show | none |
| Collection | Collection header | Layout simple/banner, Alignment, Title, Description, Long descriptions, Image, Breadcrumb (B) | none |
| Collection | Collection products | Columns, Per page, Empty message, Sort (B), Filters (B), Filters to show (T), Layout grid/sidebar/chips/editorial | story tile (3) |
| Collection | Collection description | Spacing | none |
| Search | Search results | Sort, Filters, Filters to show, Columns | none |
| Cart | Bag summary | (shared only) | none |
| Page | Page content | (shared only) | none |
| Blog | Blog header; Article list | Text, alignment; list/grid, columns, summary, date, read more, empty message | none |
| Article | Article header; Article content | Date, summary, alignment; text width | none |
| 404 | 404 message | theme-pack settings (as Journal teaser) | heading, text, button |

**Block types (35)**: heading (formatted one line), text (rich text), button (text, link, new tab, style filled/outlined/link, size, hover, colours), image (image, link, shape, darken), video (link, cover, shape, autoplay, controls), group (direction, alignment, line up, gap, stack on phones; holds content blocks, 3 levels), app, slide, collection card, column, testimonial, FAQ item, logo, gallery image, hotspot, trust point, announcement message, contact item, spec row, info tab, product tab, story tile, menu, link heading, link, social link, and the nine Main product parts.

---

## 5. Gap report

Priority: **P1** blocks Shopify-level quality, **P2** needed for parity, **P3** nice to have.

| # | Feature | Shopify has it | Jelly Shop has it | What's missing | Priority |
| --- | --- | --- | --- | --- | --- |
| **Structure** | | | | | |
| 1 | Theme owns its markup and CSS | Yes, theme writes all markup/CSS | No by design: platform owns markup, theme restyles it | Themes depend on renderer internals (5-46 per theme); three styling models in use. Needs one model: themes set tokens, choose variants, style named parts only | P1 |
| 2 | One page shell (layout) | `layout/theme.liquid` | Partly: `RuntimeStorefrontView` draws announcement, header, main, footer; built-in pages use `storefront-frame.tsx` | One theme-level layout used by every page, including checkout/account | P2 |
| 3 | JSON templates per page type | Yes | Yes | — | — |
| 4 | Alternate templates + assignment | Yes | Yes (create, rename, delete, assign) | — | — |
| 5 | Caps: 25 sections, 50 blocks | Yes | Yes | — | — |
| 6 | Main section per page type | Yes, every page | Product in Resthaven only; collection/search/cart/page/blog/article/404 have an essential main-like section, not a composite | Main product in the other six themes; composite main sections where a page has fixed parts | P1 |
| 7 | Static blocks (fixed structure) | Yes (Horizon) | Partly: Main product's photo and details columns are fixed in markup; Add to basket part is essential | A general static-block concept in the schema, shown as locked in the tree | P2 |
| 8 | Header and footer section groups | Yes, merchants add sections there | No: header region = announcement + header; footer = footer only | Section groups with any allowed section | P1 |
| 9 | `enabled_on` / `disabled_on` | Yes | Yes in effect (`supportedPages`, content sections on every section-built page) | — | — |
| 10 | Section `limit` (1 or 2) | Yes | No | A per-section limit (e.g. one Main product, one header) | P3 |
| 11 | Theme blocks reusable across sections (`@theme`) | Yes | Partly: one global block library, each section lists allowed types | "Accept any content block" shorthand | P3 |
| 12 | Nested blocks | Yes | Yes (3 levels) | — | — |
| 13 | Snippets / shared components | Yes (card, price, media) | Yes (one product card, gallery, primitives) | Primitives (`Stack`, `Grid`, `MediaFrame`) used by few sections | P2 |
| 14 | Product card as an editable block | Yes (Horizon card block with children) | No: card is set theme-wide in theme settings | Card editable once in a section, applied to every card | P2 |
| 15 | Locales for theme strings | Yes, every string | Partly: section text translatable, ~62 built-in words in a dictionary; header tools, newsletter, reviews, bag, checkout not moved | Finish the dictionary; merchant can edit default words | P2 |
| **Schema and settings** | | | | | |
| 16 | Typed section schema | Yes (Liquid schema) | Yes (zod + registry, JSON Schema exported) | — | — |
| 17 | Presets per section | Yes, in categories with thumbnails | Yes: 31 presets on 21 of 55 sections, with sketches | Presets for the remaining content sections; categories like Shopify's | P2 |
| 18 | Settings about the section's job | Yes, short lists, px padding | Partly: 4 universal settings up front, 17 more in Advanced; 15 sections still carry "Background (older choice)" (shown only while a store has it saved) | Migrate and retire older-choice settings; fewer free values | P1 |
| 19 | Colours as palette/scheme references | Yes ("Palette color") | Partly: schemes and palette swatches exist, but own-colour and element colour fields take free hex | Palette-first colour fields; free hex only in the palette editor | P1 |
| 20 | Conditional settings (`visible_if`) | Yes | Yes (`showWhen`, `visibleWhenSaved`) | — | — |
| 21 | Video picker / video URL | Yes | Partly: video link text field in the video block; hero and slides take images only | Video in hero, banner, slides; uploaded video | P2 |
| 22 | Pickers: page, blog, article, menu, product list, collection list, metaobject | Yes | No (product and collection single pickers only; metaobject by typed handle; menus not pickable in sections) | These pickers | P2 |
| 23 | Text alignment control with icons | Yes | Yes (segmented) | — | — |
| 24 | Dynamic sources (metafields) in the editor | Yes | Yes (bindings) | — | — |
| 25 | Custom HTML / Liquid section | Yes | No (by design, safety) | Possibly a sanitised HTML block later | P3 |
| **Global settings** | | | | | |
| 26 | Colour schemes | Yes | Yes (up to 8, named, contrast fallback) | Secondary button, shadow and gradient per scheme | P3 |
| 27 | Typography roles and text presets | Yes (4 roles, presets with Tight/Normal/Loose) | Yes (2 fonts, h1-h4/body/small) | Subheading and accent font roles; h5/h6 | P3 |
| 28 | Buttons | Primary + secondary styles | One button style (radius, size, case, border, hover) | Secondary button style in theme settings | P2 |
| 29 | Logo, inverse logo, favicon | Yes | Yes (inverse logo on the header section) | — | — |
| 30 | Page width, section spacing | Yes | Yes | — | — |
| 31 | Drawers, popovers, icons, prices, variant pickers, swatches | Yes | Partly (cart drawer, swatches, badges, fields) | Icon set, drawer style, variant picker style as theme settings | P3 |
| 32 | Theme styles (designed looks) | Yes | Yes (4 per theme + saved looks) | — | — |
| **Page types** | | | | | |
| 33 | Home, product, collection, cart, search, page, blog, article, 404 | Yes | Yes | — | — |
| 34 | Collections list template | Yes | No | Template + main section | P2 |
| 35 | Contact page template with form section | Yes | Built-in contact page, no contact-form section | Contact form section, usable on any page | P2 |
| 36 | Password and gift card templates | Yes | Password page built in (not editable as a template); no gift card | Password as a template; gift card later | P3 |
| 37 | Checkout and account editable in the editor | Checkout/accounts via settings | Built in, themed by CSS only | Settings for these pages in the editor | P3 |
| **Section library** | | | | | |
| 38 | Hero, slideshow, image with text, banner, multicolumn, rich text, FAQ, testimonials, newsletter, featured collection, featured product, collection list, logo list, gallery | Yes | Yes | — | — |
| 39 | Collage, video section, image compare, pull quote, marquee, blog posts, contact form, recommended products (any page), complementary products | Yes | No (video only as a block in Custom content; related products on product pages only) | These sections | P2 |
| 40 | AI section generation ("Generate", Sidekick) | Yes | No | Out of scope for now | P3 |
| **Editor** | | | | | |
| 41 | Section tree, add, remove, reorder, hide | Yes | Yes (plus drag on the preview) | — | — |
| 42 | Header / Template / Footer groups in the tree | Yes | Partly: shared sections listed separately | Three-group tree once section groups exist | P2 |
| 43 | Block editing, nested blocks in the tree | Yes | Yes | — | — |
| 44 | Live preview, click to select, floating toolbar | Yes | Yes (plus element-level selection) | — | — |
| 45 | Device toggle | Desktop / mobile | Desktop / tablet / phone, with separate values | — | — |
| 46 | Undo / redo | Yes | Yes (per page, keyboard) | — | — |
| 47 | Draft vs publish | Save to live or draft theme | Draft workspace, Publish, version history, restore | — | — |
| 48 | Restore last session | Yes | Yes | — | — |
| 49 | Page picker with alternates and "Preview: product" | Yes | Yes | — | — |
| 50 | Add section with designed thumbnails | Yes (live thumbnail) | Sketches | Real rendered thumbnails | P3 |
| **Quality** | | | | | |
| 51 | Static checks (Theme Check) | Yes | Yes (validator, conformance, schema, scorecard) | Scorecard not yet green for 6 of 7 themes | P1 |
| 52 | Performance and accessibility bar | Lighthouse ≥60 perf, ≥90 a11y | Lighthouse script, axe, design lint | Lighthouse in CI per theme on a demo store | P2 |
| 53 | Demo store per theme style | Yes | Resthaven only | Demo content pack per theme | P2 |
| 54 | Theme updates keep merchant changes | When ids stay compatible | Layout revisions with merge, preview and Undo | — | — |
| **From the Pebble reference (section 3.6)** | | | | | |
| 55 | Generic "custom section" built from a rich block library | Yes: about a third of Pebble's sections; blocks include group, grid, text, heading, accordion, marquee, separator, icon, media, card | Partly: Custom content (12 blocks: heading, text, button, image, video, app, group) | Grid, accordion, marquee, separator, icon, card and product blocks; more than 12 blocks; presets of designed custom sections | P1 |
| 56 | Product main section as a stack of reusable blocks | Yes (badges, title, price, buy buttons, icons, pickup, video testimonials, accordion, share, any text) | Partly: Main product holds 9 fixed part types | Allow the general content blocks (text, accordion, icons, group, video) inside the buying column | P1 |
| 57 | Content sections around the main section on every page, incl. 404 with products | Yes | Yes since 2026-11-12 (content sections allowed on every section-built page) | Starters still use few of them outside the home page | P2 |
| 58 | Several complete presets per theme, each with a demo store | Yes (Pebble: 5) | Partly: 4 theme styles per theme change settings only; one starter per theme; one demo store (Resthaven) | A preset = style + starter layout + demo content; several per theme | P2 |
| 59 | Overlays as editable sections (cart drawer, search drawer, quick add, popup) | Yes | No: slide-out bag and search panel are built in, set only by theme settings; no promo popup | Overlay section group; popup section | P2 |
| 60 | Merchandising sections: collection tabs, scrolling cards, products bundle, product suggestion, products highlight, flex carousel, testimonials parallax, store locator | Yes | Partly: product grid tabs, shop the look, featured product, store visit | Bundle, scrolling cards, carousel of any blocks, parallax testimonials, quick view | P2 |
| 61 | Breadcrumbs on any page | Yes (section/block) | Collection header only | Breadcrumb block or section | P3 |
| 62 | Font roles beyond heading/body (subheading, button, navigation) and h5/h6, mega title | Yes | Heading + body, h1-h4 | More roles and sizes | P3 |
| 63 | Scroll animations and fluid type as a selling point | Yes | Yes (reveal, smooth scroll; fluid sizes in themes) | Per-section animation choice | P3 |
| **From the Pebble editor (section 3.7)** | | | | | |
| 64 | Size of the shared block library | About 55 block types in 9 categories, live preview per block | 35 types in all, but only 7 general ones in Custom content; the rest belong to one section each | Grow the general library (section 3.7 list is the reference) and show a live preview in the picker | P1 |
| 65 | Section presets as variants of a few sections | About 85 presets named "section: variant" | 31 presets on 21 sections | More designed presets per section (e.g. Testimonials: grid/carousel/parallax/slider/split) | P2 |
| 66 | Alternate templates shipped with the theme | Yes (2-columns, flash-sale, inside-thumbnails) | Merchants can create alternates; themes ship only the default | Starters may include alternate templates | P3 |
| 67 | Typography per role (subheading, card title, card price, badges, navigation, buttons) with sizes as % of body | Yes | Text styles h1-h4/body/small; card and button text follow them | Role-based type settings | P2 |
| 68 | Number of colour schemes | 15, merchant can add more | Up to 8 | Raise the limit; scheme picker with "Aa" swatches | P3 |
| 69 | Help inside the editor ("Read How-to" links) | Yes | Some descriptions under settings | How-to links on complex sections and setting groups | P3 |
| 70 | Block content shown in the tree | Yes (text in italics) | Block names only | Show a short excerpt of each text block | P3 |

---

# Phase 2: architecture and roadmap

Approved 2026-11-16. This part proposes the target design and the order of work. No code has been changed yet; each roadmap phase is built, tested, committed and reported on its own, with your go-ahead before the next one (the working agreement in `CLAUDE.md`).

## 6. Template architecture

### 6.1 Decisions

1. **Keep declarative themes** (decided 2026-11-03: no uploaded code). The platform owns markup, as now. Shopify gets quality from theme authors writing markup; we get it by making the platform's sections and blocks good enough that themes only choose and style them. Pebble shows this works: most of its pages are a generic section filled with shared blocks.
2. **Blocks are the main unit, sections are containers and presets.** We grow one shared block library (about 50 types) that works inside a generic section, inside any section that accepts content, and inside the product details column. Sections stay few and solid; variety comes from presets.
3. **Fixed structure where pages need it.** Main sections have static blocks the merchant cannot delete or move (product photos and details, collection grid, cart items, and so on). Everything else is free.
4. **One design system.** Themes set tokens (colours by scheme, type by role, spacing, radius), pick variants and add a little CSS on named parts. No theme styles renderer internals (already measured by the scorecard).
5. **Nothing breaks for live stores.** Theme `id` and `version` never change. Old section types keep rendering. Structure changes reach stores only through layout revisions with preview and Undo (built 2026-11-12).

### 6.2 Composition model

```
Theme              tokens, settings defaults, presets (style + starter + demo content), named-part CSS
└─ Layout          one per theme: header group, main, footer group, overlay group
   ├─ Section groups   header / footer / overlay: ordered lists of shared sections (merchant can add)
   └─ Template          per page type (+ alternates): up to 25 sections
      └─ Section        main section | content section | generic "Custom section"
         ├─ Static blocks   fixed parts drawn by the section (cannot be removed or moved)
         └─ Blocks          from the shared library, nested up to 3 levels, up to 50 per section
            └─ Settings     typed controls; colours point at schemes or the palette
```

What changes compared with today:
- **Section groups**: today the snapshot holds `globalSections` and each template points at them with `{kind: "global"}`. We add `sectionGroups: { header: id[], footer: id[], overlay: id[] }` to the snapshot. Templates stop listing header and footer; the layout draws the groups. Old snapshots without groups are read as today (header = announcement + header, footer = footer).
- **Overlay group**: the slide-out bag, search panel, quick add and popup become sections in the overlay group, with the theme settings they use today as defaults.
- **Block sets**: a section says which blocks it takes by naming sets, not listing types: `"@content"` (the shared content blocks), `"@product"` (product blocks, product pages only), `"@app"`, plus its own private block types if it has any. This is Shopify's `@theme` idea.
- **Static blocks**: a section can declare `staticBlocks` (id, type, label). The editor shows them locked in the tree; they can hold their own child blocks.
- **Where sections can go**: `enabledOn` / `disabledOn` by page type and by group replace `supportedPages` + `allowedRegions` (both still read for old definitions).
- **Limits**: `limit: 1 | 2` per section (one Main product, one header).

### 6.3 Section library (target)

About 32 sections, about 100 presets. ✓ = exists today, ↑ = exists and gets more presets or blocks, + = new.

| Category | Section | Presets (variants) | Blocks it takes |
| --- | --- | --- | --- |
| **Header group** | Announcement bar ✓ | Static, Rotating, Marquee | announcement message |
| | Header ↑ | Classic, Logo centre, Split, Minimal, Category bar, Search first, Floating (rounded bar over the hero) | menu, trust point, button |
| **Footer group** | Footer ↑ | Columns, Newsletter first, Minimal, Big logo | link column, text, newsletter, social, payment icons, contact |
| **Overlay group** | Slide-out bag + | Drawer, Bottom sheet | text, product recommendations, free-delivery bar |
| | Search panel + | Drawer, Full screen | text, collection links |
| | Quick add + | Drawer, Modal | (fixed) |
| | Popup + | Newsletter, Promo, Age check | @content |
| **Banners** | Hero ↑ | Overlay, Split, Spotlight, Statement, Countdown, With marquee, Images stack | @content |
| | Slideshow ✓ | Full frame, Inset, Centred, Minimal | slide |
| | Image banner ✓ | Full, Inset | @content |
| **Generic** | Custom section ↑ (today "Custom content") | 15+ designed presets: Image with badges, Text with badges, Story split, Icon boxes, Counter grid, Feature grid, Press, Store locator, Comparison table, Progress timeline | @content, @app |
| **Collections** | Collection list ↑ | Grid, Bento, Carousel, Circle thumbnails, Links: background / image / scrolling / spotlight | collection card |
| | Collection tabs + | Carousel, Grid | collection tab |
| **Products** | Product row ↑ (product grid + featured collection merged; old types kept as aliases) | Grid, Carousel, Tabs, Large | product tab |
| | Featured product ✓ | Left, Right | (fixed) + @content |
| | Shop the look ✓ | Hotspots, Lookbook carousel | hotspot |
| | Products bundle + | Fixed bundle, Choose items | product |
| | Recommended products + (any page) | Related, Complementary, Recently viewed | (fixed) |
| **Storytelling** | Image with text ↑ | Left, Right, Stacked, Overlap | @content |
| | Multicolumn ↑ | Icons, Cards, Numbers | column (+ @content inside) |
| | Rich text ✓ | Centred, Left, Jumbo | @content |
| | Video + | Full width, Inset, Video cards carousel | video |
| | Collage + | Editorial, Masonry | image, product card, video, text |
| | Image compare + | Slider | (fixed) |
| | Marquee + | Text, Icons, Gallery, Lookbook cards | text, icon, image, product card |
| | Scrolling cards + | Standard, Layered | card |
| | Testimonials ↑ | Grid, Carousel, Slider, Split, Parallax | testimonial |
| | FAQ ↑ | List, Two columns, With image, Tabs, Banner | FAQ item, heading, text |
| | Blog posts + | Grid, Featured grid, Carousel | (fixed) |
| | Logo list, Gallery, Rating, Trust badges, Store visit ✓ | as today | as today |
| **Forms** | Newsletter ✓ | Inline, Banner, With image | @content |
| | Contact form + | Simple, With details | form field |
| **Main sections** | Main product ↑ | Gallery left, Gallery right, Thumbnails inside, Two columns, Details below, Compact | static: media, details (details takes @product + @content) |
| | Main collection ↑ (header + grid kept as two essential sections, as Dawn) | Simple, Banner; Grid, Sidebar, Chips, Editorial | story tile |
| | Main search, Main cart, Main page, Main blog, Main article, Main 404 ✓ | as today | |
| | Main collections list + | Grid, List | |
| | Main password + | Centred, Split | @content |
| **Layout** | Spacer, Divider ✓ | | |
| | Apps ✓ | | app |

### 6.4 Block library (target)

`@content` blocks work everywhere content is allowed; `@product` blocks only on product pages (Main product details, Featured product). Blocks marked ✓ exist today.

| Group | Blocks |
| --- | --- |
| Text | Heading ✓, Subheading +, Text ✓, Collapsible text +, Section header (horizontal / vertical) +, Badge / sticker (spinning, pill) +, Counter +, Countdown timer + |
| Media | Image ✓, Video ✓, Image card +, Images stack +, Image comparison +, Icon +, Logo ✓, Gallery image ✓ |
| Action | Button ✓, Button group +, Newsletter form +, Contact form +, Share links + |
| Layout | Group ✓, Grid +, Accordion + (with accordion row), Tabs +, Divider +, Spacer +, Carousel + |
| Cards | Card (image + text + link) +, Card layered +, Icon box (standard / card) +, Icon list +, Testimonial ✓, Press quote +, Article card +, Collection card ✓, Product card +, Product overlay card +, Lookbook card +, Video card + |
| Commerce (`@product`) | Product title +, Price +, Variant picker +, Quantity +, Buy buttons +, Product badges +, Inventory / stock +, Pickup availability +, Description +, Specifications +, Dimensions +, Review stars +, Trust points +, Delivery estimate +, Complementary products +, Frequently bought together +, Line item property (personalisation) +, Promotion alert +, Breadcrumbs + |
| Other | App ✓, Store locator +, Custom CSS (on any block, scoped) |

Today's nine Main product "parts" become the matching commerce blocks (rating, title and price, options, add to basket, stock, trust strip, description, info tabs, specifications). A layout revision moves saved parts across with their settings.

Every block gets the same small style set that sections have today (Section 4: width, max width, text style, colour from the scheme, background, border, radius, padding, Show on, phone and tablet values), shown under "Advanced" except the two or three that matter for that block.

### 6.5 JSON schema for sections, blocks and settings

Definitions stay TypeScript objects checked by zod in `storefront-registry` and exported as JSON Schema (`docs/schemas/sections.json`). The shape (new fields marked `// new`):

```jsonc
// Section definition
{
  "type": "custom-section",
  "label": "Custom section",
  "category": "generic",
  "enabledOn": { "pages": ["*"], "groups": ["template", "footer", "overlay"] },   // new, replaces supportedPages/allowedRegions
  "limit": null,                                                                      // new: 1 | 2 | null
  "blocks": ["@content", "@app"],                                                     // new: block sets and/or own types
  "maxBlocks": 50,
  "staticBlocks": [],                                                                 // new: [{ "id": "media", "type": "product-media", "label": "Product photos" }]
  "settings": [
    { "type": "select", "id": "container", "label": "Width", "options": ["page", "full"], "default": "page" },
    { "type": "segmented", "id": "direction", "label": "Direction", "options": ["vertical", "horizontal"], "mobile": true },
    { "type": "color_scheme", "id": "scheme", "label": "Colour scheme", "default": "scheme1" },          // new type
    { "type": "range", "id": "gap", "label": "Gap", "min": 0, "max": 120, "unit": "px", "mobile": true },
    { "type": "checkbox", "id": "schemeInContainer", "label": "Colour the content box only",
      "visibleIf": { "container": "page" } }                                          // renamed from showWhen
  ],
  "presets": [
    { "id": "image-with-badges", "label": "Image with badges", "category": "storytelling",
      "thumbnail": "image-with-badges", "settings": { "direction": "horizontal" },
      "blocks": [ { "type": "group", "blocks": [ { "type": "subheading" }, { "type": "heading" }, { "type": "text" }, { "type": "button" } ] },
                  { "type": "image-card", "settings": { "shape": "circle" }, "blocks": [ { "type": "badge" }, { "type": "badge" } ] } ] }
  ],
  "dataNeeds": { "products": false },                                                 // exists as SECTION_DATA_NEEDS; moves here
  "helpUrl": "/help/custom-section"                                                   // new: "Read how-to" link
}

// Block definition
{
  "type": "accordion",
  "label": "Accordion",
  "sets": ["@content"],                                                               // new: which sets it belongs to
  "blocks": ["accordion-row"], "maxBlocks": 20,
  "settings": [ { "type": "checkbox", "id": "openFirst", "label": "Open the first row" } ],
  "presets": [ { "label": "Accordion", "blocks": [ { "type": "accordion-row" }, { "type": "accordion-row" } ] } ],
  "preview": "accordion"                                                              // new: picker preview
}
```

**Setting types** after this work (✓ exists):
- basic: text ✓, textarea ✓, rich-text ✓ (inline ✓), number ✓, range ✓ (unit ✓), select ✓, segmented ✓, checkbox ✓
- design: color ✓ (gets palette-only mode), color_scheme +, font ✓, spacing ✓, text_alignment ✓ (segmented)
- resources: image ✓, link ✓, product ✓, collection ✓, video + (upload or YouTube/Vimeo), product_list +, collection_list +, page +, blog +, article +, menu +, metaobject + (replaces typing a handle)
- behaviour flags: `mobile` ✓ (phone and tablet values), `visibleIf` (✓ as `showWhen`), `element` ✓, `legacy` ✓, `translatable` ✓, dynamic source binding ✓

**Template file** (what the snapshot stores per template; unchanged shape apart from groups):

```jsonc
{
  "id": "product.default", "type": "product", "handle": "default",
  "layout": {
    "sections": [
      { "id": "main", "type": "main-product", "settings": { "mediaPosition": "left" },
        "blocks": [
          { "id": "media", "type": "product-media", "static": true },
          { "id": "details", "type": "product-details", "static": true, "blocks": [
              { "id": "title", "type": "product-title" }, { "id": "price", "type": "price" },
              { "id": "picker", "type": "variant-picker" }, { "id": "buy", "type": "buy-buttons" },
              { "id": "faq", "type": "accordion", "blocks": [ { "type": "accordion-row" } ] } ] } ] },
      { "id": "recs", "type": "recommended-products", "settings": {} }
    ]
  },
  "layoutRevision": 7
}
```

### 6.6 Global theme settings (target)

The platform owns one list (`platform-settings.ts`, done 2026-11-13). Additions in **bold**.

| Group | Settings |
| --- | --- |
| Logo | logo, **inverse logo** (moves from the header section), favicon, logo width |
| Layout | page width (narrow / normal / wide), section spacing, **phone spacing scale** |
| Colours | palette (6 named colours), **colour schemes up to 16** (background, text, button, button text, **secondary button, border, muted text**), **badge colours by type** (sale, new, sold out, custom) |
| Typography | heading, body, **highlight** fonts; body size; **text roles**: subheading, h1-h6 scale (desktop and phone), **product card title, product card price, badges, navigation, buttons**, each with font, weight, size as % of body, letter spacing, case |
| Buttons | **primary and secondary**: radius, size, border, case, hover |
| Fields | radius, border, height ✓ |
| Product cards | today's 19 settings ✓ |
| **Collection cards, blog cards** | shape, radius, text position, overlay |
| Badges | position, shape ✓ |
| Cart | type, free delivery ✓ (defaults for the overlay sections) |
| Search | **suggestions on/off, show collections and pages** |
| **Dialogs** | radius, shadow, overlay darkness |
| **Icons** | icon set (line / solid / rounded), stroke width |
| Animations | reveal, smooth scroll ✓, **per-section choice** |
| Prices | **show currency code, compare-at style** |
| Social, Languages, Custom CSS ✓ | |
| Theme style | ✓ (designed looks) |

### 6.7 Template generator

Goal: a new template is a **brief plus choices**, never new platform code. It builds on `scripts/new-theme.mjs` (Harbour was made with it) and the template programme rules (`storefront-themes/src/template-programme.ts`).

```
brief (docs/theme-briefs/<id>.json)
  category, audience, brand words, references, catalogue size, base theme, 2-5 preset names
        │
        ▼
1. Tokens        colours → schemes (AA checked), fonts by role, radius, spacing, motion
2. Variants      header, card style, product page layout, collection layout, cart type
3. Page recipes  per page type: an ordered list of section presets with slot rules
                 (home: one banner, one collection showcase, one product row, one or two stories,
                  social proof, newsletter; product: main product recipe + 2-4 sections; ...)
4. Copy + images copy from the brief; images from the demo content pack or placeholders
5. Presets       for each preset: style tokens + recipe choices + demo content pack
        │
        ▼
output: themes/<id>/theme.json, starter.json, presets/<preset>.json, SOURCES.md
        │
        ▼
checks: validate-theme · conformance suite · scorecard (must be all green)
        design lint tidy + messy at 390/820/1280 · axe incl. contrast · merchant-edit fuzz
        Lighthouse on a demo store · distinctness (template-programme rules)
```

Page recipes are data (`storefront-themes/src/recipes/pages/*.ts`), e.g. "editorial home", "conversion home", "showroom product page". A template is distinct from others by its recipe mix, variants and tokens, checked by `checkTemplateDistinctness`.

### 6.8 Migration and compatibility

| Change | How existing stores keep working |
| --- | --- |
| Section groups | Snapshots without `sectionGroups` keep the old header/footer behaviour. A layout revision adds the groups; Undo restores. |
| Main product parts → commerce blocks | Layout revision maps each part to its block with the same settings (the mapping code from the 2026-11-12 upgrade is reused). |
| Product grid + featured collection → Product row | Old types stay registered as aliases that render through the new section. |
| Custom content → Custom section | Same type id; only gains blocks and presets. |
| Block sets, `enabledOn` | Old `allowedBlockTypes`, `supportedPages`, `allowedRegions` are still read. |
| New theme settings | Each has a default equal to today's look; tokens are written only when changed (the pattern already used). |
| Theme versions | Never bumped. |

## 7. Roadmap

Each phase ends with unit tests, the theme specs, the design lint (tidy + messy), screenshots of every theme preview at 1280/820/390 compared with the start of the phase, a commit and a report. Phases 1-3 of `docs/plans/theme-foundation-plan.md` that are still open (Main product and groups theme by theme, one styling model) are folded in here as phases T5 and T8.

Size: S = up to a day, M = a few days, L = a week or more.

| Phase | Work | Main files | Done when | Size |
| --- | --- | --- | --- | --- |
| **T1. Schema foundations** (done 2026-11-16) | Block sets (`@content`, `@product`, `@app`), `staticBlocks`, `limit`, `enabledOn`/`disabledOn`, `visibleIf` alias, `helpUrl`; read old fields; JSON Schema export | `packages/storefront-registry/src/types.ts`, `define.ts`, `registry.ts` (`listSectionDefinitionsForPage`, validation), `blocks.ts`, `essential-sections.ts`; `packages/storefront-schema/src/block-tree.ts`; `packages/storefront-themes/src/schema-export.ts`; `scripts/generate-schemas.mjs`, `scripts/generate-control-types.mjs`; backend `storefront/compiler/validate-registry.ts` | Every existing section validates unchanged; new fields covered by tests; `docs/schemas/sections.json` regenerated; backend tarballs repacked | M |
| **T2. Block library, wave 1** (layout and text; done 2026-11-16) | Subheading, Section header, Collapsible text, Grid, Accordion + row, Tabs, Divider, Spacer, Icon, Icon list, Icon box, Card, Badge, Counter, Button group | new `packages/storefront-registry/src/blocks/` (one file per group), `packages/storefront-renderer/src/blocks/` (new folder, one component per block), `render-registry.tsx`, `custom-content.tsx` (draw any `@content` block), `storefront-base.css` + `section-defaults.css` (zero-specificity block styles), `theme-parts.ts` (named parts) | Each block renders in all 7 themes at 3 widths with axe clean; usable in Custom content and groups; settings fuzz passes | L |
| **T3. Custom section v2 + presets** (done 2026-11-16) | Rename label to "Custom section"; settings like Pebble (container, direction, phone direction, gaps per device, scheme in container, border, radius, padding per device); 15 designed presets; picker with live preview | `registry/src/sections/content.ts`, `section-variants.ts`, `presets.ts`; renderer `custom-content.tsx`; editor `section-options.ts`, `components/section-library.tsx`, `components/preset-sketch.tsx` (live thumbnail), `block-editing.ts` | Presets render on every theme preview; Add section shows categories and live previews | M |
| **T4. Block library, wave 2** (media, cards, forms; done 2026-11-16) | Image card, Images stack, Image comparison, Video card, Product card, Product overlay card, Collection card (general), Article card, Press, Testimonial (general), Newsletter form, Contact form (+ backend form endpoint reuse), Share, Countdown, Store locator | as T2; the contact form posts to the existing public `POST …/contact` route in `backend/src/customers/routes.ts` (shown in Customers > Messages) | Same checks as T2; contact form message reaches Customers > Messages | L |
| **T5. Main product v2** | Static `media` + `details` blocks; details takes `@product` + `@content`; commerce blocks (title, price, variant picker, quantity, buy buttons, badges, stock, pickup, description, specs, dimensions, review stars, trust, delivery estimate, complementary, frequently bought together, personalisation, promotion alert, breadcrumbs); layout revision maps old parts; then each theme moves its product page (Diode, Halo, Forma, Minimal + Harbour, Avenue) | `registry/src/sections/main-product.ts`, `parts.ts`; renderer `sections/main-product.tsx`, `product-sections.tsx`, `product-showroom.tsx`; `storefront-themes/src/layout-revisions.ts`, each theme's `starter.json` + `layout-history.json`; backend `storefront/layout-upgrade/`; theme CSS files; `src/app/themes/theme-scorecard.test.ts` | Scorecard "Main sections" column green for all 7 themes; store `new` upgraded on staging with Undo working; product page survives the merchant-edit fuzz | L |
| **T6. Section groups and overlays** | `sectionGroups` in the snapshot; layout draws header/footer/overlay groups; editor tree in four groups with Add section; overlay sections (bag, search, quick add, popup) replacing built-in panels | `storefront-schema/src/runtime-v4.ts`; backend `storefront/compiler/compiler.ts`, `snapshot.ts`, `workspace/*`, `template-service.ts`; `src/features/storefront/runtime-storefront-view.tsx`, `components/storefront-frame.tsx`, `components/theme-cart-drawer.tsx`; renderer new `sections/overlays/`; editor `components/template-hierarchy.tsx`, `global-section-panel.tsx`, `page-hierarchy.tsx`; layout revision per theme | Merchant can add a Custom section to the footer and a popup to the overlay group in the editor, publish, and see them live; old snapshots render as before (test) | L |
| **T7. Settings model** | Text roles and h5/h6; highlight font; up to 16 colour schemes with secondary button, border, muted; secondary button style; dialogs, icons, collection/blog cards, prices groups; `color_scheme` control; palette-only colour fields; retire "older choice" settings with a layout revision | `storefront-themes/src/platform-settings.ts`, `theme-style-settings.ts`, `contract-tokens.ts` (+ `scripts/generate-contract-css.mjs`), `storefront-base.css`, `platform-base.css`; registry `section-style.ts`, `block-style.ts`; editor `components/inspector/style-controls.tsx`, `controls/`, `color-schemes.ts`, `color-palette.ts`, `theme-settings-panel.tsx` | Defaults leave every theme pixel-identical (screenshot compare); new settings change the preview; AA contrast fallback holds for 16 schemes | M |
| **T8. One styling model per theme** | Move Minimal, Harbour, Avenue, Forma, Halo, Diode onto the platform base (tokens + identity CSS), delete `theme-kit.css`, `theme-kit-late.css` and the old `globals.css` storefront rules; load only the active theme's CSS | `src/app/themes/*.css`, `src/app/layout.tsx`, `storefront-themes/src/theme-registry.ts`, folder themes' `theme.css` + `scripts/generate-theme-assets.mjs`, `theme-css-internals.baseline.json` | Scorecard "Styling" and "Internals styled" green for all themes; phone Lighthouse re-measured | L |
| **T9. Pickers and missing sections** | Video, product list, collection list, page, blog, article, menu, metaobject pickers; sections: Video, Collage, Image compare, Marquee, Scrolling cards, Collection tabs, Products bundle, Recommended products (any page), Blog posts, Contact form; templates: collections list, password | editor `components/inspector/` (new picker controls), `dynamic-source-picker.tsx`; registry `types.ts` (control types); renderer `sections/`; `storefront-schema` page types; store routes `src/app/[storeSlug]/collections/page.tsx`, password page in `[storeSlug]/layout.tsx`; backend `storefront/compiler/validate-references.ts` | Each picker saves and resolves on the live store; new sections pass T2 checks; new templates appear in the page picker | L |
| **T10. Presets per theme** | A preset = style + recipe choices + demo content; 3 presets for Resthaven first, then 2-3 for each other theme; Store designs lists presets under each theme | `storefront-themes/src/themes/<id>/presets/*.json` (new), `theme-styles.ts`, `starter-packs.ts`; demo packs `themes/<id>/demo-content.json`; backend `scripts/install-resthaven-demo.ts` generalised to `install-demo.ts`; `src/features/store-editor/template-gallery.ts`, `admin/online-store/page.tsx` | Each preset installs on a staging demo store and passes the design lint and Lighthouse budgets | L |
| **T11. Template generator** | Brief schema, page recipes, preset output, all checks in one command | `scripts/new-theme.mjs` (extend), new `storefront-themes/src/recipes/pages/`, `template-programme.ts`, `docs/theme-briefs/`, `docs/guides/template-generation-master-prompt.md`, `docs/guides/theme-developer-guide.md` | One brief produces a theme with 2 presets that passes every gate with no hand-written CSS beyond named parts | M |
| **T12. Editor polish** | Live previews in the block and section pickers, text excerpts in the tree, "How-to" links, block search | editor `components/section-library.tsx`, `template-hierarchy.tsx`, `components/inspector/setting-groups.tsx`, new help pages under `docs/help/` | Checked in the signed-in editor (needs your sign-in) | S |
| **T13. Proof** | Every theme and preset on a staging demo store; shopper journey with the Stripe test card; CI gates blocking (design lint, scorecard, conformance, Lighthouse on demo stores) | `.github/workflows/core-mvp.yml`, `e2e/`, `scripts/lighthouse-budget.mjs` | All gates green in CI; launch checklist done per theme | M |

**Order and dependencies**

```
T1 ─┬─ T2 ─ T3 ─ T4 ─┐
    │                ├─ T9 ─ T10 ─ T11 ─ T13
    ├─ T5 ───────────┤
    ├─ T6 ───────────┤
    └─ T7 ─ T8 ──────┘
T12 any time after T3
```

T1 comes first because every other phase uses its schema fields. T2-T4 (blocks) give the biggest visible gain. T5 and T6 can run alongside the block work because they touch different files. T8 needs T7's tokens.

**Recommended first three phases**: T1, then T2, then T5 (the product page is where stores lose sales and where today's structure is weakest).

### 7.1 Progress

**T1 done 2026-11-16.** In `storefront-registry`:
- **Block sets** (`@content`, `@product`, `@app`): blocks join them with `sets`; a section or block may list a set in `allowedBlockTypes` and the registry expands it to types, keeping `blockSets`. Heading, text, button, image, video and group are `@content`; app is `@app`; `@product` has no members until T5. Built-in sections' lists are unchanged.
- **Static blocks** (`staticBlocks: [{ type, label }]`, identified by type so copied ids don't matter): added to new sections' default blocks, valid without being in `allowedBlockTypes`, not counted toward block limits, at most one each (`STATIC_BLOCK_REPEATED`). The editor offers no move, duplicate, hide, delete or drag on them and shows "Fixed" in the tree.
- **Limit** (`limit: 1 | 2`): Main product is 1. Editor (save guard + Add section hides the section) and backend (`TEMPLATE_SECTION_LIMIT`) refuse only a change that adds a copy past the limit.
- **Placement** (`enabledOn` / `disabledOn` with `pages` incl. `"*"` and `groups`): resolved into `supportedPages`, `allowedRegions` and a new `groups` list that may include `overlay` (used from T6). Old fields still work.
- **Conditions** (`visibleIf` with `equals`, `oneOf` or `notEquals`), read with `showWhen` by `controlConditionMet` in the settings panel.
- **Help links** (`helpUrl`, `/help/…` or https) on sections and blocks; shown in the editor from T12.
- `defineSection` / `defineBlock` refuse unknown sets, bad limits, both placements, repeated static blocks, bad help links and unclear conditions. `docs/schemas/sections.json` lists the new fields. Backend tarballs repacked.

**T2 done 2026-11-16 (block library, wave 1).** 18 new block types in `storefront-registry/src/content-blocks.ts`: subheading, section header, collapsible text, grid, accordion (+ accordion row), tabs (+ tab), divider, spacer, icon, icon list (+ item), icon box, card, badge, counter, button group. All top-level ones join `@content`, so Custom content (now `["@content", "@app"]`, up to 24 blocks) and groups take them; grids take `@content` too (3 levels in all; blocks that hold blocks are left out at the last level). They get the shared block style settings (no text style on divider, spacer, icon). Drawn by `storefront-renderer/src/sections/content-blocks.tsx` through Custom content's `renderBlocks` (also inside groups in other sections); styles at the end of `storefront-base.css` (zero specificity, tokens only; tablet and phone rules for grid columns/gaps, header and card layouts, stacked buttons). Accordion uses native `<details>` (one-at-a-time via the `name` attribute); tabs follow the arrow keys, Home and End. Three Custom content presets show them: Icon boxes, Questions and answers, Numbers. Editor: block names, icons in the tree, row titles in the tree. Checked: unit tests incl. axe on every block, the platform baseline page in the browser at 1280 and 390px (no sideways scroll), and inside Resthaven and Minimal.

**T3 done 2026-11-16 (Custom section).** "Custom content" is now called **Custom section** (type id `custom-content` unchanged). New settings: Line up (top/middle/bottom) and Block widths (equal/fit) for horizontal rows, and an optional **content box** (own colour scheme, padding with phone/tablet values, corners, border), drawn as `.jelly-custom-content-box` with `data-scheme`. 13 designed presets in `section-variants.ts`: Icon boxes, Questions and answers, Numbers, Story with photo, Text with badges, Feature cards, Image cards, Press quotes, Promise row, Tabs, Call to action (dark box), How it works, Details in two columns. **Live preview in Add section:** pointing at (or tabbing to) a choice draws that section at the end of the page preview, outlined and scrolled into view, without saving (`libraryPreviewId` in editor state, `libraryPreviewSection` in use-editor-derived, drawn by editor-preview-pane). Checked: the presets on the platform baseline page inside Resthaven at 1280 and 390px (no sideways scroll, rows stack on phones, box padding shrinks), design lint 17/17, unit tests. Not checked: the live preview in the signed-in editor. Add section categories are unchanged (Banners, Products, Content, Marketing, Layout).

**T4 done 2026-11-16 (block library, wave 2).** 12 more `@content` blocks in `storefront-registry/src/media-blocks.ts`, drawn by `storefront-renderer/src/sections/media-blocks.tsx`: image card (text over or below a photo), images stack (cascade or fan), image comparison (before/after slider on a range input), video card, product card and product over photo (pick a product, empty = the first one), press quote, email sign-up (the existing newsletter form), contact form (sends through the existing rate-limited `/engagement/contact` route via the new `CommerceDataProvider.sendContactMessage`, live store only), share links (copy link, WhatsApp, Facebook, X, Pinterest), countdown and shop address (directions from the address, only https map links). Five more Custom section presets: Lookbook, Image tiles, Before and after, Visit our shop, Contact us (18 in all). Left out on purpose: article card (needs the article picker, T9) and adding the old collection-card and testimonial blocks to the set (their sections would show style settings they ignore). Checked: unit tests incl. axe on every block, presets on the platform baseline inside Avenue in the browser (found and fixed dark headings over photos), design lint 17/17.

**T5 part 1 done 2026-11-17 (Main product v2, platform).** Main product's buying column now takes `["@product", "@content", "@app"]` (up to 30 blocks): every product part (parts joined `@product`; Dimensions is now a part too), new product blocks in `storefront-registry/src/product-blocks.ts` (Breadcrumbs, Delivery estimate (worked out in the browser in UK time: cut-off hour, dispatch days, delivery range, optional weekends), Pairs well with (from the same recommendations as Related products)), a new general Notice block (`@content`), and the whole shared content library (accordion, icon list, share links…). Drawn by `storefront-renderer/src/sections/product-blocks.tsx`; non-part blocks in the column go through Custom section's `renderBlocks` inside `.jelly-product-part[data-part="block"]`. **Decision: no static `media`/`details` blocks.** The section already draws the photo column itself and its blocks are the details column, which gives the same result (fixed columns, free buying details) without changing saved data, so no store needs migrating. Editor: Add block groups choices under Product / Content / Apps (`blockPickerGroups`). Checked: unit tests (incl. axe, delivery dates across cut-off and weekends), the blocks in the Resthaven preview product page at 1280 and 390px with a temporary starter change (reverted), design lint 17/17. **T5 part 2 (not started):** move Diode, Halo, Forma, then Minimal + Harbour and Avenue from separate product sections to Main product (a layout revision with Undo per theme, and each theme's product CSS onto the platform base).

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| More blocks and settings make the editor harder to use | Presets first; each block shows 2-3 settings up front and the rest under Advanced; section settings stay ≤ 12 before Advanced (existing rule) |
| Theme CSS breaks when renderer markup changes | Named parts only (`theme-parts.ts` test), scorecard gate |
| Snapshot change (section groups) breaks old stores | Groups optional; old shape covered by tests; change reaches stores only through a layout revision with Undo |
| Store page size grows with 50 blocks | Blocks are small components; only the active theme's CSS (T8); Lighthouse budget in CI |
| Contact form and popup invite spam | Honeypot and rate limit (pattern already used for reviews and back-in-stock) |
| Uncommitted older work in the tree | Commit only this work's files with explicit paths (existing agreement) |

## 9. Not verified in this report

- Shopify's Add section library, theme settings and product template tree were not re-read today (Chrome stopped returning screenshots); they come from the 2026-11-06 study of the same editor.
- Horizon and Dawn source were read on 2026-11-12, not today.
- Jelly's signed-in editor was not opened today; editor features are taken from the code and earlier signed-in checks recorded in `CLAUDE.md`.

**T5 part 2, folder themes, done 2026-11-17.** Diode, Halo and Forma product pages are Main product (layout revision 2; revision 1 kept in each theme's `layout-history.json`, its grid rules in `legacy.css`, which `generate-theme-assets.mjs` and `generate-forma-assets.mjs` append). Parts: information, options, purchase, then Diode/Halo a delivery estimate + trust strip, Forma the description/specifications/details fold-outs; the rest stays full width. Each theme sets `--mp-*` knobs in its theme.css (Forma keeps side by side from 768px with its own grid rule); `jelly-main-product-grid/-media/-details` are named parts. `main-product-themes.test.ts` checks the new starter and the upgrade from revision 1 (merchant edits carried into parts). Before/after shots match (desktop starts ~25-30px lower: normal section spacing); design lint, Forma spec and theme tests pass. Built-in themes done 2026-11-17: Minimal (`jelly-signature`), Harbour and Avenue product pages are Main product too (layout revision 2). Built-in starters keep earlier layouts in `storefront-themes/src/builtin-layouts/<id>.json` (pack-shaped `globalSections` + `templates`, listed in `builtin-layouts/index.ts`; copy the current pack there before changing a built-in starter in a way stores should be offered); `layout-revisions.ts` reads them for themes without a folder starter, so the backend upgrade panel works for built-ins with no backend change. `mainProductLayout()` in `v4-starter-packs.ts` builds the product page for the two complete packs (Fresh Market and Artisan Boutique unchanged); hashes and snapshot updated. Harbour has `layout-history.json` (revision 1) and was regenerated from its brief. Theme CSS section 9.9 in `jelly-minimal.css`/`jelly-avenue.css` (old `:has()` rules kept for stores on revision 1; Avenue's photos run to the page edge by its own grid rule). Diode/Halo/Forma photo width now applies only to Half, so a merchant's Photo column choice works. Before/after positions identical at 1280/768/390 in all three; Minimal + Avenue specs and full design lint pass. Not run: backend tests with the repacked tarballs, signed-in editor, staging upgrade of a built-in store.

**T6 part 1.** Built 2026-11-17 (header and footer section groups, user chose a stored groups list over page positions): `StorefrontWorkspace.sectionGroups` JSONB (migration `20261117000000_section_groups.sql` in both migration folders and the PGlite list; applied to staging 2026-11-17 and checked: jsonb column, RLS on, `jelly_backend` policy only, no browser grants), NULL = no saved groups, so every existing store draws exactly as before. Shared rules `storefront-schema/src/section-groups.ts` (`StorefrontSectionGroups` {header, footer, overlay} of GlobalSection ids, max 12 each; `deriveSectionGroups` works them out from the home template's shared sections; `readSectionGroups`; `chromeGroupOf`), optional snapshot field `sectionGroups` (runtime-v4; old readers break on it because the snapshot schema is strict, so deploy the frontend before the backend). `expandRawRuntimeLayout` draws saved groups as header/footer on every page and leaves out the template's own header/footer/announcement placements. Registry: `group-sections.ts` (`GROUP_SECTION_TYPES`: header group takes announcement, custom section, rich text, trust strip, logo list; footer group takes content sections, never page sections), `listSectionDefinitionsForGroup`, `validateSectionAgainstRegistry(section, { group })` (`SECTION_NOT_ALLOWED_IN_GROUP`). Compiler: reader passes saved groups, `listTemplateSections` visits group sections on every template (checked against the group, not the page), template chrome placements skipped when groups exist, references checked (missing/duplicate), snapshot carries them. API `GET/PUT /api/stores/:id/storefront/section-groups` (`storefront/section-groups/`: derived groups until saved, `available: false` before the migration, checks every section exists, sits in one group, is allowed there, one header and one footer; bumps the generation). Editor: groups loaded in `use-editor-lifecycle`, `activeGroups` in derived; the Header and Footer areas of the page tree list the groups ("On every page", move up/down, Remove from header/footer; the header and footer themselves can't be removed); Add section there offers the group's sections and creates a shared section placed by `section-group-editing.ts` (announcement above the header, others below; footer-group sections above the footer). Tests: `store-editor/section-groups.test.tsx`, backend `test/integration/section-groups.test.ts`; layout-upgrade test now reads Resthaven's current revision and uses Fresh Market as the theme without earlier layouts. Checked 2026-11-17 in the signed-in editor (local frontend 3210 + local backend 3001 against staging) on test store "QA design check": the tree shows the derived groups, the footer's Add section offers only footer sections, adding "Custom section: Promise row" saved the groups and drew it above the footer on the home and product pages (also after a reload), move down and Remove from footer saved, the footer itself has no Remove; nothing published, and the test was undone afterwards (groups back to NULL, the created shared section deleted). Note: Remove from footer leaves the shared section in the store's shared list (not deleted). Live store with saved groups not checked (nothing published). T6 part 2 built 2026-11-17 (overlay group): sections `popup` ("Pop-up": delay 0-120 s, show again after 1-365 days, centre/corner, optional photo, `@content`/`@app` blocks, starts with heading, text and an email sign-up) and `cart-drawer` ("Slide-out bag": phone style drawer/sheet, heading, empty text, free delivery from; limit 1) in `storefront-registry/src/sections/overlays.ts`, placed only in the overlay group (`enabledOn.groups: ["overlay"]`). Renderer `sections/overlays.tsx`: published pop-up opens after its delay, portalled into the theme root with the section's colour scheme (`data-scheme`), Escape/close/backdrop close it and remember it per store+section in localStorage (`jelly-popup:<slug>:<id>`, `popupDue`), focus kept inside while it covers the page; in the editor both draw in place below the footer with a note; `cartDrawerSectionSettings` (exported). `ResolvedStorefrontLayout.overlay` (required list) from `groups.overlay`; `RuntimeStorefrontView` and the editor preview draw it after the footer; the live frame (`storefront-frame.tsx`) draws pop-ups after the footer and switches the bag drawer on from an enabled slide-out bag section (its style, heading, empty text and free-delivery amount win over theme settings > Cart; `ThemeCartDrawer` takes `heading`/`emptyText`). Frame-drawn header/footer/overlay sections now get email sign-up and contact functions (`features/storefront/engagement-api.ts`, shared with `storefront-page.tsx`). Editor: "Overlays" area in the page tree (Add section offers the overlay sections, the slide-out bag only while there is none; move and Remove). Backend group save checks each section's own `limit` (one slide-out bag). CSS at the end of `storefront-base.css`. Tests: `store-editor/overlay-group.test.tsx`, backend `section-groups.test.ts` case. Checked 2026-11-17 in the signed-in editor on test store "QA design check": Overlays area, Pop-up and Slide-out bag added and saved, drawn below the footer with their notes and settings, a second bag not offered; undone afterwards (groups NULL, both sections deleted), nothing published. Live check 2026-11-18 (user approved publishing the test store): store "QA design check" (`qa-design-check`) was published twice with a footer Promise row, a Pop-up and a Slide-out bag in its groups; **it is still published that way and its draft still holds the groups and three shared sections** (undo = delete them, set `sectionGroups` to NULL, publish). On the live store (local frontend 3210 + backend 3001): the promise row draws above the footer, the pop-up opens after its 5 s inside the theme root with focus in it, Escape closes it and `jelly-popup:<slug>:<id>` is remembered, the bag link opens the drawer without leaving the page, and changing the bag section's heading to "Your basket" changed the live drawer heading (so the section drives it; Halo's own theme setting is also drawer). A store's published design is cached for up to 30 s, so a page loaded inside that window shows the old design. Fixed 2026-11-18: the email sign-up block had no form layout anywhere (cramped in pop-ups and Custom sections); `storefront-base.css` now gives `.jelly-newsletter-block` a stacked form (label above a full-width field, consent line with a 20px box, full-width button, all zero weight so themes still win), and the pop-up heading takes the theme's Heading 3 style (`.jelly-popup-body > h2`). Checked live on `qa-design-check` at desktop and 375px (fits with 16px margins, 44px close button, no sideways scroll). Not built: the search panel and quick add as sections.

**T7 part 1.** Done 2026-11-18 (colour schemes and secondary buttons): up to 16 colour schemes (`COLOR_SCHEME_IDS`, `colorSchemes.count` 4-16; schemes 9-16 copy 1-4 via `colorSchemeSource`, also for folder themes that list fewer schemes (`sourceSchemeDefault` in platform-settings.ts) and for `extends` themes (`withOwnExtraSchemes` in theme-registry.ts, so Harbour's extra schemes copy Harbour, not Minimal)); each scheme gains optional Secondary button, Lines and borders, Soft text colours (default empty = worked out from the text colour as before; tokens `--jelly-scheme-N-secondary/-on-secondary/-border/-muted` written only when set, secondary/muted kept AA-readable by `readableTextColour`); contract roles `--j-color-secondary`/`--j-color-on-secondary` (new) and `--j-color-muted`/`--j-color-border` read them with the old tint as fallback; outside a schemed section Scheme 1 gives them. Theme setting Buttons > Secondary button style (`buttons.secondaryStyle`: theme/outlined/soft/filled/link, token `--jelly-secondary-button-style`) puts `data-secondary-button` on the theme root; rules at the end of `storefront-base.css` restyle `.jelly-button--secondary` from the scheme's secondary colour (not over photos). `themeRootAttributes(style)` now gives every theme root its data-card-layout, data-card-fit and data-secondary-button (storefront frame, storefront page, editor preview frame, CLI preview); add future root attributes there. Same-colour section gaps cover schemes 9-16 (storefront-base.css, theme-kit-late.css). Editor palette lists each scheme's secondary colour. Minimal/Avenue/Forma/Halo/Diode draw their own colours, so scheme muted/border colours show only where a theme uses the `--j-color-*` roles (Resthaven and platform-default themes) until T8. Checked: computed styles of 37,012 elements (7 theme previews x 8 pages x desktop/phone) identical before and after apart from the style guide countdown digits; design lint 17/17 (tidy + messy); the four secondary styles and Scheme 1's secondary colour checked by hand on the Resthaven preview; tests `colour-schemes-t7.test.ts`. Not checked in the signed-in editor. Backend tarballs repacked. Next: T7 part 2 (text roles h5/h6, highlight font).

**T7 part 2.** Done 2026-11-18 (text styles and text roles): text styles gain Heading 5 and 6 (`TEXT_STYLE_LEVELS`, sizes default 18/16 via `MINOR_HEADING_SIZES`, tokens `--jelly-type-h5-*`/`-h6-*`; block "Text style" offers them; rules at the end of `storefront-base.css` read the setting first, so Minimal/Avenue's own `--j-type-h5-size` large text is untouched). Typography > Highlight font (`typography.highlightFont`, default `same-as-heading`, token `--theme-font-highlight`; `--j-font-accent` follows it) and every text style's font can be Highlight. Six text roles (`TEXT_ROLES`: small headings above titles, menu links, buttons, product card names, card prices, badges), each with font/weight/size (11-24px)/letter spacing/case under "Text role: …" (`textRoles.<role>.*`); a changed property writes `--jelly-role-<role>-<prop>` and is listed in `--jelly-type-roles`, which `themeRootAttributes` turns into `data-type-roles`; the gated rules come from `textRoleCss()` and are written into storefront-base.css (block text-roles:start/end) by `scripts/generate-contract-css.mjs`, which now writes both blocks. The gate attribute is repeated three times so roles beat theme rules up to four classes (checked against Diode's `.jelly-hero .jelly-eyebrow.jelly-eyebrow`). Checked: computed styles of 37,012 elements identical before and after apart from the style guide countdown digits; design lint 17/17; roles, highlight font and Heading 5 set by hand on the Diode and Minimal previews all applied; tests `text-roles-t7.test.ts`. Not checked in the signed-in editor. Backend tarballs repacked. Next: T7 part 3 (dialogs, icons, collection/blog cards, prices settings groups).

