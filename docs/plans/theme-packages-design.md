# Theme packages: design for Phase 3 (packaging, upload, install)

Status: 2026-11-03. Migration applied to staging. **Built so far (backend):** upload, validation, versions, yank, list and the public version/asset routes (`backend/src/storefront/theme-packages/`). **CLI built:** `jelly-theme package` (writes `<id>-<version>.jellytheme.json`, refuses themes that do not validate) and `jelly-theme upload` (`--store`, `--token`, `--api` or JELLY_STORE_ID / JELLY_TOKEN / JELLY_API_URL; prints the platform's plain message and issues). A backend test uploads a CLI-built package, so the two cannot drift. The token is a signed-in merchant access token (the admin's bearer token), which expires with the session; long-lived developer tokens are not built. **Not built:** install on a store, runtime loading in the storefront and editor, recipes. Decisions taken while building: asset files go through the existing media storage (no new bucket yet), any store with `storefront:edit` may upload its own themes, private only. Parent plan: [theme-sdk-plan.md](theme-sdk-plan.md). Trust model: declarative only, no uploaded code.

## What exists that this builds on

- The publish snapshot already records `theme.id`, `theme.version`, `theme.settings` and a `theme.artifactId` (backend `compiler/snapshot.ts`; the draft side keeps `draftArtifactId` and publications keep `themeArtifactId`). Both artifact columns are plain text today and nothing writes them: they are the hook for "which uploaded version".
- `validateThemeProject()` is the one validator (manifest, settings, starter, assets, nothing executable). The upload API calls the same function the CLI does.
- `registerThemeProject()` registers a theme folder at run time; the frontend, backend and CLI can all call it.
- `theme.css` is used by the CLI preview only; published stores do not load it yet.

## Package format

A package is one JSON file, `<id>-<version>.jellytheme.json`, made by `jelly-theme package`:

```json
{ "format": 1, "manifest": {…theme.json…}, "starter": {…starter.json…}, "css": "…", "assets": [ { "path": "preview.svg", "contentType": "image/svg+xml", "base64": "…" } ] }
```

Why JSON and not a zip: no archive library on the server (zip bombs, path tricks), every part is inspectable and validated as data, and the limits are easy to state (whole file at most 10 MB, CSS at most 200 KB, each asset at most 2 MB, images and fonts only, at most 100 assets). A zip form can be added later without changing the stored model.

## Data model (migration draft)

| Table | Holds |
| --- | --- |
| `ThemePackage` | one theme: owner store, the theme id it claims (globally unique), name, visibility `private` or `listed` |
| `ThemePackageVersion` | one immutable upload: semver, manifest, starter, css, asset list (paths, sizes, hashes), content hash, status `active` or `yanked` |
| `ThemeInstall` | which version of which package a store uses (one row per store and package) |

All three are server-only with row level security, like the other store tables. A `ThemePackageVersion` id is what goes into `artifactId` in drafts and snapshots, so a published store pins an exact version.

Asset files go to object storage (a new bucket, `theme-assets`, written only by the backend), under `<packageId>/<version>/<path>`, and are served through a public, immutable-cache backend route. The database keeps the list and hashes. **Creating the bucket is a second step I would ask you about, separately from the tables.**

## Rules at upload (server side, same code as `jelly-theme validate`)

1. `validateThemeProject` with no errors: manifest schema, settings, starter against the registry, unsafe URLs, executable content (script tags, handlers, CSS `@import`, remote `url()`).
2. The theme id is not a built-in id and is either new or owned by the uploader's store.
3. The version is new and higher than the owner's latest (semver); existing versions are never overwritten.
4. CSS passes the custom-CSS safety check and is **scoped on the server** with `scopeCustomCss`: authors write plain CSS (`h1 { … }`, `& { … }` for the theme root) and every selector is prefixed with `[data-jelly-theme="<id>"]`. The CLI preview applies the same step, so what developers see is what stores get. Limits: no `@import`, `@font-face` or non-https `url()`, so images used from CSS must be https links for now.
5. Assets: allowed types only (png, jpeg, webp, gif, svg without scripts, woff2), sizes within limits, every path the manifest names exists, every file's hash recorded.
6. Failures come back as the same plain messages the CLI prints, with paths.

## Install and run

- `POST /api/stores/:storeId/storefront/theme-packages/:packageId/install` (merchant permission) creates or replaces the `ThemeInstall`, sets the draft theme id/version/artifact, and installs the starter into the draft the same way the built-in starters are installed (reusing `installation-service.ts`). Developers can install their own private package on their own stores; `listed` packages are for later and need a review decision first.
- **Runtime:** the snapshot carries `theme.artifactId`. For a theme id that is not built in, the storefront loads `GET /api/public/theme-versions/:versionId` (manifest, css, asset base URL; cacheable forever because versions are immutable), calls `registerThemeProject`, and draws the stylesheet inside the theme wrapper. The editor does the same for the draft's version. Without a registered theme the existing fallback to the default theme stays (with the fallback reason in the snapshot).
- Publish pins the version (already true). Upgrading a store to a newer version is Phase 4.

## Section recipes (recommended small set)

A recipe is a section defined in `theme.json` or a `sections/*.json` file as data: a layout (stack or grid, columns, gap), a list of slots drawn from a **fixed set of primitives** (heading, text, image, button, product list, spacer, group), and the settings it exposes (each setting maps to a slot property). The platform renders it with the existing renderer, so it gets the shared style controls, translations and editor support for free and can never run code. I recommend this small set over letting a theme compose any existing section, because composing sections would make the recipe format as large as the registry and hard to keep stable across versions. This is built last, after upload and install work.

## Build order inside Phase 3

1. Migration (needs your approval to apply to staging) and the backend service: upload, validate, store, list versions.
2. `jelly-theme package` and `jelly-theme upload` (login by a token the merchant creates; no passwords handled by me).
3. Install on a store and runtime loading in the storefront and editor, including `theme.css`.
4. Recipes.
5. Staging check with a signed-in merchant: upload, install, edit, publish, compare live and preview at three widths. Needs you to sign in.

## Open questions for you

- Create the `theme-assets` storage bucket on staging (and where else)?
- Who may upload: any merchant store (as drafted: the owner store) or only stores you mark as developers? The `developer:*` permissions exist but no route uses them.
- Is a private-only first release fine (no marketplace, no `listed`)?
