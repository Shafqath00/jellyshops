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
- Known limit until phase 3: `--j-color-*` are resolved on the theme root, so a section's own colour scheme does not change them yet.

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

### 2.4 Settings model

- Universal section settings: colour scheme, width, spacing (none / S / M / L, custom px under "Custom"), show on.
- Everything else is specific to the section's job and offered as choices.
- Colours are palette or scheme references; free hex only in the palette editor.
- The older free-form style settings move behind an "Advanced" group a theme can switch off; saved values keep rendering.

### 2.5 Components

One product card (a block set: media, title, price, swatches, badge, rating, button) used by every product list. Buttons primary/secondary, price, badge, swatch, field and rating read only colour roles and tokens.

### 2.6 Themes and templates

- A theme = token values + palette and schemes + preset defaults + signature CSS (target ≤ 400 lines for existing themes, ≤ 150 for new ones; no hex, no px except hairlines).
- A template (starter) = presets + store bindings only; home has 4–8 sections.
- Never change a theme `id` or an installed theme's `version` in place.
