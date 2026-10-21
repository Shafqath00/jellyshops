# Theme editor

Entry: `jellyshops/src/app/admin/online-store/editor/page.tsx` (about 1,300 lines; the V4 editor page). Supporting code: `jellyshops/src/features/store-editor/`. Backend: `backend/src/storefront/workspace/`. Publish flow: [publishing](publishing.md).

## Frontend structure

| Path (under `jellyshops/src/features/store-editor`) | Role |
| --- | --- |
| `api/client.ts`, `api/types.ts` | Typed calls to `/api/stores/:storeId/storefront/*` (workspace, templates, global sections, menus, theme settings, assignments, validate, preview compile, publish). |
| `model/` | Editor document model: `commands.ts` (add/move/remove/update sections and blocks), `history.ts` (undo/redo), `selection.ts`, `types.ts` (`page-commands.test.ts` exists but there is no `page-commands.ts`; the test file is an orphan). |
| `state/reducer.ts` | Editor state transitions. |
| `state/autosave-controller.ts` | `createAutosaveController({ save, onStatus, delayMs = 700 })`: debounced saves per dirty resource; statuses `dirty`/`saving`/`saved`/`error`; `flush`, `retry`, `dispose`. |
| `components/` | `editor-toolbar`, `preview-canvas`, `storefront-preview-frame`, `section-library`, `page-hierarchy`, `template-hierarchy`, `template-resource-selector`, `global-section-panel`, `publish-controls`, `publish-diagnostics`, `editor-panel-navigation`, `dynamic-source-picker`. |
| `components/inspector/` | `control-renderer.tsx` (renders a setting control from the registry's control definition), `theme-inspector.tsx` (theme settings panel). |
| `components/controls/` | Currently only `image-control.tsx`. |
| `editor-store.ts`, `editor-navigation.ts`, `preview-context.ts`, `template-layout.ts`, `theme-pack-workspace.ts` | Store/model glue and preview context helpers. |

`components/editor-shell.tsx` has a test but no importer outside tests; the live editor is the page file. See the [dead-code report](../reports/dead-code-and-structure.md).

## How an edit travels

1. The inspector control (from `storefront-registry` controls) emits a setting change.
2. A command in `model/commands.ts` updates the in-memory document and history.
3. `autosave-controller` debounces and calls the API client; the request carries the resource's expected revision. A conflict surfaces as a stale-generation error (`workspace/concurrency.ts`, mapped in `http/errors.ts`).
4. The preview canvas renders the same document with `storefront-renderer` (`withStoreIdentity()` supplies store name and logo).
5. Publish controls validate, compile a preview and publish ([publishing](publishing.md)).

## Labels

Plain-language names for pages, sections and settings come from `jellyshops/packages/storefront-registry/src/labels.ts`; use them in UI instead of internal identifiers.

## Constraints

- The full-screen editor is portalled to `<body>`; the admin shell's fade-in creates a stacking context that would otherwise trap it under the admin header.
- Editor permissions: `storefront:view` to open, `storefront:edit` to change, `storefront:publish` to publish (`developer:*` for developer-only tools).
