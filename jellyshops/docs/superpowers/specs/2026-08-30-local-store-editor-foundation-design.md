# Local Store Editor Foundation Design

## Goal

Add a local-first, schema-driven Store Editor foundation to the Jelly Shop MVP. Merchants can compose a store design from registered content sections, preview it with the same renderer used by the storefront, choose from five compatible themes, and publish immutable local snapshots.

## Scope

The foundation introduces shared schema, registry, theme, and renderer packages plus a minimal editor shell. It deliberately keeps the MVP's local-first model:

- Existing `src/lib/repository.ts` remains the persistence boundary.
- Store designs persist through the existing versioned local-storage data model.
- Existing mock asset and commerce providers remain in use.
- No Express server, Prisma, PostgreSQL, Firebase, Cloud Storage, signed uploads, or remote API routes are added.

The current product catalog, cart, checkout, customers, orders, and storefront route behavior remain unchanged except that storefront pages may consume a published design through the shared renderer once a snapshot exists.

## Architecture

The root becomes an npm-workspaces repository while retaining the existing Next.js application at the root. New packages are intentionally framework-neutral where possible:

- `@jelly/storefront-schema` owns the versioned Store Design document, Zod validation, defaults, and migration entry point.
- `@jelly/storefront-registry` owns section and block definitions, editor control metadata, default sections, and registry validation.
- `@jelly/storefront-themes` owns the five semantic themes: `minimal`, `classic`, `bold`, `elegant`, and `playful`.
- `@jelly/storefront-ui` owns small shared presentational components used by the renderer.
- `@jelly/storefront-renderer` maps an approved Store Design document into React, applies semantic theme tokens, and has distinct preview and published failure behavior.
- The root app owns editor state, local persistence, routing, and integrations with the existing commerce domain.

The root app and the renderer consume package source through npm workspaces. There is no second storefront renderer.

## Store Design Document

Each design has a `schemaVersion`, `themeId`, global settings, and page documents. A page is an ordered list of sections; a section contains ordered blocks. Node IDs are stable across edits and theme changes.

The initial document supports `header`, `home`, `product`, `collection`, and `footer` page surfaces. Product and collection templates retain their mandatory commerce sections. The schema accepts only the five V1 themes and validates responsive values separately from base settings.

The migration API always validates its output and is structured as a version-to-version loop. V1 is a validated pass-through, which allows future document migrations without changing consumers.

## Registry and Themes

The registry is the canonical allow-list for sections, blocks, controls, supported page types, defaults, block limits, and responsive fields. The editor does not invent arbitrary HTML, CSS, or JavaScript.

All five themes support the same registry capabilities. A theme supplies semantic tokens and visual variant names only; switching themes modifies `themeId` without rewriting sections, blocks, settings, or IDs. Renderer token resolution produces a serializable CSS-variable map.

## Rendering and Failure Handling

`StorefrontRenderer` receives a design document, a theme, a rendering mode, and existing commerce/asset adapters. Both the editor preview and public storefront use this component.

- In `preview` mode, an unknown or failed section becomes a clear non-destructive placeholder.
- In `published` mode, an unknown or failed section is omitted and may be reported through a callback.
- Merchant content is structured and validated; the renderer never executes raw merchant HTML, CSS, or JavaScript.

The renderer uses responsive CSS rather than client-side viewport branching so public output remains deterministic.

## Local Draft and Publication Model

The local repository stores one design record per store with:

- `draftDocument` and integer `draftRevision` for editable work.
- `currentPublicationId` for the live snapshot pointer.
- an append-only `publications` collection whose documents are immutable snapshots.

Saving applies a local expected-revision check. A stale write is rejected with a typed conflict result rather than overwriting newer data. Publishing copies the current draft into a new publication row and updates only `currentPublicationId`. Public routes read only that snapshot; they never fall back to the draft.

## Editor Foundation UX

The initial editor route supplies a page/section outline, section selection, theme selection, desktop/mobile preview controls, basic section add/remove/reorder controls, and a shared-renderer preview. It shows local save state and an explicit publish action. Media library, product/collection pickers, advanced controls, rollback UI, and dedicated Store Editor E2E journeys are later milestones.

## Testing

Work follows test-driven development. The foundation test suite covers:

- schema defaults, invalid documents, and migrations;
- registry page/block restrictions and responsive-field allow-lists;
- theme compatibility and content/ID preservation across theme changes;
- shared renderer output, theme CSS variables, commerce-provider interaction, and safe fallbacks;
- local draft revision conflicts and strict draft/publication separation;
- editor state operations and basic UI behavior.

Existing unit tests, typecheck, lint, build, and the current Playwright First Order journey must remain green. Store Editor end-to-end coverage is deferred until the editor foundation is functional.

## Non-Goals

This foundation does not add real authentication, payments, server-side persistence, external asset uploads, custom merchant code, arbitrary rich HTML, GraphQL, Redis, microservices, Kubernetes, CRDT collaboration, or a duplicate storefront renderer.
