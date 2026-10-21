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
4. **Style guide.** Jelly Minimal's is at `/theme-preview/jelly-minimal`. It renders the real header, footer, buttons, form fields and product cards at desktop, tablet and mobile widths. Review a theme there before you build pages.

## Rules

- **Change shared markup, not per-theme copies.** If a theme needs a new element or option (for example a centred logo), add the setting to the section's registry schema and controls, render it in the shared section, and style it in each theme's CSS. A theme only overrides a section component (`sectionOverrides`) when the markup has to differ.
- **Fonts.** Fonts are self-hosted with `next/font` in `jellyshops/src/app/fonts.ts` and exposed as CSS variables. `fontStack()` in `packages/storefront-themes/src/fonts.ts` maps the font name saved in settings to a safe font stack. To add a font, add it in both places and to `FONT_OPTIONS`.
- **Stable ids.** A theme id is stored in merchants' settings and publications. Rename only the display name; never change the id.
- **Backend copy.** The backend uses packed copies of the schema, registry and themes packages. After changing them, run `node scripts/prepare-shared-packages.mjs`, then reinstall `@jelly/*` in `backend/` (`rm -rf node_modules/@jelly && npm install`), because npm does not replace a same-version tarball.

## Adding a new theme

1. Copy `jelly-signature/definition.ts` to a new folder, choose a new id, and register it in `theme-registry.ts`.
2. Create `jellyshops/src/app/themes/<id>.css` scoped to the new id, and import it in `jellyshops/src/app/layout.tsx`.
3. Add a starter pack for the id in `v4-starter-packs.ts`.
4. Add a style-guide route like `/theme-preview/jelly-minimal`, then check every page type at 390, 768 and 1280 px.
