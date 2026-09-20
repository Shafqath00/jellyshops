# JellyShop themes

Themes are compiled React presentation modules. Storefront templates, catalog data, carts, checkout, authorization, and API clients remain JellyShop core code.

## Theme package structure

Create `packages/storefront-themes/src/themes/<theme-id>/` with `theme.json`, `tokens.ts`, and optional React overrides. Put static assets below `public/themes/<theme-id>/`.

`theme.json` requires a kebab-case `id`, semantic `version`, `assetPrefix` exactly `/themes/<id>/`, `layout` (`standard` or `editorial`), `enabled`, `settingsDefaults`, and an `assets` manifest. Register the compiled module in `src/theme-registry.ts`; explicit imports let Next bundle and audit theme code.

The asset manifest is local and namespaced:

```json
{
  "assets": {
    "stylesheets": [],
    "scripts": [],
    "fonts": [],
    "icons": [{ "id": "monogram", "path": "/themes/example-boutique/monogram.svg" }],
    "assets": [],
    "preview": { "path": "/themes/example-boutique/preview.svg", "alt": "Example Boutique preview" }
  }
}
```

Asset paths must be local `/themes/<theme-id>/...` paths; traversal, remote URLs,
and script URLs are rejected. Theme scripts are catalog metadata only for now and
are not injected into the storefront. Theme CSS continues to come from the
compiled JellyShop bundle and canonical token variables, avoiding duplicate or
arbitrary stylesheet execution. Local font metadata is available for future
first-party font loading and currently falls back to the resolved font stacks.

## Selecting and publishing

Save `{ expectedRevision, themeId, themeVersion, settings }` through the authenticated workspace theme-settings endpoint, then publish. The existing workspace mutation coordinator keeps revision/concurrency protection. Published snapshots hold resolved ID, version, settings, and compatibility `presetId`.

In **Admin → Online Store**, the available-theme cards are loaded from the authenticated canonical catalog endpoint, not a frontend list. Selecting a card preserves the current settings, saves the catalog ID/version with the current revision, and does not publish automatically. If a saved theme is no longer available, the page shows an explicit warning and lets the merchant choose another installed theme.

## Fallback and assets

Missing, disabled, malformed, or version-incompatible themes render the `minimal` default theme with a fallback reason. Rendering resolves active theme, then default theme, then shared storefront sections. Admin previews use the declared manifest preview, then the default theme preview, then a polished placeholder; they never construct an implicit `preview.svg` URL. Only use asset paths below the manifest's `assetPrefix`, for example `/themes/example-boutique/monogram.svg`.
# Theme customization

## Theme-owned storefront shell

Themes can optionally register presentation-only `components` in their
definition: `Layout`, `Header`, `Footer`, and `CartPanel`. They receive typed
store, navigation, cart-count and resolved-setting view models. Core still
owns repository access, cart line calculation and mutation, checkout links,
keyboard handling, payment and authentication.

Each shell component is resolved consistently: active theme → default/base
theme → shared JellyShop presentation. Omit any component to inherit the next
fallback. `example-boutique/shell.tsx` is the complete reference: its header,
footer, layout and cart wrapper are presentation-only and use manifest-defined
settings such as `header.announcement`, `footer.showNewsletter` and
`layout.backgroundStyle`.

The public `StorefrontFrame` reads the immutable published snapshot to select
the shell. The Theme Editor uses its draft `ThemeConfiguration` with the same
resolver, so shell settings change in preview before an explicit publish.

Themes can also provide `CollectionPage` and `ProductPage` presentation
components. These receive normalized product/option view models and callbacks
for option selection and add-to-cart. The route remains responsible for
catalog reads, configured pricing, stock checks and cart mutation. A missing
page component falls back to the shared JellyShop implementation exactly like
the shell components.

Themes declare editable merchant settings in their manifest, alongside their
default values. The manifest is the source of truth; the admin UI receives the
safe, serializable `settingsSchema` from the workspace theme catalog and never
imports theme modules directly.

```json
{
  "settingsDefaults": { "colors": { "accent": "#315e24" } },
  "settingsSchema": [
    { "id": "colors.accent", "type": "color", "label": "Accent color", "default": "#315e24" }
  ]
}
```

Setting IDs may use stable dotted paths. Supported field types are `text`,
`textarea`, `number`, `range`, `checkbox`, `select`, `radio`, `color`, `font`,
`image`, `url`, `richtext`, and `alignment`. Choices declare `options`; numeric
fields declare bounds. The backend validates declared values while preserving
unknown compatible keys from older extensions.

In **Online Store → Open theme editor → Theme settings**, every control is
generated from the selected manifest. Changes save only the revisioned
`ThemeConfiguration` workspace draft and refresh the draft canvas; publishing
remains an explicit operation. At publish time, resolved ID, version, defaults
and overrides are frozen in the immutable storefront snapshot.
