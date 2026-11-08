# Store creation and publishing

Code: `backend/src/storefront/{workspace,compiler,publication,runtime,starter,context}/`, `backend/src/tenants/`, `jellyshops/src/features/store-editor/components/publish-*.tsx`, `jellyshops/src/features/storefront/`. Tables: `StorefrontWorkspace`, `StorefrontDraft`, `StorefrontTemplate`, `StorefrontTemplateAssignment`, `GlobalSection`, `ThemeConfiguration`, `NavigationMenu`, `StorefrontPublication`, `Store`.

## Store creation

`POST /api/stores` (`tenants/routes.ts`) creates the store and the signed-in merchant's OWNER membership; the frontend drives it from `app/onboarding` and `app/admin/onboarding`. `GET /api/stores` and `GET /api/me` list the merchant's stores and roles for `AuthProvider`. A starter theme is installed with `POST /api/stores/:storeId/storefront/starters/:starterId/install` (`StorefrontStarterInstallationService.install`, which also seeds draft information pages with editable copy).

## Draft → preview → publish

| Step | Endpoint | Service |
| --- | --- | --- |
| Read the mutable draft | `GET .../storefront/workspace`, `GET .../storefront/draft` | `DefaultStorefrontWorkspaceApi` |
| Edit templates, global sections, menus, theme settings, assignments | `.../storefront/templates`, `global-sections`, `menus`, `theme-settings`, `assignments/...` | workspace services, optimistic revisions (`workspace/concurrency.ts`) |
| Validate | `POST .../storefront/validate` | `StorefrontCompilationService.compile` |
| Preview compile (not saved) | `POST .../storefront/preview/compile` | `StorefrontCompilationService.compile` |
| Publish | `POST .../storefront/publish` (permission `storefront:publish`) | `CompiledStorefrontPublicationService.publish(storeId, expectedGeneration, idempotencyKey, actorUserId)` |
| Serve the live store | `GET /api/public/storefronts/:slug`, `GET .../storefront/public`, `/api/public/stores/:storeId/storefront/context/*` | `StorefrontRuntimeService.getPublishedSnapshot` |

Rules:

- The workspace carries a **generation** number; saves and publish carry the generation the editor last saw and fail when it is stale, so two tabs cannot overwrite each other.
- Publishing compiles the draft (registry, bindings, references and context validators in `compiler/`), writes an **immutable** `StorefrontPublication` row and moves the store's active-publication pointer. The live store never changes until Publish. The runtime keeps a process-local cache that is rebuilt from SQL on restart.
- Publication is idempotent by `idempotencyKey`.
- Published stores pin the theme `id` and `version`; changing either makes them silently fall back to the default theme.

## Frontend

`publish-controls.tsx` runs validate → compile preview → publish and shows diagnostics (`publish-diagnostics.tsx`). Storefront routes read the active publication through `features/storefront/public-storefront-api.ts` and render it with the shared renderer.
