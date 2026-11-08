# Theme system

The detailed authoring guide (what a theme is made of, rules, how to add one) is [../theme-architecture.md](../theme-architecture.md). This page connects it to the code and the runtime.

## Layers (all paths real)

| Layer | Location |
| --- | --- |
| Theme definition (tokens, settings schema) | `jellyshops/packages/storefront-themes/src/<theme>/definition.ts`; registry in `theme-registry.ts`; fonts in `src/fonts.ts` |
| Token resolution | `resolveDesignTokens` (`--jelly-*`) and `resolveStorefrontThemeTokens` (adds `--theme-*`, `--store-*`); the live store and the editor preview both use the storefront layer |
| Section and block definitions, editor controls | `jellyshops/packages/storefront-registry/src/` |
| Starter packs | `packages/storefront-registry/src/v4-starter-packs.ts` (`COMPLETE_STARTER_PACK_IDS`) |
| Rendering | `packages/storefront-renderer/src/sections/*.tsx` (+ `packages/storefront-ui`) |
| Styles | `jellyshops/src/app/themes/{storefront-base,jelly-minimal,jelly-avenue}.css`, scoped by `[data-jelly-theme="<id>"]`; fonts via `next/font` in `src/app/fonts.ts` |
| Schemas | `packages/storefront-schema/src/` (documents, runtime snapshot) |
| Review pages | `/theme-preview/jelly-minimal`, `/theme-preview/jelly-avenue` (`features/theme-preview/`) |

## Themes today

- **Jelly Minimal**, id `jelly-signature`: warm white/charcoal/sand, Fraunces + Inter, 8px scale, 1280px container.
- **Jelly Avenue**, id `jelly-avenue`: editorial, image-led; slideshow section, tabbed product grid, header over first image, footer newsletter and link columns.

The themes package also contains older, smaller theme folders (`minimal`, `classic`, `bold`, `elegant`, `fresh-market`, `playful`, `artisan-boutique`, `themes/`) resolved through `theme-registry.ts` and `theme-resolver.ts`; they are not complete themes.

Both Jelly themes are *complete* themes (checkout, account, order pages, information pages, 404 included). Use `isCompleteStorefrontTheme()` and `COMPLETE_STARTER_PACK_IDS`; never hard-code theme ids.

## How a store gets a theme

1. A starter pack is installed into the store's draft (`.../storefront/starters/:starterId/install`).
2. The merchant changes theme settings (`PUT .../storefront/theme-settings`) and templates in the editor.
3. Publishing compiles everything into an immutable snapshot ([publishing](publishing.md)); the storefront renders the snapshot.
4. Existing stores keep their saved colours and fonts: published snapshots are immutable.

## Invariants

- Never bump a theme `version` or change a theme `id` (published stores pin them).
- Storefront CSS reads tokens only.
- Backend uses packed copies of schema/registry/themes: repack after changes ([shared-modules](../file-structure/shared-modules.md)).
- One renderer for preview and live.
