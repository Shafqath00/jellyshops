# V4 Storefront Runtime Spine — Milestone 1

**Date:** 2026-09-21  
**Status:** approved design; implementation plan pending review  
**Scope:** converge public Home and Product rendering, plus their global layout and editor preview, onto the existing V4 storefront workspace/compiler/publication contracts.

## Goal

Jelly Shop already persists normalized V4 templates, global sections, assignments, theme configuration, draft workspace generations, and immutable published snapshots. This milestone makes that model authoritative at runtime for Home and Product. A merchant can customize and publish a Home or Product template and global Header/Footer, preview the draft against a real product, and see the coherent published snapshot on public routes.

The system must not introduce another theme engine, duplicate workspace persistence, or copy product values into template JSON. Checkout remains platform-owned and outside the normal template runtime.

## Current runtime flow

```text
V4 workspace -> compiler -> V4 publication snapshot
                                  |
                                  +-> resource-loader resolves template sections
                                  +-> PublishedRuntimeStorefront renders sections

legacy public route -> StorefrontFrame / route-specific page component
                   -> themed shell and bespoke ProductPage presentation
```

The workspace/compiler side is already normalized:

- `packages/storefront-schema/src/runtime-v4.ts` defines templates, template defaults, assignments, global sections, menus, and immutable snapshot shape.
- `backend/src/storefront/workspace/*` owns revisioned templates, global sections, assignments, and theme settings.
- `backend/src/storefront/compiler/*` validates and produces one V4 snapshot per publication.
- `packages/storefront-registry` owns section and block capabilities and validation.
- `src/features/store-editor` edits draft workspace records and obtains a draft compiled snapshot.

The gap is public/runtime composition. `src/features/storefront/resource-loader.ts` resolves a V4 template and expands its placements, but its route result does not yet contain a typed page context or global layout regions. `PublishedRuntimeStorefront` renders only template sections. Meanwhile public route components and `StorefrontFrame` retain independent legacy shell/page presentation decisions.

## Target runtime flow

```text
published snapshot OR draft compiled snapshot
                 ↓
resolve route and typed PageContext
                 ↓
resolve assigned/default V4 template
                 ↓
load live public resource data (when required)
                 ↓
resolve named V4 global-layout regions
                 ↓
render global header -> ordered template sections -> global footer
                 ↓
section registry and selected theme presentation
```

Public routes only identify the route and supply the live resource reader. Preview selects its snapshot source and representative resource, then calls the same resolver/renderer. The renderer does not fetch repositories or mutate cart/commerce state.

## Authoritative and compatibility modules

| Concern | Authoritative V4 module | Compatibility-only boundary |
| --- | --- | --- |
| Snapshot shape | `packages/storefront-schema/src/runtime-v4.ts` | V3 `storefront-v2.ts` migration/normalization |
| Template/default/assignment resolution | `src/features/storefront/resource-loader.ts` | legacy route-specific page selection |
| Global sections | V4 snapshot `globalSections` and template placements | V3 `regions.header/footer` |
| Rendering | `packages/storefront-renderer` plus `PublishedRuntimeStorefront` | `StorefrontRenderer` V3 branch and `StorefrontFrame` legacy shell |
| Draft preview | workspace compiler preview snapshot | old V3 editor `PreviewCanvas` |
| Publication | existing compiler/publication service | no new persistence model |

V3 documents remain accepted only at `loadPublicStorefrontPublication` and the existing V3 renderer branch. New V4 page types will not be required to support V3 behavior.

## Page context and route resolution

The runtime will introduce a serializable, typed context at the existing resource-loader boundary:

```ts
type StorefrontPageContext =
  | { pageType: "home"; resource: null }
  | { pageType: "product"; resource: PublicStorefrontResource }
  | { pageType: "collection" | "page" | "blog" | "article" | "search" | "cart"; resource: PublicStorefrontResource | null };
```

Milestone 1 resolves only `home` and `product` in public routes. Product context is loaded from the canonical public resource reader at request time. Product title, price, variants, and inventory therefore remain live commerce data. Templates can carry typed dynamic references but cannot embed or modify those records.

The existing deterministic algorithm remains centralized:

1. Home uses `templateDefaults.home`.
2. A product loads by public handle and visibility.
3. Its product assignment wins when present; otherwise `templateDefaults.product` is used.
4. Missing, mismatched, or nonexistent templates resolve to the safe not-found/fallback result.

Future page types add a route-context resolver, a default/assignment mapping where applicable, and registry page compatibility. They do not add a page-specific theme renderer.

## Global layout resolution

