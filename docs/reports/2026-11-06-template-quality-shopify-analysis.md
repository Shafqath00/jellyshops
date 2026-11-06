# Template quality: why Shopify themes look professional and Jelly templates look basic

Date: 2026-11-06. Branch `local/task3` at `61b8b4e`. Analysis only: no product code was changed.

Companion files:
- `docs/guides/template-generation-master-prompt.md` — the master prompt for generating Jelly templates (section 9 summarises it).
- `docs/reports/2026-11-01-theme-editor-shopify-gap-analysis.md` — the earlier **editor feature** comparison. This report is about **design quality and architecture**, not editor features; it does not repeat that list.

## How to read this report

Every statement carries a tag:

| Tag | Meaning |
| --- | --- |
| **[Shopify: seen]** | Seen today in the user's Shopify admin (store `gsz1ms-fj`, live theme Tinker; drafts Horizon, Tinker, Azimuth trial) or the Shopify Theme Store, through the user's Chrome. Nothing was saved in Shopify. |
| **[Shopify: measured]** | Read with JavaScript from the user's live Shopify storefront (Tinker) at 1536px wide. |
| **[Jelly: code]** | Checked in this repository today (file named). |
| **[Jelly: measured]** | Measured with JavaScript in `/theme-preview/*` on the local dev server, desktop 1280px frame and phone 375px frame. |
| **[recommendation]** | My proposal, not a fact. |

Not checked today: a merchant's real store on staging (needs the backend and the user's sign-in), and Jelly's signed-in editor. Where a finding depends on those it says so.

---

## 1. Executive summary

Jelly's best hand-built page (Jelly Minimal home) is actually tidy: every section shares one 96px rhythm and one content edge **[Jelly: measured]**. The problem is not that nobody can design a good page in Jelly. The problem is that **nothing in the platform makes a page come out good by default, and plenty of things let it come out bad**. Shopify's quality comes from structure, not from talent per theme.

Root causes, in order of impact (details in section 5):

1. **No shared layout primitive.** Every theme invents its own container, page margin and breakpoints. Result, measured today: Resthaven's header, body and footer start at three different left edges (52px, 64px, 32px); Avenue uses 33/74/89px on desktop and 33/17/1/40px on a phone. Shopify puts every section on the same three-column grid (`margin | content | margin`, page margin 40px desktop, at least 16px on phones), so alignment cannot drift.
2. **No platform design-token contract.** Each theme invents token names (`--jm-*`, `--av-*`), its own spacing scale and its own breakpoints (599, 640, 680, 767, 899, 1023px all appear). The shared base CSS hard-codes 381 pixel values. Shopify themes run on one named scale (`--padding-3xs … 6xl`, `--gap-*`, `--font-size--3xs … 6xl`, radius `xs … lg`) plus a spacing multiplier that shrinks spacing on smaller screens automatically.
3. **Themes are CSS skins over one large shared markup set.** The renderer emits about 239 `jelly-*` classes. Minimal styles 121 of them itself, Avenue 135, Resthaven 79; the rest fall back to "neutral defaults" in `storefront-base.css`. Every new section needs a hand-written style pass in every theme, or it looks generic. In Shopify a section's markup, CSS and settings ship together inside the theme, so a section is either designed or absent.
4. **The customisation model gives freedom instead of guardrails.** Every Jelly section carries 21 generic style settings (any hex colour, any font, heading weight, opacity, shadow, gradient, minimum height, custom CSS) and every styled block 18 more. Shopify's section settings are few and specific to the section (Hero: media, direction, alignment, position, Width Page/Full, Height Small/Medium/Large, palette colour, overlay, padding), colours are picked **from the theme palette by reference**, and type is chosen from presets with Tight/Normal/Loose choices. Shopify merchants cannot easily break the design; Jelly merchants can, and the default look is not protected.
5. **No designed section variants.** Shopify's "Add section" offers designed presets of the same section ("Hero", "Hero: Bottom aligned", "Hero: Marquee"; "Collection list: Bento / Carousel / Editorial / Grid") in categories with a live thumbnail. Jelly's `SectionPreset` type holds only an id, label and category, no settings or blocks, and `createPresetSection()` ignores the preset and uses the section defaults. So a preset cannot express a variant today.
6. **Templates are authored by hand with no quality gate.** There is no runtime template generator in the repo (no AI/prompt code was found); starters are TypeScript builders (`v4-starter-packs.ts`) and JSON (`themes/jelly-resthaven/starter.json`) written in sessions. Quality depends on the prompt of the day, and nothing measures alignment, spacing-token use or contrast before a template ships.

