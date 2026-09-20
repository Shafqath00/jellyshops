# Theme lifecycle production checklist

## Deploy

1. Apply every SQL file in `backend/sql/migrations` in filename order, including
   `20260920100000_repair_theme_configuration_version.sql`.
2. Verify `ThemeConfiguration.themeVersion`, `StorefrontWorkspace`, and compiled
   publication tables exist before starting the API.
3. Build the storefront with `npm run build` from `jellyshops/` and the API with
   `npm run build` from `backend/`.
4. Confirm `NEXT_PUBLIC_STORE_EDITOR_API_URL`, database credentials, and the
   configured auth environment are present.
5. Confirm `/public/themes/<theme-id>/...` assets are included in the deployed
   storefront image.

## Publish smoke test

Select a theme and change one setting in Online Store. Confirm the editor preview
changes while the public store is unchanged. Publish once, refresh the public
store, and verify the new publication is visible. A second draft edit must not
change the active publication until it is published.

## Caching and rollback

Public publication fetches use `Cache-Control: no-store` and browser `cache:
"no-store"`; the backend runtime cache is keyed by immutable publication ID.
Static theme assets are ordinary public files and may be CDN-cached because their
paths are theme-scoped. Uploaded media should use the media service's immutable
URL; do not overwrite a file at the same URL.

Every publish creates a separate immutable snapshot. To roll back, republish a
known-good draft/publication through the existing publish workflow; never mutate
an older snapshot in place. If a selected theme is removed or disabled, runtime
resolution falls back to the default theme without rewriting historical snapshots.

If a migration is missing, the API should be stopped and the migration applied;
do not manually alter theme rows or run the application against a partially
migrated schema.
