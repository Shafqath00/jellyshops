# Multi-Theme Storefront Design

## Goal

Make a store's `ThemeConfiguration` the authoritative selection and settings record for a published JellyShop storefront. Themes are compiled React modules with manifests, not executable tenant uploads or a second template language.

## Existing architecture

The public storefront is a Next.js application in `jellyshops`. Store routes under `src/app/[storeSlug]` load an Express public publication endpoint and render compiled V4 snapshots through `@jelly/storefront-renderer`. The snapshot stores structured workspace templates, global sections, menus, assignments, and an unvalidated `theme` payload. `backend/src/storefront/workspace` persists a separate `ThemeConfiguration`, but it is not the public runtime's source of truth today.

`@jelly/storefront-themes` contains built-in design tokens; `@jelly/storefront-registry` owns generic section definitions and React section implementations. The older shared `StorefrontFrame` provides page chrome outside the compiled renderer. No Liquid, Handlebars, filesystem SSR template lookup, or runtime code loading exists.

## Design

### Canonical registry and theme packages

`@jelly/storefront-themes` will become the canonical built-in theme registry. Each shipped theme lives under `src/themes/<directory>/` and has a `theme.json` manifest, token module, optional theme layout component, optional section overrides, and assets directory. A TypeScript registry imports known build-time-safe modules and validates each manifest at startup. This preserves Next's static bundling/security model while giving contributors a conventional theme directory.

The `default` package represents the current compatible visual system and supplies the base fallback. `example-boutique` demonstrates distinct chrome, a distinct home composition, typography/tokens, a local theme asset, and a section override. Existing preset IDs remain registered for backwards-compatible published documents.

### Resolution and fallback

`ThemeResolver` accepts a requested ID, settings, and optional pinned version. It validates the registry manifest and returns a resolved theme descriptor. Missing, invalid, disabled, or version-mismatched themes resolve to the manifest-designated default and retain a machine-readable fallback reason. Selection never throws on public rendering.

The renderer resolves behavior in this order:

`active theme layout/section override -> default theme layout/section override -> shared storefront registry renderer`.

Theme code only controls presentation. It receives normalized settings and presentation props; product lookup, carts, commerce APIs, store data, publication loading, and authorization remain core application responsibilities.

### Persistence and publishing

The existing `ThemeConfiguration` table remains the store-level configuration store. Its `themeId` is validated by the workspace theme service; settings are stored as JSON and revised through the existing workspace mutation coordinator. A migration adds `themeVersion`, allowing a published build to be pinned deterministically.

The compiler loads the configuration alongside workspace data, resolves it, and embeds `id`, `version`, normalized settings, and fallback metadata into a V4 runtime snapshot. The immutable publication cache continues to cache the complete snapshot by publication ID. A theme or settings mutation increments workspace generation; publishing creates a new immutable result.

### Admin and assets

The existing Online Store page reads registry definitions dynamically and saves a selection through the existing authenticated `/theme-settings` endpoint. It does not hard-code a list of installable themes. Theme assets live below the Next public namespace `/themes/<theme-id>/...`; manifest validation restricts asset references to the owning theme namespace. The bundled assets are cacheable using normal Next static asset behavior; a manifest version is part of publication data, enabling cache invalidation through a new publication.

## Data flow

`store request -> published snapshot/workspace ThemeConfiguration -> backend ThemeResolver -> validated manifest/theme definition -> compiled snapshot { id, version, settings } -> frontend renderer -> active override -> default-theme override -> shared registry component -> rendered storefront`.

The public runtime uses the pinned snapshot data; drafts use the same resolver before preview. An unavailable theme produces the default theme rather than a failed storefront and can be surfaced in admin diagnostics.

## Error handling and validation

- Manifests require a safe kebab-case id, non-empty name/version, valid asset paths, and a settings schema/default object.
- Admin writes reject unknown or disabled theme IDs with a 400-class API error; the public compiler defensively falls back for legacy/deleted records.
- Runtime accepts old V4 publications with `presetId` and maps them through the resolver, preserving deployed snapshots.
- Theme settings are merged with the selected manifest defaults before snapshot persistence.

## Scope limits

This change does not introduce tenant-uploaded JavaScript, change commerce/domain APIs, replace existing generic sections, or migrate every legacy hard-coded shop/product route into theme-specific templates. It makes the compiled storefront and shared chrome theme-aware while preserving those routes.