**What to do first** (section 10): define the token contract and a `Section` layout primitive, add an automated design check that measures edges/rhythm/contrast at three widths, then move sections onto the primitive, then replace free-form style settings with semantic ones and give presets real content. Cosmetic work on individual themes should wait until those exist, otherwise it has to be redone.

---

## 2. How Shopify's theme ecosystem works (observed)

### 2.1 Theme library and Theme Store [Shopify: seen]

- **Online Store > Themes** shows performance (LCP, INP, CLS, sessions), the live theme with a large preview, then **Draft themes** (each with Update / Publish / Edit theme / …), **Import** and **New**, then **Discover themes** (Horizon, Tinker, Dwell, Savor, Atelier, all by Shopify) and **Visit Theme Store**.
- A draft can be edited and previewed without touching the live store; publishing swaps the live theme. A paid theme can be tried ("Trial", "Buy").
- Theme Store page (Horizon): desktop/phone demo toggle, **View demo**, **Add new copy**, a long feature list (slide-out cart, quick buy, mega menu, filtering, swatches, size chart, stock counter, EU translations…), and "From the Horizon collection: nested theme blocks".
- **Theme styles.** Tinker is a *style* of the Horizon family. Theme settings > Theme style > "Change theme style" swaps settings and look but "you will not lose any content from your store". One codebase, several designed looks.

### 2.2 Editor layout [Shopify: seen]

