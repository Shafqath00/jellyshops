# Jelly Design Contract

Version 0 (2026-11-06). The rules every Jelly storefront theme and template must follow so that a store looks finished on the day a merchant installs it. Background: `docs/reports/2026-11-06-template-quality-shopify-analysis.md`. Generation prompt: `docs/guides/template-generation-master-prompt.md`.

The contract has two parts:

- **Checked now** (section 1): rules the design lint (`jellyshops/e2e/design-lint.spec.ts`) measures on every theme preview page at three widths. These hold for the code as it is today.
- **Target** (section 2): the token names, scales and primitives the roadmap introduces (phases 1–6). They are written down now so new work aims at them; the lint gains rules as each lands.

---

## 1. Rules checked by the design lint

Measured in `/theme-preview/<theme>` for the pages Home, Collection, Product, Cart, Search, Page and 404, at Desktop 1280px, Tablet 768px and Mobile 390px. Code: `jellyshops/src/lib/design-lint/` (measurement + rules) and `jellyshops/e2e/design-lint.spec.ts`.

| Rule id | Rule | Why |
| --- | --- | --- |
| `edge` | Every top-level part of the page (announcement, header, each section, footer) keeps its content between the page's **content edges** (±1px). The content edges are the left and right edges most sections use. Inside them, content must line up with the left edge, the right edge, or be centred between them (±4px, and clearly narrower: at least 48px or 8% of the page width in from each edge, whichever is smaller). Content = text boxes, form controls, images, coloured panels and rows of items (a grid of 2+ columns or a flex row of 2+ items counts by its own box); a link around a photo counts by its text. Full-width parts may run media edge to edge, but their text must stay inside the edges, except a scrolling strip (`data-scrolling`). A section placed in one column of a page laid out in columns (the product page's details column) is judged with its row and skipped. | One grid for the whole page; this is what makes Shopify themes look aligned. |
| `rhythm` | A page uses at most **3** different non-zero section paddings (top and bottom together) at one width: small, medium, large. | Spacing from a scale, not one-off values. |
| `headings` | A page shows at most **4** different heading font sizes (h1–h4) at one width. | A clear type hierarchy. |
| `overflow` | No horizontal scrolling at any width. | Phones must never scroll sideways. |
| `tap-target` | At Mobile, every standalone link, button and form field is at least **24px** tall and wide (WCAG 2.2 target size). Links inside running text are exempt. Target for new work: 44px. | Usable on touch screens. |
| `card-ratio` | Within one product list, every product card image has the same aspect ratio (±2%). | Grids look orderly with any merchant photo. |
| `contrast` | No WCAG AA colour-contrast failures (axe `color-contrast`), Desktop width. | Readable text in every scheme. |

### Baseline

Problems that existed when the lint was introduced are listed in `jellyshops/e2e/design-lint.baseline.json`. The lint fails on any problem **not** in the baseline, so things can only get better. When a fix removes a baselined problem, the run says so; refresh the baseline in the same change:

```bash
cd jellyshops && JELLY_DESIGN_LINT_UPDATE=1 JELLY_E2E_FRONTEND_PORT=3300 npx playwright test e2e/design-lint.spec.ts
```

Each run writes `jellyshops/test-results/design-lint-report.md` (all findings, grouped by theme) and `design-lint-report.json`.

Run it:

```bash
cd jellyshops && JELLY_E2E_FRONTEND_PORT=3300 npx playwright test e2e/design-lint.spec.ts
```

---

## 2. Target contract (roadmap phases 1–6)

### 2.1 Tokens (one namespace, values from theme settings) — built in phase 1

Themes provide **values**, never new token names.

How it works (phase 1, 2026-11-06):

- The list and platform defaults live in `jellyshops/packages/storefront-themes/src/contract-tokens.ts` (`CONTRACT_TOKENS`, `CONTRACT_SPACE`, `CONTRACT_BREAKPOINTS`, `CONTRACT_TYPE_PRESETS`).
- `node scripts/generate-contract-css.mjs` writes them into `storefront-base.css` (between the `contract-tokens` markers) as `:where([data-jelly-theme])` rules with zero specificity, plus the tablet and phone overrides (`--j-space-scale` 0.85 / 0.7, `--j-page-margin`). `--check` fails when the file is out of date; a unit test checks the same.
- Values follow the merchant's theme settings through the existing layers (`--theme-*`, `--jelly-*` from `resolveStorefrontThemeTokens`), so no resolver change was needed.
- A theme sets its own values in its scope (Minimal and Avenue: type sizes, page width, page margin, radii; Avenue also tight tracking and a 700ms slow duration). Their old names (`--jm-1`, `--jm-edge`, `--av-h2`, …) are now aliases of the contract names. Resthaven still uses the `--jelly-*` layer directly (its CSS is generated from its own `theme.css`); phase 2 moves it onto the contract.
- A unit test (`contract-tokens.test.ts`) fails if any theme, shared CSS or package file uses a `--j-*` name that is not in the contract.
- Checked: full-page screenshots of all 3 themes × 8 preview pages × 3 widths were pixel-identical before and after (a 1px change to one contract value broke 24 of them, so the check is sensitive).
- Colour roles follow each section's colour scheme since phase 3 (section 2.4a).

