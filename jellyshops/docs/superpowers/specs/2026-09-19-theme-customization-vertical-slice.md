# Theme customization vertical slice

## Existing extension points

`packages/storefront-themes` is the canonical manifest-backed registry and
resolver. `ThemeConfiguration` is the revisioned, per-store draft source of
truth. The normalized workspace stores templates, sections and blocks already;
`packages/storefront-registry` provides their serializable control metadata,
and `src/app/admin/online-store/editor/page.tsx` renders the draft preview.

## Scope of this slice

Add a serializable, typed global-settings schema to theme manifests. The
workspace theme catalog exposes only safe manifest metadata. A manifest's
defaults plus `ThemeConfiguration.settings` are resolved centrally, validated
on the backend, and rendered as dynamic controls in the existing editor. The
editor saves through the existing revision-aware theme-settings endpoint and
uses the resolved configuration for its draft preview.

This deliberately reuses the existing section/block/template editor instead
of duplicating that document model. Commerce and route data remain core-owned.

## Data flow

`store request -> immutable published snapshot -> theme resolver -> manifest,
resolved settings and layout -> renderer -> active override -> base override
-> shared section renderer`.

For draft editing: `editor -> catalog + ThemeConfiguration -> manifest schema
-> dynamic controls -> revisioned theme-settings workspace save -> local draft
preview -> explicit publish -> immutable snapshot`.
