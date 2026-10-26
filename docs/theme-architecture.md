# Storefront theme architecture

A Jelly Shop theme is a look, not a separate storefront. Every theme renders the same section markup, so the editor preview, the published store and future themes stay in step. A theme decides how that markup looks and which defaults a merchant starts from.

```text
Theme ─ tokens + settings schema        packages/storefront-themes/src/<theme>/definition.ts
  │     stylesheet                      jellyshops/src/app/themes/<theme>.css
  ▼
Starter pack ─ page templates           packages/storefront-registry/src/v4-starter-packs.ts
  │            sections + blocks + settings, menus, global header/footer
  ▼
Section registry ─ settings schema      packages/storefront-registry/src/sections/*.ts
  │                editor controls      (what the merchant can change)
  ▼
Section renderer ─ shared markup        packages/storefront-renderer/src/sections/*.tsx
                   shared components    packages/storefront-ui/src/*.tsx
```

## The four parts of a theme

1. **Tokens and settings** (`definition.ts`). `ThemeTokens` holds the defaults. `settingsSchema` lists the global settings shown under Theme settings in the editor: colours, fonts, sizes, button corners, page width, section spacing and product cards. Keep the labels plain ("Buttons", "Page width") and the list short.
2. **Stylesheet** (`jellyshops/src/app/themes/<theme>.css`). Every rule is scoped to `[data-jelly-theme="<theme-id>"]`. Read values only from the resolved tokens (`--theme-*`, `--jelly-*`), never hard-coded colours, so merchant settings apply everywhere. Jelly Minimal defines its derived scale as `--jm-*` (colours, an 8px spacing scale, a type scale) at the top of its file.
3. **Starter pack.** The templates, sections and copy a new store starts with. Every page type a theme supports needs a template.
4. **Style guide.** Every complete theme has one at `/theme-preview/<theme>` (`/theme-preview/jelly-minimal`, `/theme-preview/jelly-avenue`). It renders the real header, footer, buttons, form fields and product cards, plus every starter template with sample data, at desktop, tablet and mobile widths. The page is shared (`src/features/theme-preview/`); a theme only adds a sample-data entry in `configs.ts`.

## Complete storefront themes

Jelly Minimal (`jelly-signature`) and Jelly Avenue (`jelly-avenue`) are *complete* themes: they install every page type (checkout, account, wishlist, order pages) plus draft information pages, render their own header and footer around every route, and use the catalogue browser with filters and sorting. Code asks `isCompleteStorefrontTheme(id)` (`@jelly/storefront-themes`) and `COMPLETE_STARTER_PACK_IDS` (`@jelly/storefront-registry`) instead of checking for one theme id. Add a new complete theme to both lists.

Sections a theme can offer beyond the core set live in their own registry/renderer files so they do not collide with the core product sections: `slideshow`, product-grid tabs (`product-tab` blocks), footer link columns (`link-heading` / `link` blocks) and the product page's `product-tabs` (`info-tab` blocks) and `product-stock-counter` (`jellyshops/packages/storefront-registry/src/sections/product-extras.ts`, `.../storefront-renderer/src/sections/product-extras.tsx`). The collection page's filter toolbar is `src/features/storefront/catalog-browser.tsx`; themes show or hide its parts (Filters toggle, product count, size toggle) with CSS.

## Rules

- **Change shared markup, not per-theme copies.** If a theme needs a new element or option (for example a centred logo), add the setting to the section's registry schema and controls, render it in the shared section, and style it in each theme's CSS. A theme only overrides a section component (`sectionOverrides`) when the markup has to differ.
- **Fonts.** Fonts are self-hosted with `next/font` in `jellyshops/src/app/fonts.ts` and exposed as CSS variables. `fontStack()` in `packages/storefront-themes/src/fonts.ts` maps the font name saved in settings to a safe font stack. To add a font, add it in both places and to `FONT_OPTIONS`.
- **Stable ids.** A theme id is stored in merchants' settings and publications. Rename only the display name; never change the id.
- **Backend copy.** The backend uses packed copies of the schema, registry and themes packages. After changing them, run `node scripts/prepare-shared-packages.mjs`, then reinstall `@jelly/*` in `backend/` (`rm -rf node_modules/@jelly && npm install`), because npm does not replace a same-version tarball.

## Adding a new theme

1. Copy `jelly-avenue/definition.ts` (or `jelly-signature/`) to a new folder, choose a new id, and register it in `theme-registry.ts` and `COMPLETE_STOREFRONT_THEME_IDS`.
2. Create `jellyshops/src/app/themes/<id>.css` scoped to the new id, and import it in `jellyshops/src/app/layout.tsx`. Start from the closest existing theme's file: it is organised in the same numbered sections (tokens, base, buttons, forms, header, footer, cards, sections, pages, motion), so only the tokens and the look of each section change.
3. Add the id to `V4StarterPackId`, `V4_STARTER_PACK_IDS` and `COMPLETE_STARTER_PACK_IDS` in `v4-starter-packs.ts`, give it a home page builder (see `avenueHome`), a summary and tags for the template gallery, and a thumbnail in `template-preview.tsx`.
4. Add a `ThemePreviewConfig` in `src/features/theme-preview/configs.ts` and a two-line route at `src/app/theme-preview/<slug>/page.tsx`, then check every page type at 390, 768 and 1280 px.
5. Repack the shared packages for the backend (see Rules).