| Group | Tokens |
| --- | --- |
| Space | `--j-space-3xs` 2px, `2xs` 4px, `xs` 8px, `sm` 12px, `md` 16px, `lg` 24px, `xl` 32px, `2xl` 40px, `3xl` 48px, `4xl` 64px, `5xl` 80px, `6xl` 96px |
| Section rhythm | `--j-section-sm`, `--j-section-md`, `--j-section-lg` (each a space token), multiplied by `--j-space-scale` (1 desktop, 0.85 tablet, 0.7 phone) |
| Page | `--j-page-narrow`, `--j-page-normal`, `--j-page-wide`; `--j-page-margin` (desktop) and `--j-page-margin-sm` (at least 16px); `--j-content-narrow` ≈36rem, `--j-content-normal` ≈42rem |
| Type presets | `--j-type-{h1,h2,h3,h4,h5,h6,body,small,caption}-{size,line,track,case,font}`; sizes fluid with `clamp()`; line height and tracking from tight / normal / loose |
| Font roles | `--j-font-body`, `--j-font-subheading`, `--j-font-heading`, `--j-font-accent` (at most two families) |
| Radius | `--j-radius-xs`, `sm`, `md`, `lg`, `pill` |
| Heights | `--j-height-sm` 50svh, `md` 65svh, `lg` 80svh |
| Colour roles | `--j-color-bg`, `surface`, `text`, `muted`, `border`, `accent`, button/field/badge roles; produced by the section's **colour scheme**, which references the palette |
| Interaction | `--j-touch-target` 44px, `--j-duration-fast` 160ms, `--j-duration-slow` 600ms, `--j-ease` |

Old theme names (`--jm-*`, `--av-*`) become aliases of these during migration.

### 2.2 Breakpoints (fixed for the platform)