V4 global sections stay independent records and are referenced from template layout placements. This milestone adds named layout-region resolution, without cloning sections into templates:

- `announcement` — optional global announcement-area placements;
- `header` — optional global header/navigation/menu placements;
- `footer` — optional global footer placements;
- `template` — the page template’s ordered placements.

The resolver expands global references from the snapshot and preserves ordering/enabled state. Header/footer/global sections wrap every V4 Home and Product render. Menus are supplied through the public navigation/context contract, not copied into page templates.

## Renderer boundary

The shared runtime renderer receives a resolved `StorefrontPageContext`, `RuntimeTemplateV4`, named layout sections, theme information, and a commerce/resource presentation provider. It only renders. Registry section implementations receive page context through the existing renderer context/provider rather than route-specific React props.

The Product template’s product-facing section reads the current `PageContext.product` values. Generic sections continue to use the commerce provider. This is the sole V4 contract extension required for Milestone 1: `PageContext` and named layout regions must be added to the frontend resolver/renderer interfaces. No database, Prisma, workspace-record, compiler-publication, or checkout contract change is required.

## Draft, preview, and published flows

```text
editor workspace records -> existing /preview/compile -> draft V4 snapshot
                         -> chosen valid product resource -> shared resolver/renderer

publish -> existing validated compiler -> immutable V4 publication -> current pointer swap
public request -> /storefront/public -> published V4 snapshot -> shared resolver/renderer
```

Draft edits never affect the public endpoint. The editor resource selector continues using live catalog options and must reject/fallback gracefully when the selected product disappears or is no longer visible. Publish retains expected-generation checking and atomic publication/pointer semantics.

## Migration and fallback

No destructive migration is required. V4-compatible publications take the new runtime path. `loadPublicStorefrontPublication` continues parsing old documents with `migrateStorefrontDocument`; those documents render through the pre-existing V3 `StorefrontRenderer` path. The compatibility decision occurs once at publication load, never inside the V4 resolver.

## Implementation phases

1. Extend resource-loader output with `PageContext` and named global-layout expansion; unit-test deterministic Home/Product resolution.
2. Add one V4 composition renderer that renders global layout and template sections with page context.
3. Migrate public Home to that composition renderer when a V4 publication is loaded.
4. Migrate public Product to the same path using live product/resource context and assignments/defaults.
5. Point the V4 editor preview at the same composition renderer and its selected valid product context.
6. Leave V3 frame/routes as explicit compatibility fallback; add integration tests and remove only dead duplicated V4 decisions.

Every phase must leave the TypeScript build and affected test suite runnable.

## Expected files

- `jellyshops/src/features/storefront/resource-loader.ts` and tests
- `jellyshops/src/features/storefront/storefront-page.tsx` and tests
- `jellyshops/packages/storefront-renderer/src/{types,runtime-context,storefront-renderer}.tsx` and tests
- `jellyshops/src/app/[storeSlug]/page.tsx`
- `jellyshops/src/app/[storeSlug]/products/[productSlug]/page.tsx`
- `jellyshops/src/app/admin/online-store/editor/page.tsx`
- `jellyshops/src/features/store-editor/components/preview-canvas.tsx` only if needed to use the V4 composition boundary
- targeted registry/section implementation files for product-context consumption
- public-storefront route and renderer integration tests

Backend workspace/compiler/publication files are intentionally not expected to change unless testing exposes a concrete contract gap.

## Test plan

- resolver: Home default resolution; Product assignment precedence; Product default fallback; missing/mismatched template safe failure; region ordering and global expansion;
- renderer integration: disabled sections omit; settings retain values; global header/footer wrap Home and Product; product sections see live context;
- snapshot behavior: draft preview consumes its compiled snapshot; public runtime consumes only the publication; one publish changes the public result coherently;
- compatibility: a V3 document still loads and renders via the legacy boundary;
- verification: focused Vitest suites, TypeScript no-emit, lint, and production build.

## Risks and mitigations

- **Two existing rendering families:** preserve V3 only behind publication classification; do not pass V3 documents into V4 code.
- **Legacy shell owns interactive cart state:** retain cart actions in core, while render composition owns visual placement; avoid moving checkout/payment behavior into themes.
- **Public resource DTO mismatch:** adapt at the public resource reader boundary and test a real product route before broadening page types.
- **Editor preview selection staleness:** validate against the live catalog/resource reader and fall back to a visible product or an explicit empty preview state.

## Next milestone

Add Collection, Page, Search, Cart, Blog, and Article by registering their route-context loaders and permitted section schemas against this same composition path. Checkout branding/extensions remains a separately constrained platform surface.