- Top bar: exit; tabs Sections / Theme settings / Apps; theme name with **Active** badge; page picker; Sidekick; inspector toggle; phone preview; undo/redo; `…`; **Save**.
- **Page picker** (searchable): Home page; Products (Default product, alternate templates with "Assigned to N products", Create template); Collections; Collections list; Gift card; Cart; Checkout and customer accounts; Pages; Blogs; Blog posts; Search; Password. The product template shows a "Preview: <product>" chooser.
- "Restore last session?" banner when an earlier session ended unsaved.
- **Tree in three groups**: Header (Announcement bar, Header, Add section), Template, Footer (Media with text, Footer, Policies and links, Add section). Header and footer are section groups merchants can add to.
- **Template is short.** Tinker's home has only four sections: Hero, Featured collection, Media with text, Collection list. Each section is rich and designed; the page does not need fifteen sections to look finished.
- **Nested blocks.** Hero > Group > (Group, Text). Featured collection > Header (Collection title, connected to the collection's data, shown in italics) and **Product card** (a repeating block with its own children: Media, Group of title/price/swatches). Edit the card once, every card changes.
- **Product template**: Product information > Product media + Details (Title, Review stars, Price, Variant picker, Buy buttons, Description, Group, Accordion) + Disclosures; then Video; then Featured collection.
- Selecting a section outlines it with a name tag and shows a floating toolbar (Ask for changes, duplicate, hide, delete); the URL carries `?section=…`.

### 2.3 Section settings [Shopify: seen]

**Hero**: Media 1 and Media 2 (image/video, Select, "Explore free images"), Mobile media (stack media, different media on mobile), Section link (+ new tab), **Layout** (direction Vertical/Horizontal, alignment Left/Center/Right, position Bottom…), **Width** Page/Full, **Height** preset (Large), **Appearance** (background "Palette color", media overlay, Solid/Gradient, blurred reflection), **Padding** top/bottom (px), a collapsible "Theme Settings" group, Custom CSS, Remove section.

**Featured collection**: Collection, Type (Grid/Carousel), Carousel on mobile, Product count, Columns, Mobile columns (1/2), horizontal and vertical gap, Section layout (Width Page/Full, Alignment, Gap), Padding, then "Theme Settings" (Quick add, second image on hover, card-to-page transition, carousel, mobile quick add).

Pattern: settings are **about the section's job**, mostly choices from a short list, and every colour is a reference to the palette ("Palette color"), not a free hex.

### 2.4 Theme settings [Shopify: seen]

Groups: Logo and favicon (default logo, **inverse logo** for transparent headers, favicon) · Color palette (6 swatches + add) · Typography · Page (background, page width **Narrow/…**) · Animations · Badges · Buttons · Cart · Drawers · Icons · Input fields · Popovers and modals · Prices · Product cards · Search · Swatches · Variant pickers · Custom CSS · Theme style.

- **Typography**: default text colour with the note "sections with a custom background will use this text colour only when there is sufficient colour contrast"; four font **roles** (Body, Subheading, Heading, Accent); **text presets** Paragraph and Heading 1…n, each with size from a list (14px, 72px, 48px, 32px…), line height and letter spacing as **Tight/Normal/Loose**, case Default/Uppercase, font role Heading/Accent. "Sizes automatically scale for all screen sizes."
- **Buttons**: primary and secondary, each with palette colours for background/text/border, border thickness, corner radius, font role, case.

### 2.5 Add section [Shopify: seen]

Search, Sections/Apps tabs, **Generate** (AI), then categories with designed presets and a live thumbnail of the selected one: **Banners** (Hero, Hero: Bottom aligned, Hero: Marquee, Large logo, Layered slideshow, Slideshow: Full frame, Slideshow: Inset, Split showcase) · **Collections** (Collection list: Bento / Carousel / Editorial / Grid) · **Forms** (Contact form, Email signup) · **Layout** (Custom Liquid, Custom section, Divider) · **Products** (Featured collection: Carousel / Grid, Featured product, Product highlight, Product hotspots, Recommended products) · **Storytelling** (Blog posts: Carousel / Editorial / Grid, Carousel, Editorial, Editorial: Jumbo text, Image compare, Image with text, Video) · **Text** (FAQ, Icons with text, Marquee, Multicolumn, Pull quote, Rich text).

### 2.6 Preview vs edit vs published [Shopify: seen]

- Edit mode: the real storefront in a frame, with selection outlines and toolbar. Changes are unsaved until **Save** (no autosave); the live store changes on save only if this is the live theme. A draft theme is a separate copy; publishing it makes it live.
- Phone preview re-lays the header (menu and search left, logo centred, account and bag right) and stacks the hero.

### 2.7 The storefront underneath [Shopify: measured]

| What | Value on the Tinker storefront |
| --- | --- |
| Section layout | every `.section` is a CSS grid `42.8px 1440px 42.8px` (margin, content, margin) |
| Page margin | `max(40px, safe-area)` desktop; base rule `max(16px, …)` on small screens |
| Page widths | narrow 90rem, normal 120rem, wide 150rem; content widths 36rem / 42rem |
| Spacing scale | `--padding-3xs` 0.125rem … `--padding-6xl` 4rem; `--gap-*` and `--margin-*` likewise |
| Spacing multiplier | `--spacing-scale-md: 0.7`, default 1.0 (spacing shrinks on smaller screens) |
| Type scale | `--font-size--3xs` 0.625rem … `--font-size--6xl` 3.5rem; H1 `clamp(3rem, 7.2vw, 4.5rem)`, H2 `clamp(2.25rem, 4.8vw, 3rem)`, H1 line height 1.1 |
| Section heights | small 50svh, medium 65svh, large 80svh |
| Radius scale | xs 0.2rem, sm 0.6rem, md 0.8rem, lg 1rem |
| Touch target | `--minimum-touch-target: 44px` |
| Rhythm | product list and collection list sections both 48px top / 64px bottom |
| Product cards | every card image the same 351×351 |
| Colours | semantic tokens per role (`--color-primary-button-background`, `…-hover-background`, `--color-input-border`, `--color-selected-variant-border` …) |

---

## 3. Why Shopify themes look professional (principles)

Derived from section 2; these are the decisions that matter, not the visuals.

1. **One layout grid for every section.** Alignment is a property of the platform's section wrapper, not something each section remembers to do.
2. **Named, finite scales.** Spacing, type, radius, widths and heights are chosen from short named lists. Even a careless setting lands on a value the designer approved.
3. **Fluid type and automatic responsive spacing.** Merchants set one size; the theme scales it per screen (clamp, spacing multiplier). Nobody has to set phone values for a page to look right on a phone.
4. **Colours by reference.** Sections pick palette colours, buttons pick palette colours. Change the palette and the whole store stays coherent. Contrast fallbacks protect readability.
5. **Semantic, section-specific settings.** "Height: Large", "Width: Page/Full", "Mobile columns: 2" describe intent; the theme decides the pixels.
6. **Designed variants instead of empty containers.** Presets ship finished compositions (Bento, Editorial, Bottom aligned). Merchants pick a design, then edit content.
7. **Repeated things are one component.** The product card is defined once (as a block) and reused by every list; buttons, prices and badges come from theme settings.
8. **Few sections per page.** A finished home page is 4–6 strong sections, not a long stack of thin ones.
9. **Content and data are connected, not copied.** The collection title comes from the collection; placeholder images and "Explore free images" mean no section looks broken while empty.
10. **One theme, several styles.** Theme styles change the look while keeping the merchant's content.

---

## 4. Comparison: Shopify vs Jelly

| Area | Shopify | Jelly today | Evidence |
| --- | --- | --- | --- |
| Section layout grid | one grid on every section, shared page margin | each theme writes its own container/edge rules | [Shopify: measured]; [Jelly: code] `jelly-minimal.css` `--jm-edge`, Avenue/Resthaven own rules |
| Alignment across a page | all sections on one edge | Minimal consistent (49/1216px); Resthaven 52/64/32px; Avenue 33/74/89px desktop, 33/17/1/40px phone | [Jelly: measured] |
| Token contract | one named scale for spacing/type/radius/widths | each theme invents names (`--jm-*`, `--av-*`); base CSS 381 hard-coded px; breakpoints 599/640/680/767/899/1023 | [Jelly: code] |
| Responsive scaling | fluid type + spacing multiplier, automatic | Minimal uses clamp for some sizes; phone/tablet values are manual per setting (`responsive.mobile/tablet`) | [Jelly: code] |
| Who owns section design | the theme (markup + CSS + schema together) | shared renderer markup; each theme restyles about 240 classes; Minimal covers 121, Avenue 135, Resthaven 79, rest from neutral defaults | [Jelly: code] class count |
| Section settings | specific to the section, mostly choices | section-specific settings **plus** 21 generic style keys on every section (free hex, font, weight, opacity, shadow, gradient, min height px, custom CSS) and 18 on styled blocks | [Jelly: code] `section-style.ts`, `block-style.ts` |
| Colour model | palette references; contrast fallback | two parallel systems: `colorScheme` page/soft/dark (`shared.ts`) and `styleScheme` scheme1–8, plus free hex per section/block | [Jelly: code] |
| Typography | 4 font roles, presets H1…, Tight/Normal/Loose | theme text styles H1–H4/Body/Small exist; sections may also pick any font and weight | [Jelly: code] `theme-style-settings.ts`, `section-style.ts` |
| Section presets | designed variants with thumbnails, categorised | `SectionPreset` = id, label, category only; `createPresetSection()` ignores the preset; library is a text list by category | [Jelly: code] `presets.ts`, `types.ts:6`, `section-library.tsx` |
| Product card | a block with children, edited once | fixed markup in `storefront-ui/product-card.tsx`; theme tokens toggle parts | [Jelly: code] |
| Theme styles | several designed styles per theme, content kept | "Saved looks" (merchant-saved settings); no designer-made styles per theme | [Jelly: code] `theme-library-panel.tsx` |
| Preview = live | yes | yes, one renderer for both (a real strength) | [Jelly: code] |
| Draft / publish / history | drafts as theme copies; no history | draft workspace, immutable publications, version history (ahead of Shopify) | earlier report |
| Template authoring | theme developers, Theme Check, review for the Theme Store | hand-written TS/JSON per theme in sessions; no design lint; no generator in the repo | [Jelly: code] |
| Demo content | every theme has a styled demo store | starters use Unsplash photos; product lists show merchant products | [Jelly: code] `v4-starter-packs.ts` |

---

## 5. Root causes in detail

### 5.1 Layout is per theme, so alignment drifts

`StorefrontContainer` (`storefront-ui/src/container.tsx`) is only a class name; the width, margins and breakpoints behind `.jelly-container` are defined again by every theme. Sections that need full-bleed media or narrow text each solve it locally (hero inset, FAQ 1000px, newsletter centred). When a theme is built quickly (Resthaven: 217 lines of CSS) the header, sections and footer each get their own padding and the edges no longer line up **[Jelly: measured]**. Shopify cannot drift this way because the section wrapper itself is the grid **[Shopify: measured]**.

### 5.2 No design-token contract, so every theme starts from zero

Minimal defines an 8px scale (`--jm-1 … --jm-12`), Avenue its own, Resthaven mostly literal pixels (216 px values, 129 `var()` uses). The shared base file, which styles every section a theme forgets, uses literal values (`padding: 48px 24px 96px`, `font-size: 12px/14px/18px`, `gap: 16px`) **[Jelly: code]**. There is no list of "tokens every theme must provide", so a section author cannot write CSS once that works in all themes.

### 5.3 Themes are skins, and skins are never complete

The single renderer is right for preview = live. But it means design lives far from structure: a section is added to the renderer (markup, classes) and every theme must then learn to style it. Coverage today: Minimal 121 of ~239 classes, Avenue 135, Resthaven 79; neutral base defaults cover most of the rest, and 18 emitted classes are styled nowhere **[Jelly: code]**. Each new section multiplies work by the number of themes, and the cheapest path (base defaults) is the generic look the user describes.

### 5.4 Free-form controls instead of semantic choices

Every section offers its own heading font, weight, size, body font, alignment, free background/text hex, gradient colour and angle, opacity 10–100%, shadow, minimum height 0–1000px, padding 0–200px, show-on, custom CSS; blocks add width, max width, type preset, colours, gradient, border, radius, four paddings, margins, shadow, opacity, min height **[Jelly: code]**. This is a page builder's model (Webflow/Elementor), not a theme's. It makes per-section overrides the normal way to change the look, so stores drift away from the theme, and there is nothing to keep contrast, rhythm or type hierarchy intact. Shopify offers fewer, safer controls and pushes look-and-feel changes into theme settings **[Shopify: seen]**.

### 5.5 Presets cannot carry a design

Because a preset has no settings or blocks, Jelly cannot offer "Hero: bottom aligned" or "Collection list: bento" without a new section type. Merchants get one default per section and must build the variant by hand with the free-form controls from 5.4.

### 5.6 Two colour-scheme systems and free colours

`sectionData()` writes `data-color-scheme` page/soft/dark; theme settings add `styleScheme` scheme1–8; sections and blocks also accept free hex **[Jelly: code]**. Three ways to colour a section means themes must style all three, and merchants can pick colours outside the palette.

### 5.7 No quality gate on templates

Starters are written by hand and checked by unit tests for structure (and Playwright for some flows), but nothing measures design quality: shared edges, spacing on the scale, heading sizes on the scale, contrast, image ratios, empty states. So each new theme's quality depends on one session's care. The Minimal home is good because it was polished by hand; Resthaven shows what happens without that **[Jelly: measured]**.

### 5.8 What is already right (keep it)

One renderer for preview and live; draft/publish with immutable publications and history; theme settings with text styles, colour schemes, buttons, fields, cards, badges; per-device values; the theme SDK, manifest and conformance suite; `withStoreIdentity()` and custom-field bindings for store data; Minimal's home rhythm. The redesign builds on these.

---

## 6. Proposed architecture: the Jelly Design Contract [recommendation]

Six layers. Each layer may only use the layer below it.

```
6  Templates (starters)     JSON made only of section presets + store bindings
5  Theme                    token values, preset defaults, small signature CSS
4  Section presets          designed variants: settings + blocks + thumbnail
3  Sections                 semantic settings, built from layers 1–2 only
2  Components               ProductCard, Button, Price, Badge, Swatch, Field, Rating, Media
1  Layout primitives        Section grid, Stack, Grid, MediaFrame, TextBlock
0  Token contract           required token names and scales, generated from theme settings
```

### Layer 0: token contract

- One namespace, for example `--j-*`, written by `resolveStorefrontThemeTokens`. Themes provide **values**, never new names.
- Required scales: space `--j-space-3xs … --j-space-6xl`; type presets `--j-type-{h1…h6,body,small,caption}-{size,line,track,case,font}` with fluid `clamp()` built in; radius `--j-radius-{xs,sm,md,lg,pill}`; page widths `--j-page-{narrow,normal,wide}`; content widths `--j-content-{narrow,normal}`; page margin `--j-page-margin` (desktop) and `--j-page-margin-sm` (≥16px); section rhythm `--j-section-{sm,md,lg}`; section heights `--j-height-{sm,md,lg}`; touch target 44px; motion durations.
- Fixed breakpoints for the platform, matching the existing phone/tablet values: phone ≤767px, tablet 768–1023px, desktop ≥1024px. Themes may not add others.
- A spacing multiplier per breakpoint (like Shopify's 0.7) so section padding scales automatically.
- Colour roles, not colours: `--j-color-{bg,surface,text,muted,border,accent}` and button/field/badge roles, produced from the active **scheme**. Schemes reference palette entries.
- Old `--jm-*` / `--av-*` names become aliases of `--j-*` during migration, so nothing breaks.

### Layer 1: layout primitives (renderer)

- `<SectionFrame width="page|narrow|full" rhythm="sm|md|lg|none" scheme="…">` renders the three-column grid (`margin | content | margin`) on every section, applies scheme colours and rhythm. **No section writes its own container or outer padding.** `RegistrySectionRenderer` wraps every section in it, so coverage is automatic.
- `<Stack gap>`, `<Grid columns mobileColumns gap>`, `<MediaFrame ratio fit focal>`, `<TextBlock preset align maxWidth>` — the only ways sections lay things out. All gaps are scale names.

### Layer 2: components

ProductCard becomes a composable block set (media, title, price, swatches, badge, rating, button) defined once and used by every list (featured collection, collection page, related products, search, cart upsell). Button, Price, Badge, Swatch, Field, Rating read only Layer 0 roles.

### Layer 3: sections

- Each section keeps settings about its job, as choices: width (Page/Full), height (S/M/L), layout (direction, alignment, position), columns/mobile columns, media, content.
- Universal settings shrink to four: **Colour scheme**, **Width**, **Spacing** (None/S/M/L, plus exact px under "Custom"), **Show on**.
- The rest of today's 21 + 18 generic keys move behind an **Advanced** group that a theme can switch off, or are removed from new sections. Existing saved values keep rendering (no data loss).
- Colours are scheme/palette references. Free hex stays possible only inside the palette editor.

### Layer 4: section presets

Extend `SectionPreset` to `{ id, label, category, sectionType, settings, blocks, thumbnail }`, fix `createPresetSection()` to apply them, and show thumbnails in the section library. Variants (Bento, Editorial, Carousel, Bottom aligned) are presets, not new section types.

### Layer 5: theme

A theme = token values + scheme palette + preset defaults per section + **small signature CSS** for details only (target ≤ 400 lines; today 979–1252). Because sections are built from primitives, a new theme is complete on day one and only adds character. Theme **styles** (designer-made settings bundles like Shopify's Tinker/Horizon) reuse the existing saved-looks storage, shipped by the theme.

### Layer 6: templates

Starters are JSON made only of presets and bindings, validated by a **template lint** (section 10, phase 0). Store data flows in through bindings: store name/logo (`withStoreIdentity`), first collections, newest products, policies, contact details.

### Separation of concerns

| Concern | Lives in | Changes when |
| --- | --- | --- |
| Theme structure | theme package (tokens, presets, signature CSS, sections allowed) | theme version (never bump an installed theme's `version` in place; follow the existing upgrade path) |
| Store data | catalogue, store settings, bindings | merchant edits products/settings |
| Customisation | workspace settings (theme settings, section settings referencing presets/schemes) | merchant edits in the editor; published on Publish |

---

## 7. Editor and preview recommendations [recommendation]

Most editor features already exist (earlier report). The changes that raise quality:

1. **Guardrails first.** Show the four universal settings; hide "Advanced" by default; colour pickers list scheme/palette swatches first (palette editor is the only place for new hex).
2. **Section library with thumbnails and variants** (Layer 4), grouped like Shopify: Banners, Collections, Products, Storytelling, Text, Forms, Layout.
3. **Theme settings shortcuts in context**: a "Theme settings" fold inside sections that edits the global value (as Shopify does), so merchants change the theme instead of overriding one section.
4. **Typography as presets**: font roles (Body, Subheading, Heading, Accent) and per-preset Tight/Normal/Loose choices; sizes scale automatically.
5. **Design warnings in the panel**: low contrast on a section, image missing, text longer than the layout handles, section without products.
6. **Template picker on install** that previews the template **with the merchant's own products, collections and logo**, plus theme styles to switch between.
7. **Phone preview by default for checks** before Publish, and a publish checklist (logo, products, policies, payments, shipping).

---

## 8. Ready to publish: what a new store must get without any fixing [recommendation]

1. Pick a template → the store already has header with logo or store name, main menu built from the first collections, home with 4–6 designed sections, product, collection, cart, search, 404, information pages (About, Contact, policies) — this mostly exists (`installation-service.ts` seeds information pages).
2. **Empty states designed**: no products → product sections show a designed placeholder in the editor and hide on the live store (Resthaven's `hideWhenEmpty` pattern, everywhere); missing images → theme placeholder art, not grey boxes.
3. **Bindings by default**: hero and collection sections point at real collections when they exist; store name/logo/contact come from settings.
4. **Image handling**: every media frame has a ratio and focal point, so merchant photos of any shape fit.
5. **Copy written for the store type**, editable, short, no lorem ipsum.

---

## 9. Template-generation strategy and master prompt

Verified: there is **no** automated generator in the repo; "generation" means a Claude session writing starter JSON/TS and theme CSS from the user's prompt. That is why results vary.

Strategy [recommendation]:

1. Generate **data, not code**: a theme manifest (token values, palette, schemes, fonts), preset choices and starter JSON. No new CSS beyond signature details; no new section markup unless the contract cannot express it.
2. Every generated template must pass the **template lint** (phase 0) at 1280, 820 and 390px before it is shown to anyone.
3. Use one master prompt (full text: `docs/guides/template-generation-master-prompt.md`) that fixes the design system, the allowed sections and presets, the page recipes, the data bindings and the acceptance checks.

---

## 10. Implementation roadmap [recommendation]

Phase-by-phase, commit and report after each (working agreement). Sizes: S < 1 day, M 1–3 days, L 3–7 days, XL > 1 week.

| Phase | Work | Size | Done when |
| --- | --- | --- | --- |
| **0. Measure** | Write `docs/design-contract.md` (tokens, scales, breakpoints, rules). Build a design lint (Playwright, reuses `/theme-preview/*`): shared left/right content edge per breakpoint (±1px), section padding on the rhythm scale, heading sizes on the type scale, no horizontal overflow, contrast AA, product card media all one ratio, tap targets ≥ 44px. Run it on Minimal, Avenue, Resthaven and record a baseline. | M | Lint runs in CI; baseline report lists today's failures (Resthaven and Avenue edges will fail) |
| **1. Token contract** | `--j-*` tokens generated by `resolveStorefrontThemeTokens` from theme settings; fluid type; spacing multiplier; fixed breakpoints; old theme tokens alias the new ones. | M | Every theme renders unchanged (visual diff); tokens visible in preview and live |
| **2. Layout primitives** | `SectionFrame`, `Stack`, `Grid`, `MediaFrame`, `TextBlock` in the renderer; `RegistrySectionRenderer` wraps every section in `SectionFrame`; move sections over in batches (home, product, collection, content, chrome). Delete per-theme container rules as each batch lands. | L–XL | Lint edge check passes for all three themes at all widths; no section sets its own outer padding/container |
| **3. Colour model** | One scheme system: map `page/soft/dark` to scheme ids, palette references for section/block colours, contrast fallback. | M | Old stores render the same; new sections offer schemes only |
| **4. Settings model** | Four universal settings; section-specific semantic settings; "Advanced" group per theme opt-in; editor shows palette-first colours and type presets. Saved values from the old keys still render. | L | New sections ≤ ~12 settings; a merchant cannot pick a colour outside the palette without opening the palette editor |
| **5. Presets with content** | Extend `SectionPreset` with settings/blocks/thumbnail; fix `createPresetSection()`; thumbnails and categories in the section library; ship 2–4 variants for hero, collection list, featured products, image with text, multicolumn. | M–L | Adding "Collection list: Bento" produces the designed layout in one click |
| **6. Components** | ProductCard as a block set reused by every list; Button/Price/Badge/Swatch/Field read only roles. | L | One card edit changes every product list; card media one ratio site-wide |
| **7. Themes on the contract** | Reduce Minimal/Avenue/Resthaven CSS to tokens + signature details; add designer theme styles per theme; template picker with merchant data. | L | Each theme ≤ 400 lines CSS; lint clean; styles switch without losing content |
| **8. Generation pipeline** | Master prompt in use; generated themes are manifest + starter JSON only; lint gate before review; conformance suite extended with the design lint. | M | A new theme generated from the prompt passes the lint with no manual CSS fixes |
| **9. Final QA** | Full journey per template: install, add products, logo, info, preview at 3 widths, publish, live matches; staging + Stripe sandbox checklist. | M | Acceptance criteria below all pass on staging |

Order matters: phases 0–2 are the foundation; 3–6 change what merchants can do; 7–8 rebuild the templates on top. Theme-by-theme visual polish before phase 2 would be thrown away.

Constraints to respect (from `CLAUDE.md`): never change a theme `id` or bump an installed theme's `version` in place; repack the backend tarballs after package changes; keep the repo LF; global CSS inside `@layer base`; storefront CSS reads tokens, never hard-coded colours.

---

## 11. Acceptance criteria: when is a template production-ready?

A template passes only if **all** hold, checked automatically where marked (A) or by a person (P):

**Structure**
1. (A) Every section's content starts and ends on the same left/right edge at 1280, 820 and 390px (±1px), except sections declared full-bleed.
2. (A) Section top/bottom padding values come from the rhythm scale; adjacent sections never double their spacing.
3. (A) Heading and body sizes come from the type presets; no more than 4 distinct heading sizes on a page.
4. (A) No horizontal scrolling at 390px; tap targets ≥ 44px; product card media share one aspect ratio per list.
5. (A) Text contrast WCAG AA everywhere (axe with contrast, as the Resthaven spec already does).
6. (A) Home uses 4–8 sections, each from a preset; no "unsupported section"; header/footer present once.

**Data**
7. (A) Installed on a store with 0 products, no live-store section shows an empty grid or grey box; the editor shows designed placeholders.
8. (A) Installed on a store with 12 products, 3 collections and a logo, the home, collection and product pages show that data with no manual edits.
9. (P) Store name, logo, menu, contact details and policies appear from store settings.

**Customisation**
10. (A) Changing palette, fonts and button style in theme settings changes every page; no section keeps an old colour.
11. (P) A first-time merchant can change hero image, headline and featured collection in under 5 minutes without breaking alignment.
12. (A) Preview and live store match at 3 widths (existing live-vs-preview check).

**Quality bar**
13. (P) Side by side with a Shopify Theme Store theme of the same category, a reviewer cannot point to an alignment, spacing or type-hierarchy fault in the Jelly template.
14. (A) Lighthouse on the live store: performance ≥ 85 mobile, CLS < 0.1, accessibility ≥ 95.

---

## Appendix: measurements taken today

**Jelly content edges (left px of the first visible content in each section, 1280px frame)** [Jelly: measured]

| Theme | Header | Sections | Footer |
| --- | --- | --- | --- |
| Minimal | 49 | 49 (hero 126 by design, newsletter centred) | 49 |
| Avenue | 33 | 1 (full-bleed grids), 74, 89 | 33 |
| Resthaven | 52 | 64 (FAQ 164) | 32 |

Avenue on a 375px phone: header 33, slideshow 17, product grids 1, multicolumn 40, footer 17.

**Section padding (desktop)**: Minimal 96/96 on every body section; Resthaven 80/80; Avenue 89.6 on lists, 0 on media sections. Shopify Tinker 48/64 on list sections.

**Theme CSS size**: Minimal 979 lines, Avenue 1252, Resthaven 217, shared base 532. Hard-coded px: Minimal 270, Avenue 340, Resthaven 216, base 381.