Phone up to 767px, tablet 768–1023px, desktop 1024px and up (the same split as the editor's phone/tablet values). Themes may not add breakpoints.

### 2.3 Layout primitives (renderer) — built in phase 2

- `SectionFrame` (`packages/storefront-renderer/src/section-frame.tsx`) wraps every section, header and footer (applied by `RegistrySectionRenderer`, so coverage is automatic) and marks it `data-section-frame` + `data-frame-width="page|narrow|full"` (from the section's Width setting, `styleWidth`). The width rule is in `storefront-base.css` ("Section frame"): the section's `.jelly-container` is the content column, `min(100% - 2 × --j-page-margin, --j-page-normal)` wide and centred (narrow: `--j-page-narrow`; full: the screen minus the page margins). Themes set those token values and **do not write their own container width rule**; the per-theme rules in Minimal, Avenue and Resthaven were deleted. Header, announcement and footer rows that are not inside a container pad with `--j-page-edge`.
- A theme may still change a container's inner layout (grid, gap) and may let one section run edge to edge (Avenue's collection tiles); the lint then checks that its text stays on the page edges.
- `Stack` (gap, direction, align), `Grid` (columns, tablet columns, mobile columns, gap, row gap), `MediaFrame` (ratio square/portrait/landscape/wide, fit, focal point) and `TextBlock` (contract text preset, alignment, max width) live in `packages/storefront-renderer/src/layout.tsx`; gaps are space-token names, text styles contract presets. Styles at zero specificity in `storefront-base.css` ("Layout primitives"), so a theme's rule for the section's own class still wins while sections move over. Each keeps the `className` it is given.
- Status: the frame covers every section; the primitives are used by Multicolumn so far. Moving the other sections' inner layouts onto them happens section by section (later phases); colour scheme and rhythm are not applied by the frame yet (phases 3–4).

### 2.4a Colour model — built in phase 3

- **One scheme per section.** The section frame carries `data-scheme`, worked out by `sectionScheme()` (`packages/storefront-renderer/src/section-frame.tsx`) from the three ways a section can be coloured, in this order: its own colours (`custom`, when "Use my own colours" is on with a colour), a theme scheme (`styleScheme`, `scheme1`–`scheme8`), or the older Background choice (`colorScheme` `page` / `soft` / `dark`).
- **Older choices are aliases.** `resolveThemeStyleTokens` writes `--jelly-scheme-{page,soft,dark}-*` as references to the theme's own schemes (`legacySchemeMap`: Page = Scheme 1, Dark = the darkest of schemes 1–4, Soft = Scheme 2 or the next light one), so they follow the merchant's scheme colours. Minimal: Page 1, Soft 2, Dark 4. Avenue: Page 1, Soft 2, Dark 3. A theme without schemes (Resthaven) gets its theme colours (Dark = text and background swapped).
- **Colour roles follow the scheme.** `storefront-base.css` (generated from `CONTRACT_SCHEMES` / `contractSchemeRoles` in `contract-tokens.ts`) points `--j-color-bg`, `text`, `surface`, `muted`, `border`, `primary` and `on-primary` at the section's scheme inside every frame that has one.
- **Contrast fallback.** A scheme whose text (or button text) is below WCAG AA (4.5:1) on its background (or button) gets near-black or white instead (`readableTextColour`). The themes' own schemes all pass, so untouched stores are unchanged.
- **Editor.** Sections offer only "Colour scheme" (plus own colours). The older Background control (`legacy: true` on the control) appears only on sections that still have Soft or Dark saved; picking a scheme or own colours removes it (`applySettingsPatch`). New Store visit sections start on Scheme 2 instead of Soft. The locked built-in starter packs still save `colorScheme`, and their sections render as before.
- **Not changed yet:** the themes' own colour rules (`--jm-*`, `--av-*`, the Page/Soft/Dark rules) still paint sections; they move onto the roles when the themes are rebuilt (phases 7–8). Colour pickers already list theme and scheme colours first; free hex is still allowed in sections and blocks.
- Checked: full-page screenshots of all 3 themes × 7 pages × 3 widths before and after: page sizes identical, differences only where photos load at different moments.

### 2.4 Settings model — first part built in phase 4

Built (2026-11-06):

- Every section shows the same four universal settings under "Section": **Colour scheme**, **Width** (Page / Narrow / Full), **Spacing** (None / Small / Medium / Large / Custom; Medium is the theme's spacing, saved as empty) and **Show on**. Exact top/bottom sizes appear only for Spacing > Custom, or while an older exact value is saved (`visibleWhenSaved` on the control). Picking a preset spacing removes exact sizes on every screen (`applySettingsPatch`).
- The rest of the shared styling (own colours, gradient, heading/text fonts and sizes, text alignment, minimum height, shadow, opacity, custom CSS) is in the collapsed **Advanced** group, with sub-headings Colours / Typography / Effects / Custom CSS. Blocks keep Width, Max width, Text style and Show on up front; their colours, borders, effects, margins and padding are under Advanced.
- Saved values from before still validate and render; nothing in the renderer changed.
- A typical section now shows 6 settings up front (it was about 25). Sections whose own content controls exceed 12 (header 20, journal teaser, image mosaic and 404 message 18, product grid 15, featured collection and product information 14, store visit 13) need their own controls reworked (later).
- Not built yet: a theme switch to hide Advanced, palette-only colour pickers (Advanced still allows any hex), type presets in place of the Advanced font/size choices.

Target:

- Universal section settings: colour scheme, width, spacing (none / S / M / L, custom px under "Custom"), show on.
- Everything else is specific to the section's job and offered as choices.
- Colours are palette or scheme references; free hex only in the palette editor.
- The older free-form style settings move behind an "Advanced" group a theme can switch off; saved values keep rendering.

### 2.5 Components — product card built in phase 6

One product card (a block set: media, title, price, swatches, badge, rating, button) used by every product list. Buttons primary/secondary, price, badge, swatch, field and rating read only colour roles and tokens.

Built (2026-11-06):

- `StorefrontProductCard` (`packages/storefront-ui/src/product-card.tsx`) is the only card markup; a test fails if any other file in the app or the renderer writes its own `jelly-product-card` markup. It is a fixed set of parts, `PRODUCT_CARD_PARTS`: media (photo + badges), vendor (brand), title, price, savings, swatches, chip, button. Each part is its own small component with `data-card-part`; parts without data are left out.
- Theme settings > Product cards change every list at once (product grids, collection pages, related products, search, recipe products): photo shape (one ratio site-wide, `--jelly-card-ratio`), layout order, name/price on or off, long names, savings, button (all from earlier work), plus new **Show the brand** (`productCard.showBrand`, existing default now has a control) and **Colour swatches** (`productCard.swatches`: dots for up to five colours of the first colour/image option, "+N" for more, a spoken "Available in N colours").
- Card data: `productCardData` adds `vendor` and `swatches`/`moreSwatches` (`productCardSwatches`: hex colours and https/media images only).
- The new parts read contract roles (`--j-color-muted`, `--j-color-border`, `--j-color-bg`), so they follow the section's colour scheme. Existing card parts (price, badge, button) still use theme tokens.
- Not built: a rating part (the catalogue has no review data yet), per-section card settings, and moving price/badge/button/field styling onto the roles (themes rebuilt, phases 7–8).
- Checked: screenshots of all 3 themes × 8 preview pages × 3 widths unchanged with the new options off (page sizes identical; differences only where photos load); brand and swatches measured in the Avenue style guide with the tokens switched on by hand.

### 2.5a Section presets — built in phase 5

- A preset (`SectionPreset` in `packages/storefront-registry/src/types.ts`) is a designed variant of a section: id, label, category, plus optional `description`, `thumbnail` (a layout sketch name) and the `settings` and `blocks` that make the design. `createPresetSection()` merges the preset's settings over the section defaults, uses its blocks (or the default blocks) with new ids at every level, and refuses a preset the registry would not accept.
- Variants of the built-in sections live in `packages/storefront-registry/src/section-variants.ts` (`SECTION_VARIANTS`, added after each section's own preset by `prepareSection`): Hero: Text over image / Text only; Collection list: Bento / Carousel; Product grid: Large / Tabs; Image with text: Image left / Image right, soft; Feature columns: Three promises / Four columns. Photos are the Unsplash images the starter packs already use.
- The collection list gained a Layout setting (Grid / Bento / Carousel). Bento: first collection two columns by two rows (full width on phones, then 2×2); Carousel: one row that scrolls sideways with the next collection peeking in, focusable for keyboards. Platform CSS in `storefront-base.css` ("Collection list layouts"), so every theme gets it; the theme still styles the cards.
- Add section lists every preset grouped by its category (Banners, Products, Content, Marketing) with a small layout sketch (`components/preset-sketch.tsx`) and a one-line description that search also matches (`features/store-editor/section-options.ts`).
- Checked: every preset creates a section the registry accepts (unit test); Bento and Carousel measured in the browser on Minimal (desktop and phone) and Avenue (desktop) with the layout switched on in the preview; not checked by adding a preset in the signed-in editor. Thumbnails are drawn sketches, not live previews.

### 2.6a Theme kit — first part of phase 7 (7a), 2026-11-06

- Jelly Minimal and Jelly Avenue now use the same private token names, `--tk-*` (each theme sets its own values in its own file; they were `--jm-*` and `--av-*`).
- The rules both themes had word for word now live once in `jellyshops/src/app/themes/theme-kit.css`, scoped to both themes with `:is([data-jelly-theme="jelly-signature"], [data-jelly-theme="jelly-avenue"])` (same weight as a theme's own scope). It loads after `storefront-base.css` and before the theme files.
- Only rules that could move without changing anything moved: a shared rule stayed in the themes when a rule that stays behind and came before it could style the same element and property (it would otherwise override the moved rule). 122 rules moved: Minimal 993 → 794 lines, Avenue 1,270 → 1,066, kit 174.
- `theme-css.test.ts` checks the kit's scope and that every `--tk-*` name the kit reads is set by both themes.
- Checked: full-page screenshots of both themes × 8 preview pages × 3 widths before and after: page sizes identical, every remaining difference is a photo that had loaded in one capture and not the other.
- Not reached: the 400-line target per theme. The rest of the shared rules differ in a value or in their position; moving them means resolving those overlaps by hand, which can change the look and needs review page by page (7b). Resthaven is not a kit theme (its CSS is generated from its own theme file).

### 2.6 Themes and templates

- A theme = token values + palette and schemes + preset defaults + signature CSS (target ≤ 400 lines for existing themes, ≤ 150 for new ones; no hex, no px except hairlines).
- A template (starter) = presets + store bindings only; home has 4–8 sections.
- Never change a theme `id` or an installed theme's `version` in place.
