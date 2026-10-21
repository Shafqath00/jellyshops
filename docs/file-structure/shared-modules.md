# Shared modules

Code that more than one app consumes.

## `jellyshops/packages/*` (npm workspaces)

| Package | Purpose | Consumed by |
| --- | --- | --- |
| `@jelly/storefront-schema` | Zod schemas/types for storefront documents, sections, runtime snapshots, rich text. | frontend, backend (packed) |
| `@jelly/storefront-registry` | Section and block definitions, editor controls, starter packs (`v4-starter-packs.ts`), plain-language labels (`labels.ts`). | frontend, backend (packed) |
| `@jelly/storefront-themes` | Theme definitions (`jelly-signature` = Jelly Minimal, `jelly-avenue`), token resolvers, fonts. | frontend, backend (packed) |
| `@jelly/storefront-renderer` | Section renderers; one renderer for editor preview and live store. | frontend only |
| `@jelly/storefront-ui` | Container, product card, button. | frontend only |

File-level maps for each package are in [frontend-file-map](frontend-file-map.md) (paths start with `jellyshops/packages/`).

## How the backend gets them

The backend depends on tarballs (`backend/jelly-storefront-schema-0.1.0.tgz`, `-registry-`, `-themes-`), not on the workspace:

```bash
node scripts/prepare-shared-packages.mjs        # rebuild and repack
cd backend && rm -rf node_modules/@jelly && npm install
```

npm does not replace a tarball whose version is unchanged, so skipping the reinstall leaves the backend running stale packages silently. CI runs `node scripts/prepare-shared-packages.mjs --check` to catch drift. Two extra tarballs (`*-v4-launch-ready-*`) are present in `backend/`; neither `backend/package.json` nor `scripts/prepare-shared-packages.mjs` mentions them, so they look like leftovers (confirm before deleting).

Never bump a theme `version` or change a theme `id`: published stores pin them and fall back to the default theme on mismatch.

## Shared backend utilities

| Path | Used for |
| --- | --- |
| `backend/src/http/errors.ts` | `ApiError` and HTTP mapping used by every module. |
| `backend/src/database/*` | Pool and transaction helpers (`SqlExecutor`, `CommerceDatabase`). |
| `backend/src/auth/permissions.ts` | Role → permission table and `hasStorePermission`. |
| `backend/src/tenants/store-context.ts` | `createStoreRequestContext`. |

## Shared frontend utilities

| Path | Used for |
| --- | --- |
| `jellyshops/src/lib/utils.ts` | `cn()` class-name helper. |
| `jellyshops/src/lib/domain.ts` | Shared domain types and helpers (orders, products, categories). |
| `jellyshops/src/components/ui/*` | shadcn-style primitives (button, card, dialog, input, label, sheet, ...). |
| `jellyshops/src/features/admin/api.ts` | Authenticated admin fetch helper used by admin features. |
