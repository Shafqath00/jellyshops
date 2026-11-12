# Jelly Shop theme developer guide

How to build a complete theme for Jelly Shop: global settings, page templates, sections and blocks, dynamic store data, and everything a merchant can then change in the visual Theme Editor.

**Read this first.** This guide separates two things:

- **Works today.** Everything marked *today* was checked against the code in this repository. A theme is built **inside the Jelly Shop monorepo** and ships with the platform. Developers cannot yet upload a theme package.
- **Planned.** Where you asked for a Shopify-style workflow (theme project, CLI, packaging, upload, local preview server), those parts do not exist yet. [Theme SDK and developer platform plan](../plans/theme-sdk-plan.md) says exactly what is missing and how to build it. This guide shows the target experience in boxes labelled **Planned** so developers and the product team share one picture.

The example theme in [section 9](#9-complete-example-theme-jelly-studio) is real: `docs/examples/jelly-studio/` is checked against the platform's manifest schema and section registry by an automated test (`packages/storefront-themes/src/docs-example-theme.test.ts`), so it cannot drift from what the platform accepts.

Contents: [1 Mental model](#1-mental-model) · [2 Structure](#2-folder-structure-and-architecture) · [3 Build a theme](#3-build-a-theme-from-scratch-today) · [4 Page templates](#4-page-templates) · [5 Sections and blocks](#5-editable-sections-and-blocks) · [6 Dynamic data](#6-dynamic-storefront-data) · [7 Editor integration](#7-how-a-theme-becomes-editable) · [8 Workflow](#8-developer-workflow-testing-and-versioning) · [9 Example](#9-complete-example-theme-jelly-studio)

---

## 1. Mental model

A Jelly Shop theme is **a look plus a starting point, not a separate storefront**. Every theme renders the same section markup through one renderer, so the editor preview and the published store cannot disagree. A theme decides how that markup looks and what a new merchant starts with.

```text
Theme  ── manifest + tokens + settings schema ── what merchants can change globally
  │       stylesheet scoped to [data-jelly-theme="<id>"]
  ▼
Starter pack ── templates (page layouts), global header/footer, menus ── the starting point
  ▼
Section registry ── section + block definitions (zod schema + editor controls) ── what is editable
  ▼
Section renderer ── React components, one per section type ── how it is drawn
```

### Shopify vocabulary, mapped to Jelly Shop

| Shopify | Jelly Shop (today) | Where |
| --- | --- | --- |
| `layout/theme.liquid` | Theme shell components (`Layout`, `Header`, `Footer`, `CartPanel`) and the global header, announcement and footer sections | `packages/storefront-themes/src/types.ts` (`ThemeShellComponents`) |
| `templates/*.json` | A **template** per page type: an ordered list of section placements | `StorefrontTemplate` rows; defaults in `v4-starter-packs.ts` |
| `sections/*.liquid` + `{% schema %}` | A **section definition** (zod settings schema + editor controls) plus a React renderer | `storefront-registry/src/sections/`, `storefront-renderer/src/sections/` |
| Blocks | **Block definitions**, nestable up to three levels | `storefront-registry/src/blocks.ts` |
| `snippets/` | Shared React components | `packages/storefront-ui`, helpers in the renderer |
| `assets/` | `jellyshops/public/themes/<id>/` (images, icons) and `jellyshops/src/app/themes/<id>.css` | |
| `config/settings_schema.json` | `settingsSchema` in the theme manifest | `themes/<id>/theme.json` |
| `config/settings_data.json` | The store's saved **theme configuration** (one row per store) | `ThemeConfiguration` table |
| `locales/*.json` | **Not available for theme text.** Merchants translate section and block text per language; the theme's own built-in words are not translatable yet | see the plan |
| Theme library | **Saved looks** (theme + settings only; pages and sections are shared) | editor, Theme settings |

### How a merchant's edit becomes a live page

1. The merchant opens the Theme Editor. It loads the store's **draft**: templates, shared sections, menus and the theme configuration, kept in the SQL workspace with a generation counter (`backend/src/storefront/workspace/`).
2. Every edit saves to the draft through a revisioned save queue. The preview renders the draft with the **same renderer** the live store uses.
3. **Publish** validates the draft, compiles it into an immutable **snapshot** (`backend/src/storefront/compiler/`) and activates it. The snapshot pins the theme `id`, `version` and settings (`RuntimeStorefrontSnapshotV4.theme`).
4. The storefront loads the active snapshot (`GET /api/stores/:storeId/storefront/public`) and renders it with the renderer and the theme's CSS.

The live store never changes until Publish. Published snapshots are immutable, which is why theme versions and ids are pinned (section 8).

---

## 2. Folder structure and architecture

### Today: where a theme's files live

A theme is spread across four packages and the app. A theme folder under `storefront-themes/src/themes/<id>/` (`theme.json` plus optional `starter.json`) is found automatically (`node scripts/generate-theme-index.mjs`, checked by a test) and becomes a declarative theme with its starter pack. Themes with their own header, footer or section code, and the CSS, preview and registration steps below, are still manual.

| Responsibility | Path | Purpose |
| --- | --- | --- |
| Manifest and settings | `jellyshops/packages/storefront-themes/src/themes/<id>/theme.json` | Identity, version, asset paths, `settingsDefaults`, `settingsSchema`. Validated by `validateThemeManifest()` |
| Tokens | `.../storefront-themes/src/<id>/tokens.ts` (or in `definition.ts`) | `ThemeTokens`: base colours, fonts, radii, spacing |
| Registration | `.../storefront-themes/src/theme-registry.ts` | The hard-coded list of themes (`definition(...)`). Also `COMPLETE_STOREFRONT_THEME_IDS` |
| Shell and section overrides (optional) | `.../storefront-themes/src/themes/<id>/shell.tsx`, `hero.tsx` | Replace the header, footer, cart or pages, or one section's markup |
| Stylesheet | `jellyshops/src/app/themes/<id>.css`, imported in `src/app/layout.tsx` | Every rule scoped to `[data-jelly-theme="<id>"]` |
| Assets | `jellyshops/public/themes/<id>/` | Preview image, icons, images. Manifest paths must start with `/themes/<id>/` |
| Starter pack | `jellyshops/packages/storefront-registry/src/v4-starter-packs.ts` | Templates, global sections and menus a new store starts with |
| Custom sections | `storefront-registry/src/sections/*.ts` (schema and controls), `storefront-renderer/src/sections/*.tsx` (markup), `render-registry.tsx` (registration) | Only if the core sections are not enough |
| Preview page | `jellyshops/src/features/theme-preview/configs.ts` and `src/app/theme-preview/<slug>/page.tsx` | A style guide with sample data at three widths |
| Tests | `storefront-themes/src/<id>.test.ts` and the section tests next to each file | |

### Recommended structure for a theme (today)

```text
packages/storefront-themes/src/themes/jelly-studio/
  theme.json            manifest + settings        (docs/examples/jelly-studio/theme.json)
  tokens.ts             ThemeTokens defaults
  shell.tsx             optional: Layout / Header / Footer / CartPanel overrides
  hero.tsx              optional: one section's markup override
src/app/themes/jelly-studio.css            styles, numbered sections like jelly-avenue.css
public/themes/jelly-studio/                preview.svg, mark.svg, images
```

### The target structure (Planned)

Your brief names `layouts/ templates/ sections/ blocks/ components/ assets/ config/ locales/`. That is the right shape for a self-contained theme **package**. Today these live in different packages. The plan maps them 1:1 so a theme can be developed, validated and uploaded as one folder:

```text
jelly-studio/
  theme.json                      manifest (id, version, engines, entry points)
  config/settings.schema.json     global settings (today: settingsSchema in theme.json)
  config/tokens.json              design tokens
  layouts/default.json            header / announcement / footer placement
  templates/*.json                home, product, collection, cart, search, page, blog, article, 404 …
  sections/<type>/section.json    settings schema + editor controls + presets
  sections/<type>/render.tsx      markup (trusted themes) – or declarative template (uploaded themes)
  blocks/<type>/block.json
  components/                     shared UI
  assets/                         css, images, fonts
  locales/en.json, hi.json …      theme text per language
```

See the plan for how each folder is validated and how uploaded themes run without executing untrusted code.

---

## 3. Build a theme from scratch (today)

Everything in this section works now. It follows the steps in [`theme-architecture.md`](../theme-architecture.md) and adds the details that guide does not show.

### Step 1: Decide the identity

- **`id`**: lowercase letters, numbers and dashes (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`). Stored in merchants' settings and in published snapshots. **Never change it after release.** Only the display `name` may change.
- **`version`**: `major.minor.patch`. Published stores pin it. **Do not bump the version of a released theme** in place: a store whose pinned version no longer matches silently falls back to the default theme (`resolveTheme()` reports `fallbackReason: "version-unavailable"`). See section 8 for the safe way to release changes.
- **`assetPrefix`**: must be exactly `/themes/<id>/`.

### Step 2: Create the manifest

Copy `docs/examples/jelly-studio/theme.json` to `packages/storefront-themes/src/themes/jelly-studio/theme.json`. Its structure (the full file is in section 9):

```jsonc
{
  "id": "jelly-studio", "name": "Jelly Studio", "version": "1.0.0",
  "description": "…", "assetPrefix": "/themes/jelly-studio/",
  "previewAsset": "/themes/jelly-studio/preview.svg",
  "assets": { "stylesheets": [], "scripts": [], "fonts": [], "icons": [], "assets": [], "preview": { "path": "…", "alt": "…" } },
  "layout": "standard",              // "standard" | "editorial"
  "enabled": true,
  "settingsDefaults": { "colors": { … }, "typography": { … }, … },
  "settingsSchema": [ { "id": "colors.accent", "type": "color", "label": "Highlight", "group": "Colours", "default": "#d9a441" } ]
}
```

**Settings schema rules** (enforced by `validateThemeManifest()`; the manifest is `.strict()`, so unknown keys are rejected):

| Setting `type` | Needs | Saved value |
| --- | --- | --- |
| `text`, `textarea`, `richtext`, `url` | | string |
| `color` | | `#rrggbb` string |
| `number`, `range` | `min`, `max`, optional positive `step`, `min <= max` | number inside the bounds |
| `checkbox` | | boolean |
| `select`, `radio`, `alignment`, `font` | non-empty `options: [{ value, label }]` | one of the option values |
| `image` | | URL string |

`id` is a dotted path (`colors.accent`, `header.sticky`) that matches the shape of `settingsDefaults`. `group` becomes a collapsible group in Theme settings. Keep labels plain ("Page width", not "layout.containerWidth") and the list short.

The platform adds more settings to the two complete themes through `themeStyleSettings()` (`theme-style-settings.ts`): text styles (Heading 1-4, Body, Small), up to eight named colour schemes, button size and hover, form fields, product cards, badges, social links, languages, cart behaviour and custom CSS. A new theme gets them by spreading `themeStyleSettings(...)` into its manifest the same way `jelly-avenue/definition.ts` does.

### Step 3: Define tokens and register the theme

```ts
// packages/storefront-themes/src/jelly-studio/tokens.ts
import type { ThemeTokens } from "../types.js";
export const studioTokens: ThemeTokens = {
  colors: { primary: "#22313f", background: "#fbfaf8", text: "#22313f", surface: "#ffffff", accent: "#d9a441" },
  typography: { display: "Fraunces", body: "Inter" },
  radii: { button: "8px", card: "4px" },
  spacing: { section: "80px", container: "75rem" },
  cardShadow: "none",
};
```

```ts
// packages/storefront-themes/src/theme-registry.ts  (add to the imports and to the `themes` array)
import studioManifest from "./themes/jelly-studio/theme.json" with { type: "json" };
import { studioTokens } from "./jelly-studio/tokens.js";
// …
definition("jelly-studio", "Jelly Studio", studioTokens, studioManifest),
```

A theme only appears in the editor's theme catalogue (`GET …/storefront/themes`) because it is in this array. If it should render a full storefront (checkout, account, wishlist, order pages and its own header and footer around every route), also add its id to `COMPLETE_STOREFRONT_THEME_IDS` in the same file and to `COMPLETE_STARTER_PACK_IDS` in `v4-starter-packs.ts`. Always ask `isCompleteStorefrontTheme(id)`; never compare against one id.

Fonts must be self-hosted. Add the font in `jellyshops/src/app/fonts.ts` (via `next/font`) and in `packages/storefront-themes/src/fonts.ts` (`FONT_OPTIONS`); a test (`src/app/fonts.test.ts`) fails if the two disagree.

### Step 4: Write the stylesheet

Create `jellyshops/src/app/themes/jelly-studio.css` and import it in `jellyshops/src/app/layout.tsx` next to the other theme files. **Read only tokens, never hard-coded colours**, so merchant settings apply everywhere. Scope every rule to the theme id.

```css
/* jelly-studio.css: all rules scoped to this theme */
[data-jelly-theme="jelly-studio"] {
  --st-bg: var(--theme-background, #fbfaf8);
  --st-text: var(--theme-text, #22313f);
  --st-accent: var(--theme-accent, #d9a441);
  --j-section-md: clamp(56px, 7vw, 96px); /* section space; the platform pads every section from it */
  background: var(--st-bg);
  color: var(--st-text);
  font-family: var(--theme-font-body, Inter, sans-serif);
}
[data-jelly-theme="jelly-studio"] h1,
[data-jelly-theme="jelly-studio"] h2 { font-family: var(--theme-font-heading, Georgia, serif); font-weight: var(--jelly-heading-weight, 400); }
[data-jelly-theme="jelly-studio"] .jelly-product-card h3 { font-size: 0.95rem; }
```

Building on a base design: a theme.json may say `"extends": "jelly-signature"` (Jelly Minimal) or `"jelly-avenue"`. The theme then needs no theme.css: it uses the base design's stylesheets, settings and section designs with its own colours, fonts, schemes and starter pages. `node scripts/new-theme.mjs <brief.json>` writes such a theme from a short brief (see docs/guides/template-generation-master-prompt.md, "Generation pipeline").

Page edges: every section is wrapped in a section frame and its `.jelly-container` is placed by the platform (docs/design-contract.md §2.3). Do not write a `.jelly-container` width rule; set `--j-page-normal` (content width), `--j-page-narrow`, `--j-page-margin-desktop` / `-tablet` / `-sm` on `&` instead, and pad full-width rows (header, footer) with `var(--j-page-edge)` so they line up with the sections.

Section spacing (Phase 4, 2026-11-12): do not write `.jelly-section` padding. The platform pads every section from one scale (`--j-section-md`, with `--j-section-sm` and `--j-section-lg` for the merchant's Small/Large Spacing choice) and lets two neighbours with the same colour scheme share one gap. Set `--j-section-md` on `&` to change the rhythm. A theme that writes its own `.jelly-section` padding loses the shared gaps.

Platform base design (Phase 4, 2026-11-12): a theme on the platform defaults (no `legacyStorefrontStyles`, no `sectionDefaults: false`) already gets a complete component look from `src/app/themes/platform-base.css`: header and menus, cards, sections, footer, filters, product page, bag, checkout and account, all reading `--j-*` tokens. Start by setting tokens on `&` (`--j-button-height`, `--j-button-padding`, `--j-field-height`, `--j-radius-sm`/`--j-radius-md`, `--j-color-accent`, `--j-color-sale`, `--j-type-h1-size`…, `--j-page-title-size`, `--j-section-md`), then add only what makes your theme distinctive; your scoped rules win ties with the base. Jelly Resthaven (`themes/jelly-resthaven/theme.css`, 150 lines) is the reference.

Named parts (Phase 4): style only the classes listed in `THEME_PART_GROUPS` (`packages/storefront-themes/src/theme-parts.ts`, also exported by `@jelly/theme-sdk`), the data hooks (`[data-part]`, `[data-card-part]`, `[data-section-type]`, `[data-layout]`, `[data-scheme]`) and `--j-*` tokens. The renderer keeps every part (a test fails if one disappears); any other `.jelly-*` class is an internal that may change without notice. `jelly-theme validate` warns about internals your `theme.css` uses (`CSS_INTERNALS`). The built-in themes still use some internals; `src/app/themes/theme-css-internals.baseline.json` freezes them, so a theme can lose internals but never gain new ones. If themes genuinely need a hook, add it to the parts list instead.

Card photos: Product cards > Product photos (`productCard.photoFit`) puts every card photo in the same frame (`data-card-fit` on the theme root): `crop` fills it, `whole` shows the whole product on a soft background (packshot). Folder themes list the setting in their theme.json (and `settingsDefaults`) like any other.

Colours: inside a section with a colour scheme, `--j-color-bg`, `--j-color-text`, `--j-color-surface`, `--j-color-muted`, `--j-color-border`, `--j-color-primary` and `--j-color-on-primary` follow that scheme (docs/design-contract.md §2.4a). Read these roles in new CSS instead of fixed colours so a merchant's scheme choice works in your theme.

Tokens available to every theme (from `resolveStorefrontThemeTokens`): `--theme-background`, `--theme-surface`, `--theme-text`, `--theme-muted-text`, `--theme-border`, `--theme-accent`, `--theme-accent-soft`, `--theme-font-heading`, `--theme-font-body`, `--jelly-color-*`, `--jelly-font-display`, `--jelly-font-body`, `--jelly-container-width`, `--jelly-spacing-section`, `--jelly-heading-size`, `--jelly-body-size`, `--jelly-card-*`, `--store-*`. Plus the optional ones the shared style settings write (`--jelly-type-*`, `--jelly-scheme-*`, `--jelly-button-*`, `--jelly-field-*`, `--jelly-badge-*`).

Rules that matter (learned the hard way):

- Keep global element rules inside `@layer base`. Tailwind 4 makes unlayered global CSS beat utility classes.
- Every section the editor styles per section (colours, fonts, padding, show on, shadows) is controlled by variables on the section wrapper (`--section-*`, `data-section-style`). Read the existing numbered sections 12 to 19 in `jelly-avenue.css` to see how a theme lets those win; copy them.
- Phones are up to 767 px, tablets 768 to 1023 px, desktop 1024 px and up. Per-device values the merchant sets are written as `-m` (phone) and `-t` (tablet) variables and `data-*-mobile/tablet` attributes; section 17 and 18 of each theme file turn them into rules. Start from the closest theme's file so you inherit them.

### Step 5: Add the preview image

Put `preview.svg` (and any icons or images) in `jellyshops/public/themes/jelly-studio/`. Manifest asset paths are validated: they must be `/themes/<id>/<file>`, with no `..` and no external URLs.

### Step 6: Write the starter pack

The starter pack is what a new store gets when the merchant chooses the theme: global sections, a main menu and one template per page type. Today starter packs live in one file, `jellyshops/packages/storefront-registry/src/v4-starter-packs.ts`, in one function (`makePack`) that branches on the pack id. To add a theme:

1. Add the id to `V4StarterPackId`, `V4_STARTER_PACK_IDS` and `COMPLETE_STARTER_PACK_IDS`.
2. Add a branch in `makePack(id)` for copy and images, or a builder like `avenueHome(id)` for a different home page.
3. Provide **every page type the theme supports** (home, product, collection, cart, search, page, blog, article, not-found, plus checkout, wishlist and account pages for a complete theme).

The shape is `V4StarterPack` (`globalSections`, `menus`, `templates`). Templates are lists of placements:

```json
{ "type": "home", "sections": [
  { "kind": "global", "globalSectionId": "header" },
  { "kind": "inline", "section": { "id": "studio-hero", "type": "hero", "enabled": true, "settings": { "contentAlignment": "left" }, "blocks": [ { "id": "studio-hero-title", "type": "heading", "enabled": true, "settings": { "text": "Objects made slowly, by hand" } } ] } },
  { "kind": "global", "globalSectionId": "footer" }
] }
```

`validateV4StarterPack(pack)` (`v4-starter-packs-validation.ts`) checks a pack (known sections and blocks, valid settings, unsafe URLs, duplicate ids, required templates). Run it in a test, as `jelly-signature.test.ts` does.

> **Data-driven alternative (2026-11-03).** Put `theme.json` and `starter.json` (the format of `docs/examples/jelly-studio`) in `storefront-themes/src/themes/<id>/`, run `node scripts/generate-theme-index.mjs`, rebuild the packages. `createStarterPack` turns the folder into a pack (shared sections get their ids, a plain Blog and Article template are added if you do not design them, and the store's main menu comes from `menus` in `starter.json` or is Home and Search when you leave it out). A starter menu item's target is `home`, `search`, an `anchor`, or `external` with a full https address or a path in the store such as `"/search?q=Beds"` or `"/pages/faq"` (store paths are put under the store's address; merchants can type them in Navigation too); children make dropdowns. See `jelly-resthaven/starter.json` and the install route accepts its id. The four built-in packs stay in code, locked by `v4-starter-packs-locked.test.ts`. Custom sections from outside the core set are added with `registerSection({ type: "vendor/name", ... })`, which gives them the shared style controls; add `themes: ["your-theme-id"]` to offer the section only on your theme (the editor hides it elsewhere and the validator refuses it in another theme's starter). `docs/schemas/starter.schema.json` describes the `starter.json` shape for editor autocompletion.

### Step 7: Override markup only when you must

The rule is: **change shared markup, not per-theme copies.** If you need a new option (for example a centred logo), add the setting to the section's registry schema and controls, render it in the shared section, and style it in each theme's CSS. A theme replaces a component only when the markup has to differ:

```tsx
// themes/jelly-studio/hero.tsx
export const StudioHero: ComponentType<ThemeSectionProps> = ({ section }) => { /* … */ };
// theme-registry.ts
definition("jelly-studio", "Jelly Studio", studioTokens, studioManifest, { hero: StudioHero }, studioShell)
```

`sectionOverrides` replaces a section type's component for that theme (`registry-section-renderer.tsx`, `sectionComponent()`). `components` (`ThemeShellComponents`) replaces the page shells: `Layout`, `Header`, `Footer`, `CartPanel`, `CollectionPage`, `ProductPage`, `SearchPage`, `CartPage`, `CheckoutPage`, `OrderPage`, `ContentPage` (see `themes/example-boutique/shell.tsx`). Overrides lose automatic support for new options added to the shared section, so prefer CSS.

### Step 8: Add a custom section (only when the core set is not enough)

The core set already covers heroes, slideshows, product grids, testimonials, FAQ, newsletters, galleries (`custom-content`, `image-mosaic`), banners, logo lists, metaobject lists, apps and the product, collection, cart, search, blog and article pages. Check `listSectionDefinitions()` first (full list in section 5). To add one, you touch five places. The metaobject-list section (`sections/metaobject-list.tsx`) is a complete worked example.

**1. Definition** (`storefront-registry/src/sections/content.ts`): the schema the merchant's data must satisfy, the controls the editor shows, defaults and limits.

```ts
{
  type: "promo-banner", category: "content", supportedPages: ["home", "collection"],
  settingsSchema: z.object({
    heading: z.string().max(120).optional(),
    text: z.string().max(240).optional(),
    image: imageReference.optional(),
    href: z.string().max(500).optional(),
    contentAlignment: alignmentSchema,
  }).passthrough(),
  controls: [
    { type: "text", key: "heading", label: "Heading", group: "content", maxLength: 120 },
    { type: "textarea", key: "text", label: "Text", group: "content", maxLength: 240 },
    { type: "image", key: "image", label: "Image", group: "content" },
    { type: "link", key: "href", label: "Link", group: "content" },
    { type: "segmented", key: "contentAlignment", label: "Alignment", group: "layout", options: [{ label: "Left", value: "left" }, { label: "Centre", value: "center" }] },
  ],
  allowedBlockTypes: ["button"], maxBlocks: 2,
  defaultSettings: { heading: "Limited edition", contentAlignment: "left" },
  defaultBlocks: [], responsiveFields: [],
  presets: [{ id: "promo-banner", label: "Promo banner", category: "content" }],
}
```

Every section automatically gets the shared **Appearance** settings (own colours, fonts, sizes, padding, gradient, shadow, show on, custom CSS) from `withSectionStyleControls()`; do not redefine them.

**2. Label**: add `"promo-banner": "Promo banner"` to `storefront-registry/src/labels.ts` (plain-language names shown in the editor).

**3. Renderer** (`storefront-renderer/src/sections/promo-banner.tsx`): a React component that receives the section and a runtime context. Use `sectionData(section)` on the wrapper (it carries the editor's style attributes) and `blockEditorData(...)` on blocks so they are clickable in the preview.

```tsx
export function PromoBannerSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const heading = stringValue(section.settings, "heading");
  const href = resolveStorefrontHref(section.settings.href, context.storeSlug);
  return <section className="jelly-section jelly-promo-banner" {...sectionData(section)}>
    <StorefrontContainer>{heading && <h2>{heading}</h2>}{href && <a className="jelly-button" href={href}>Shop now</a>}</StorefrontContainer>
  </section>;
}
```

**4. Register** the renderer in `render-registry.tsx` (`registry.register("promo-banner", …)`) **and** add the type to `renderableHomeSectionTypes` in `section-support.ts` (a test fails if an editor preset has no renderer).

**5. Style and test**: add styles to `storefront-base.css` (or your theme file) using tokens only, and add a renderer test plus a registry test. `validateSectionAgainstRegistry()` then accepts the section on the listed pages.

Rebuild the packages (`npm run build:storefront-packages`, section 8) so the editor sees the new definition.

### Step 9: Add page templates

See section 4. In short: a template is a list of placements; the starter pack supplies the default ones; merchants add alternates in the editor.

### Step 10: Connect store data

See section 6. In short: sections receive a runtime context with the product, collection, page or search results already loaded for the route. Settings can also be **bound** to custom fields so merchants never type store-specific data into the theme.

### Step 11: Responsive behaviour

You rarely write breakpoints for sections. Sections accept per-device values (padding, text style, direction, gap, alignment) and a "Show on" choice from the editor; the renderer and the theme CSS apply them at the three breakpoints. For your own components use the same three ranges and test at 390, 768 and 1280 px (the theme preview page does this).

Layout rules every theme must meet (the design lint checks them on every page at desktop, tablet and phone width; `e2e/design-lint.spec.ts`, rules in `src/lib/design-lint/rules.ts`):

- **Header:** no menu link or store name may wrap onto two lines at any width. Below 1024px fold the menu behind the menu button, as the CLI scaffold does; a desktop menu squeezed into a tablet is the most common way a new theme breaks. On tablets and phones the header is at most 180px tall.
- **Product page:** details, options and Add to cart read as one column: at most 32px between them at every width. Their sections are separate in the editor, so set their own spacing to zero and space them inside the column (the scaffold and Jelly Forma show how).
- **Page titles** outside a hero (collection, cart, search, pages, 404) stay at most 56px on desktop, 44px on tablet and 36px on phone; only heroes, slideshows and image banners use the big heading size.
- **Footer column headings** are labels: at most 24px.
- Plus the earlier rules: one shared page edge, at most three section paddings and four heading sizes per page, no sideways scrolling, 24px tap targets on phones, same-shaped product card images, WCAG AA contrast.

Known legacy styles: `src/app/globals.css` still has older default rules for the first themes (hero, gallery, product cards, category cards, a phone rule that stacks the header into a column, 700/560px breakpoints). They apply only to themes that opt in with `"legacyStorefrontStyles": true` in `theme.json`. Built-in themes registered in `theme-registry.ts` use them unless they set it to `false`, a theme that `extends` a base design follows the base, and folder, scaffolded and uploaded themes do not get them, so a new theme starts from `storefront-base.css` alone and needs no overrides for them. The storefront root carries `data-jelly-legacy-styles="off"` when a theme does not use them (`usesLegacyStorefrontStyles()` / `legacyStylesAttribute()` in storefront-themes). Do not set the flag on a new theme.

**Comparing with a reference store.** When a theme follows another store's structure, measure both side by side instead of eyeballing: `node scripts/compare-reference.mjs --theme <preview-path> --reference https://<store> --pages home=/,collection=/collections/all,product=/products/<handle>` (in Git Bash prefix `MSYS_NO_PATHCONV=1` or write `home=` for "/"). It saves screenshots of both at 1280/820/390 px and a `report.md` table (header height, wrapped menu items, title size and position, hero position and height, products per row and card width, product column gaps, footer headings, sideways scroll), marking differences over 15%. It loads the reference one page at a time with a pause, reports a page as blocked when the site shows a bot check and never tries to get past one; measure such pages by hand. Use only for structure and proportions: never copy another store's images, copy or branding.

### Quick start with the CLI (2026-11-03)

For a data-driven theme (a `theme.json`, a `starter.json`, a stylesheet and images, no custom code) you do not need to touch the platform at all. From `jellyshops/` (the CLI is not published to npm yet, so run it from the repository):

```bash
node packages/theme-cli/bin/jelly-theme.mjs create ../my-theme    # scaffold a folder named after your theme
cd ../my-theme
node <repo>/jellyshops/packages/theme-cli/bin/jelly-theme.mjs dev       # preview at http://localhost:5273
```

`dev` shows your theme drawn by the platform's own renderer with sample products, at desktop, tablet and phone widths, on every page in your `starter.json`. Click a section in the preview (or in the list) to edit its settings and blocks; change theme settings in the other tab; add, move or remove sections. Edits are written straight back to `theme.json` and `starter.json`, and edits you make in a text editor (including `theme.css`) show up without a reload. `validate` and `test` run the same checks as the platform (the conformance suite renders every template, checks accessibility with axe and refuses unsafe links). Write `theme.css` as plain CSS (`h1 { … }`, and `& { … }` for the theme's page itself): the platform scopes every rule to your theme in the preview and when it loads an uploaded theme. `jelly-theme package` writes `dist/<id>-<version>.jellytheme.json` and `jelly-theme upload --store <id> --token <token>` sends it to the platform (the token is a developer token the store owner creates in Settings > Developer tokens; see [the design](../plans/theme-packages-design.md)). Upload makes a version; `jelly-theme install <version id> --store <id> --token <token>` puts it on a store draft (see the design for what happens next). **Your own sections** are described as data in `theme.json` under `sections` (see the Promo banner in the scaffold): settings the merchant edits plus heading, text, button, image, group, spacer and products elements that use them as `{settingId}` (a products element shows up to 12 of the store's products, from the featured list or a collection the merchant picks with a `collection` setting). No code is involved, and the section is offered only on your theme. The preview is a lighter editor than the real one (settings as plain fields, no drag and drop, rich text as plain text).

### Step 12: Preview and test locally

```bash
cd jellyshops
npm run dev                         # builds the packages, then next dev
# open http://localhost:3000/theme-preview/jelly-studio   (after adding the preview config and route)
```

Add `jelly-studio` to `src/features/theme-preview/configs.ts` (sample products, copy and cart) and create `src/app/theme-preview/jelly-studio/page.tsx` (two lines, copy another theme's). The page renders the real header, footer, buttons, form fields, product cards and every starter template with sample data at desktop, tablet and phone widths, with no store or login needed. To see the theme with a real store and the editor, run the backend (`cd backend && PORT=3001 npx tsx src/server.ts`), sign in, install the starter pack on a test store and open Online Store.

### Step 13: Repack for the backend, ship and publish

1. `node scripts/prepare-shared-packages.mjs`, then `cd backend && rm -rf node_modules/@jelly && npm install`. The backend validates and compiles with **packed copies** of the schema, registry and themes packages; npm does not replace a same-version tarball, so without this the backend runs stale code. CI runs `prepare-shared-packages.mjs --check` and fails if the tarballs are out of date.
2. Merge. CI (`.github/workflows/core-mvp.yml`) runs typecheck, lint, tests and builds. Deploy the frontend (Vercel) and the API (Firebase Function).
3. A merchant picks the template in onboarding or on the Store designs page. The platform installs the starter pack into their **draft** (`POST …/storefront/starters/:id/install`). They customise in the Theme Editor and press **Publish**, which validates, compiles and activates a new snapshot.

> **Planned.** Steps 2 to 13 collapse to `jelly-theme create`, `dev`, `validate`, `test`, `package`, `upload`, and a staging publish for the merchant. See the plan.

---

## 4. Page templates

A **template** is the layout of one kind of page: an ordered list of placements (`inline` sections or `global` references). Every page type has a default template (`handle: "default"`). A product or collection can use an **alternate** template, chosen from "Page layout" on the product or collection form.

| Page type | Route | Core sections for it |
| --- | --- | --- |
| `home` | `/<store>` | `hero`, `slideshow`, `image-with-text`, `product-grid`, `featured-collection`, `category-grid`, `testimonials`, `faq`, `newsletter`, `custom-content`, … |
| `product` | `/<store>/products/<handle>` | `product-gallery`, `product-information`, `product-options`, `product-purchase`, `product-description`, `product-tabs`, `product-specifications`, `product-stock-counter`, `related-products` |
| `collection` | `/<store>/collections/<handle>` and `/<store>/shop` | `collection-header`, `collection-product-grid`, `collection-description` |
| `cart` | `/<store>/cart` | `cart-summary`, `trust-strip` |
| `search` | `/<store>/search` | `search-results` |
| `page` | `/<store>/<slug>` and `/<store>/pages/<handle>` | `page-content`, `rich-text`, `custom-content`, `contact-store-info` |
| `blog`, `article` | `/<store>/blogs/<blog>[/<article>]` | `blog-header`, `article-list`, `article-header`, `article-content` |
| `not-found` | any unknown path | `not-found-message` |
| `checkout`, `wishlist`, `customer-*`, `order-success` | `/<store>/checkout`, `/wishlist`, `/account/*`, `/order/<token>` | built into complete themes (styled by the theme's CSS); not section-built |

Route-to-page-type matching lives in `pageTypeFor()` (`features/storefront/components/storefront-frame.tsx`) and `resolveStorefrontRoute()` (`features/storefront/resource-loader.ts`). The Theme Editor's page picker lists only pages built from sections (`features/store-editor/page-picker-groups.ts`).

**Defining a default structure.** Put the template in the starter pack (section 3, step 6). **Registering supported sections.** A section is allowed on a page when its definition lists that page in `supportedPages`; the editor's "Add section" only offers those, and Publish rejects others (`SECTION_NOT_ALLOWED_ON_PAGE`). **Exposing editable properties.** Everything in the section's `controls` is editable; nothing else is. **Connecting a template to a route.** Routes are fixed by the platform (table above); you do not add routes. A new *kind* of page (for example a wholesale page) would be a custom `page` template or needs platform work (see the plan).

---

## 5. Editable sections and blocks

### Sections available today

`announcement-bar`, `header`, `footer`, `hero`, `slideshow`, `category-grid`, `image-text`, `image-with-text`, `image-banner`, `custom-content`, `rich-text`, `testimonials`, `faq`, `newsletter`, `multicolumn`, `contact-store-info`, `logo-list`, `metaobject-list`, `apps`, `journal-teaser`, `trust-strip`, `image-mosaic`, `spacer`, `divider`, `featured-collection`, `product-grid`, `page-content`, `blog-header`, `article-list`, `article-header`, `article-content`, `not-found-message` and the product, collection, cart and search sections in section 4. Mapping your examples: hero banner is `hero`, product grid is `product-grid`, testimonials is `testimonials`, promotional banner is `image-banner`, image gallery is `custom-content` with image blocks or `image-mosaic`, advertisement block is `custom-content` with an `app` block or `image` block.

### Anatomy of a section definition

`SectionDefinition` (`storefront-registry/src/types.ts`):

| Field | Meaning |
| --- | --- |
| `type`, `category` | Stable id and group (`layout`, `content`, `commerce`) |
| `supportedPages` | Pages it may be placed on |
| `settingsSchema` | zod schema. Publish rejects invalid settings (`SETTINGS_INVALID`) |
| `controls` | What the editor shows (below) |
| `allowedBlockTypes`, `minBlocks`, `maxBlocks` | Which blocks it may hold, and how many |
| `defaultSettings`, `defaultBlocks` | What a new section starts with |
| `responsiveFields` | Settings that may differ on phones or tablets (plus any control marked `mobile: true`) |
| `presets` | Entries in the "Add section" picker |
| `allowedRegions` | `header`, `template` or `footer` (set for you) |

**Control types** (`ControlDefinition`): `text`, `textarea`, `rich-text` (formatted; plain text kept under the key and the formatted copy under `<key>Doc`; `inline: true` for one line), `number`/`range` (with `min`, `max`, `step`, `unit`), `select`, `segmented`, `checkbox`, `color`, `font`, `spacing`, `link`, `image`, `product`, `collection`. Every control can set `description`, `heading` (a sub-heading in the panel), `showWhen: { key, equals }`, `mobile: true` (separate phone and tablet values), `dynamicTypes` (lets the merchant connect it to a custom field) and `translatable: false`.

### What every section and block gets for free

- **Sections:** own-colours toggle, background and text colour, colour scheme, heading and text fonts and sizes, alignment, padding top and bottom, full width, gradient, shadow, opacity, minimum height, "Show on" (all, desktop, tablet, phones, combinations), custom CSS, phone and tablet values for the keys that allow it.
- **Heading, text, button, image, video, group and app blocks:** width, max width, text style preset (H1 to H4, body, small), colours, border, corner radius, padding per side, gradient, shadow, opacity, minimum height, spacing, "Show on". Button blocks add style, size, hover and "open in new tab".
- **Editor behaviour that needs no code:** drag to reorder, duplicate, hide, delete, undo and redo, keyboard shortcuts, click-to-select in the preview, shared sections (one section reused on several pages), saved sections (a copy kept in the library), per-language text.

### Nested blocks, presets, grouping

A block definition may list `allowedBlockTypes` and `maxBlocks`; the **group** block (direction, alignment, gap, stack on small screens) holds other blocks up to three levels deep (`MAX_BLOCK_DEPTH`), and the validator enforces it (`allowedChildBlockTypes`). Presets are the entries in `presets`. Visibility is the block's `enabled` flag (hide/show) and the "Show on" setting. **Reusable components** are shared sections and saved sections (merchant-level), and shared React components in `packages/storefront-ui` (developer-level).

### Editor integration checklist for a section

1. Definition has a `settingsSchema`, `controls`, defaults and labels.
2. Renderer registered in `render-registry.tsx` and listed in `section-support.ts`.
3. Wrapper uses `sectionData(section)`; clickable blocks use `blockEditorData(block, editor, label, selectedBlockId, fieldKey)`.
4. It renders sensibly with empty data, in `editor` mode with a hint (see `LogoListSection`), and nothing in `published` mode when there is nothing to show.
5. Styles read tokens only.

---

## 6. Dynamic storefront data

**Never hard-code store details.** A section gets what it needs from three places.

**1. The runtime context** (`StorefrontRuntimeContext`, `storefront-renderer/src/runtime-context.ts`): `mode`, `region`, `commerce` (a `CommerceDataProvider`), `page` (`StorefrontPageContext`), `menus`, `storeSlug`, `collectionLinks`, `resourceLinks`. For a product page `page.resource.data.productPresentation` holds the product, pricing, availability, selected options and `addToCart()`; collection, page, blog, article and search pages have equivalent contexts (`types.ts`). `commerce.getProducts({ featured, limit, sort, collectionId })` feeds product grids; `commerce.getMetaobjects(handle)` feeds metaobject sections.

**2. Bindings.** A setting whose control declares `dynamicTypes` can be connected by the merchant to a custom field (a product, collection, page or store field, or a metaobject field). It is saved as `{ kind: "dynamic", binding, fallback }`. The storefront resolves it through `POST /api/public/stores/:storeId/storefront/binding-values` (published, storefront-visible fields only); the editor uses the draft-aware route. A failed lookup falls back to the fallback value. Resolution happens before your component runs, so a section just reads `section.settings.heading`.

**3. Public APIs** for anything else: catalogue (`/api/public/stores/:storeId/catalog/products|collections`), pages and blogs (`…/storefront/context/…`), metaobjects (`…/storefront/metaobjects/:handle`), checkout, customer addresses and orders. The full list is in [`docs/api/endpoints.md`](../api/endpoints.md). The cart is held in the browser and sent to the checkout API; the slide-out bag and cart page read it through `useShop()`.

**Security rules for theme code:**

- Treat every setting as untrusted text. Render text as text. Links go through `resolveStorefrontHref()` or `safeRichTextHref()`, which allow only local paths and http(s).
- Custom CSS is scoped and sanitised by the platform (`custom-css.ts`); never inject merchant strings into `style` or `dangerouslySetInnerHTML`.
- Embeds go through the app-block providers (an https allow-list in a sandboxed frame), not raw iframes.
- Shopper pages call only `/api/public/…` routes. Merchant routes need a merchant token and are for the editor.
- Loading and errors: show the empty state in `editor` mode and render nothing in `published` mode (see `ProductGridSection`, which retries and shows a message on failure).

---

## 7. How a theme becomes editable

Everything the editor can do comes from data the registry exposes. There is no per-theme editor code.

| Question | Answer |
| --- | --- |
| Where do editable fields come from? | The section or block `controls`. The inspector (`features/store-editor/components/inspector/`) renders a control per entry, grouped by Content, Layout, Appearance, Advanced, with sub-headings. |
| Where do theme-wide settings come from? | `settingsSchema` in the manifest, rendered by the Theme settings panel (same controls). |
| Where are defaults? | `defaultSettings` and `defaultBlocks` (sections), the starter pack (pages) and `settingsDefaults` (theme). |
| What is saved? | Section and block `settings` (plus `responsive.mobile/tablet`, per-language `translations`) inside the template layout; theme settings in the theme configuration. All JSON. |
| How does the preview match the live store? | The editor renders the draft with `RegistrySectionRenderer`, the same component the storefront uses, inside an iframe with the theme's CSS and tokens. Only `mode` differs (`editor` adds click handlers). |
| How do edits reach the live store? | Draft save, then Publish: validate (registry, bindings, references), compile to a snapshot, activate. |

The full chain: **theme source** (manifest, CSS, registry definitions, renderers) defines what is possible, the **starter pack** and template defaults define the starting content, the merchant's edits become **saved customisation data** (templates, shared sections, theme configuration), Publish **compiles** that into a snapshot, and the **rendering engine** (`storefront-renderer`) draws snapshot plus CSS. Your code never reads the editor; the editor never knows your theme.

---

## 8. Developer workflow, testing and versioning

### Local workflow (today)

| Task | Command | Notes |
| --- | --- | --- |
| Run the app | `cd jellyshops && npm run dev` | Builds and watches schema, registry and themes, alongside `next dev --turbopack` |
| Hot reload | automatic for **renderer and UI** source and for CSS | `storefront-renderer` and `storefront-ui` are consumed as source |
| Rebuild on change | `npm run dev` (watch and dev server; `dev:watch` is also supported) or `npm run watch:packages` (watch only) | **Schema, registry and themes are consumed as built output.** The watcher builds them once, then rebuilds each on every change. If running Next.js directly, run `npm run build:storefront-packages` after each edit |
| Validate a theme folder | `node scripts/validate-theme.mjs <folder>` (add `--json` for tools) | Checks `theme.json` and `starter.json` with the platform's own rules; errors exit with code 1 |
| Regenerate the schemas | `node scripts/generate-schemas.mjs` (`--check` to verify) | Writes `docs/schemas/theme.schema.json` and `sections.json`; a test fails when they are stale |
| Type check, lint | `npm run typecheck`, `npm run lint` | |
| Unit tests | `npm test` (Vitest) | Add tests beside each file |
| Browser tests | `npm run test:e2e` (Playwright) | Needs a test merchant login; see `docs/development/testing.md` |
| Theme style guide | `/theme-preview/<theme>` | Desktop, tablet, phone; no login |
| Backend | `cd backend && npm run typecheck && npm test` | After repacking the shared packages |
| Docs | `node scripts/generate-docs.mjs` | File maps and references |

### Validation layers (all exist)

0. **Whole theme project:** `validateThemeProject()` (`storefront-themes/src/validate-theme-project.ts`), run by `node scripts/validate-theme.mjs <folder>`. It runs layers 1 to 3 below and adds: every setting's default agrees with `settingsDefaults`, unique ids, templates for the recommended pages, files named in the manifest exist, and **nothing executable** (no scripts, script links, inline handlers, HTML tags that load code, CSS imports, or links that are not local or https). The upload API will reuse it unchanged.
1. **Manifest:** `validateThemeManifest()` (strict zod schema) and `validateThemeSettings(themeId, settings)` (each setting's type and bounds; custom CSS length and safety).
2. **Starter pack:** `validateV4StarterPack()`.
3. **Section placement:** `validateSectionAgainstRegistry(section, pageType)`: known type, allowed on the page, valid settings, allowed blocks and limits, valid phone/tablet and translation keys.
4. **Publish compile** (`backend/src/storefront/compiler/validate-*.ts`): registry, bindings against allowed fields, references to products and pages, template/route context. Problems come back as diagnostics the editor shows with a link to the offending section.
5. **CI:** typecheck, lint, tests, builds, and the tarball check.

### Testing across devices

Use `/theme-preview/<theme>` (three widths, every template) during development; the editor preview has Desktop (1280 px and wider), Tablet (820 px) and Phone (390 px) views that use the same per-device rules as the live store; finish with a real device pass on a staging store. Checklists to copy: `docs/jelly-minimal-launch-checklist.md`, `docs/jelly-avenue-launch-checklist.md`.

### Versioning and safe updates

- **Never change an `id`. Never edit a released `version` in place.** Published stores pin `id` and `version`; a mismatch makes them fall back to the default theme.
- **Safe changes** inside a version: bug fixes in CSS or renderers that keep every saved setting meaningful, and **new settings with defaults** (untouched stores keep their look because tokens are written only when a value differs from the default).
- **Never** rename or remove a setting key, section type or block type that stores have saved, and never tighten a settings schema so existing values become invalid; Publish would start failing for those stores.
- **Breaking changes today are manual:** ship a new theme id (for example `jelly-studio-2`) and let merchants switch (Saved looks keep their settings). There is **no automatic migration** of saved merchant data between theme versions, and no version side-by-side loading. Both are in the plan.

#### How merchants upgrade (2026-11-05)

When you upload a newer version, the store owner sees it under Store designs > Theme updates. They first see what upgrading changes in their draft (your migrations, applied to their theme settings and every section), then upgrade the draft, check it in the editor and publish. They can undo the upgrade until the draft moves to another version. Minor and patch versions need no migrations; a new major version must include a migration path from the previous one, or the upgrade is refused. If your migrations would leave a setting or section invalid, the merchant is told and cannot upgrade, so test your migrations with `applyThemeUpgrade` from `@jelly/theme-sdk` before uploading.

#### Phase 4 foundations: compatibility and migration dry runs

New projects declare `"engines": { "jelly": ">=1 <2" }` in `theme.json`. The declarative theme API is **1.0.0**, independent of internal npm package versions. Existing manifests may omit `engines`. Ranges are space-separated comparisons (`>=`, `>`, `<=`, `<`, `=`); one to three numeric components are accepted, with missing components padded with zero for comparisons. An exact `1` or `1.0` matches that version prefix. `^`, `~`, wildcards, prerelease ranges and `||` are unsupported and produce an error. Both local validation and upload reject incompatible ranges; install checks again against the current platform.

Theme versions use strict SemVer, including `2.0.0-rc.1+build.7`. Numeric components must be safe integers and the version can be at most 128 characters. Prereleases sort before releases; build metadata does not make a newer release. Uploads cannot overwrite a version or move backwards. Removing a declared setting, changing its type, removing a recipe or dropping a recipe's supported page requires a major version. Each major upload must include a complete migration path from the latest upload (including a yanked latest version). Schema bounds and choice changes still need the developer's compatibility review.

Migration declarations are inline in `theme.json`, preserving package format 1 and immutable manifest storage:

```json
"migrations": [{
  "from": "1.0.0",
  "to": "2.0.0",
  "operations": [
    { "op": "renameSetting", "target": { "scope": "theme" }, "from": "branding.oldName", "to": "branding.name" },
    { "op": "renameSetting", "target": { "scope": "section", "type": "jelly-studio/promo-banner" }, "from": "title", "to": "heading" }
  ]
}]
```

Operations are `renameSetting`, `setDefault` (`key`, `value`), `removeSetting` (`key`), `renameSectionType` (`from`, `to`) and `renameBlockType` (`from`, `to`). Setting targets are `theme`, `section` or `block`; the latter two require `type`. Operations run in order, so rename a type before targeting its new name. Section and block setting renames/removals also apply to existing mobile/tablet overrides. Defaults are added only to base settings, preserving breakpoint inheritance and existing false, zero, empty-string and null values. Missing rename/remove sources are skipped. Existing rename destinations or non-object parents cause a conflict, and prototype paths are forbidden.

`applyThemeMigrations(draft, from, to, migrations)` from `@jelly/theme-sdk` accepts `{settings, sections}` and returns `{draft, changes}` with added, removed and changed paths. Pass all global and inline sections, retaining their ids. It clones input and migration values, walks nested blocks, and requires an unambiguous chain of exact version edges. Keep the input for a future rollback snapshot. This is a **dry run**, with no database writes; a future upgrade service must validate the resulting draft against the destination registry before saving it.

**Still pending:** side-by-side runtime versions, transactional merchant draft upgrades, persisted rollback snapshots, the diff/confirmation screen, and the Store designs upgrade action. Installing a package still installs its starter; it does not preserve and migrate an existing draft. Until the runtime supports simultaneous versions, use a separate test theme id to exercise major changes safely.

**Deployment prerequisite:** migration `20261103010000_theme_semver.sql` is prepared in both backend migration directories, but has not been applied to staging. It checks package and draft rows before changing constraints and aborts without rewriting them if a previously accepted non-SemVer version (for example `01.0.0`) exists. Run that inventory before deploying this backend; keep the previous backend if the preflight fails and agree a legacy-data policy first. Published versions and snapshots must never be silently renamed.

---

## 9. Complete example theme: Jelly Studio

Real files, validated by `docs/examples/jelly-studio` tests:

```text
docs/examples/jelly-studio/
  theme.json      the manifest above (14 settings in 6 groups)
  starter.json    global header, announcement and footer; home, product, collection, cart, search, page and 404 templates
  assets/         preview.svg, mark.svg (a theme folder keeps its files in assets/; today they are copied to public/themes/<id>/)
```

Check it yourself: `node scripts/validate-theme.mjs docs/examples/jelly-studio` prints `No errors.`

**What the example demonstrates**

| Requirement | Where |
| --- | --- |
| Homepage template | `starter.json` → `templates.home`: announcement, header, `hero` (heading, text, button blocks), `product-grid` (featured, 4 columns), `testimonials` (two blocks), `newsletter`, footer |
| Product page | `templates.product`: `product-gallery`, `product-information`, `product-options`, `product-purchase`, `product-description`, `related-products` |
| Collection page | `templates.collection`: `collection-header`, `collection-product-grid` |
| Header and footer | `globalSections.header` / `footer` (shared across templates, edited once) |
| Hero section | `hero` with `heading`/`text`/`button` blocks; alignment, colours, padding from the shared Appearance controls |
| Featured product grid | `product-grid` with `limit`, `columns`, `emptyMessage`; products come from `commerce.getProducts()` |
| Reusable button component | The platform's button (`StorefrontButton` in `packages/storefront-ui`, `.jelly-button` class). Style it in your CSS; do not rebuild it: `[data-jelly-theme="jelly-studio"] .jelly-button { border-radius: var(--jelly-radius-button, 8px); }` |
| Global settings | `theme.json` → `settingsSchema` |

**The steps to register it**

1. `mkdir packages/storefront-themes/src/themes/jelly-studio` and copy `theme.json`.
2. Add `tokens.ts` and the `definition("jelly-studio", …)` line (step 3).
3. Add `src/app/themes/jelly-studio.css` and import it in `layout.tsx` (step 4).
4. Add `public/themes/jelly-studio/preview.svg` and `mark.svg` (step 5).
5. Add `"jelly-studio"` to the three pack lists and a `makePack` branch that builds the pack from `starter.json` (step 6); run `validateV4StarterPack` in a test.
6. Add the preview config and route (step 12).
7. Repack (`node scripts/prepare-shared-packages.mjs`), run the tests, open `/theme-preview/jelly-studio` at three widths, then install the starter on a staging store and publish.

The example uses only existing sections, so it needs no custom section code. It also shows the layout a future theme package will have (`theme.json`, `starter.json`, `assets/`). The `promo-banner` in step 8 shows how to add one. **Sketched, not compiled:** the TypeScript and CSS snippets in this guide follow the real files they were taken from, but only the JSON in `docs/examples/jelly-studio` is machine-checked.

---

*Companion document: [Theme SDK and developer platform plan](../plans/theme-sdk-plan.md): what exists, what is partial, what is missing, and the design to close the gap.*
