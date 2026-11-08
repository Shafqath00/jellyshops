# Jellyshops backend architecture

This is a developer guide to the backend as it exists today. It explains the request path, the store-isolation rules, the V4 storefront pipeline, and how the Next.js frontend uses the APIs.

## Big picture

The application is a multi-tenant commerce system. A **store** is the tenant boundary. Every authenticated merchant request is authorized for a store and every SQL repository query receives a `storeId`.

```text
Next.js admin/editor or public storefront
        │ HTTP + bearer token (merchant APIs)
        ▼
backend/src/app.ts  ── Express route composition
        │
        ├── tenant/auth middleware
        ├── catalog, content, media, custom data
        ├── storefront workspace + compiler + publication runtime
        └── checkout/orders/Stripe
        ▼
PostgreSQL / PGlite-compatible SQL boundary
```

The backend is deliberately arranged as `route → service → repository → SQL`. Routes handle HTTP and permissions, services implement rules, repositories own database reads/writes. Tests can replace these dependencies without replacing application routing.

## Starting points

| File | Role |
| --- | --- |
| `backend/src/server.ts` | Local server process entry point. |
| `backend/src/functions.ts` | Functions/serverless entry point. |
| `backend/src/app.ts` | Main Express application factory and dependency composition root. |
| `backend/src/config.ts` | Environment/configuration parsing. |
| `backend/src/database/client.ts` | Database pool/client creation. |
| `backend/src/http/errors.ts` | Maps domain errors, including stale workspace generations, into HTTP responses. |

`createApp(...)` in `backend/src/app.ts` is the most important backend file to read first. It accepts injectable dependencies for tests, then creates concrete SQL-backed services when a pool is configured. HTTP routes do not individually construct compiler or publication dependencies.

## Tenant isolation and authorization

Relevant files:

- `backend/src/auth/middleware.ts` authenticates the bearer token.
- `backend/src/auth/permissions.ts` describes permissions.
- `backend/src/tenants/store-context.ts` constructs request store context and verifies that the principal may access the requested store.
- `backend/src/tenants/postgres-repository.ts` reads tenant/store records from SQL.

Merchant routes are mounted under `/api/stores/:storeId/...`. They use `requireStorePermission(...)`. The checked `storeId` is passed to services and repositories; it is never trusted merely because a client supplied it in JSON.

Public routes have a separate boundary and only return public/published data.

## Core domains

### Catalog

Files: `backend/src/catalog/`

`CatalogService` (`service.ts`) is the catalog application service. `CatalogPostgresRepository` (`postgres-repository.ts`) is the concrete SQL adapter. `types.ts` defines products, variants, inventory, collections, and input contracts. `routes.ts` exposes the merchant catalog endpoints.

Important behavior:

- All product, variant, media, and inventory SQL joins include `storeId`.
- `GET /api/stores/:storeId/catalog/products/:productId` is a full, current-store Product detail lookup.
- A Product detail includes media, options, variants, `priceMinor`, `compareAtPriceMinor`, SKU, inventory/availability, vendor, and description.
- `listProducts` is intentionally a list endpoint; consumers that need variants/options should ask for selected Product detail instead of widening every list response.
- `public-store.ts` and public catalog reader methods apply public visibility rules.

The frontend editor uses this exact detail endpoint after selecting a Product from its lightweight selector. It does not copy Product facts into the storefront workspace or publication snapshot.

### Content

Files: `backend/src/content/`

`ContentService` and `SqlContentRepository` manage pages, blogs, and articles. Content lifecycle is explicit: draft versus published state is not inferred from the storefront publication. The public storefront context repository only returns same-store published content.

### Commerce and Stripe

Files: `backend/src/commerce/` and `backend/src/stripe/`

Commerce contains cart/checkout, inventory reservation, payment intent, fulfilment, refunds, order management, and background reservation sweeping. `CommerceRepository` owns transactional SQL operations. `CheckoutService` reads authoritative catalog variant data before charging or reserving inventory; the browser never supplies the trusted price.

Stripe account onboarding, webhooks, and payment gateways are separate adapters under `backend/src/stripe/`. `app.ts` only composes these services when Stripe and SQL configuration are available.

### Media, custom data, and dynamic sources

- `backend/src/media/`: media records and local/Supabase storage adapters.
- `backend/src/custom-data/`: metafields/metaobjects and their service/routes.
- `backend/src/dynamic-sources/`: declares and validates dynamic sources that storefront settings can bind to.

These are distinct from storefront layout. Layout can contain a binding; the dynamic data remains outside the compiled theme snapshot.

## Storefront V4 architecture

The V4 storefront has four layers with intentionally separate responsibilities.

```text
Normalized editable workspace
        │
        ▼
SQL workspace data source
        │ raw persisted rows, no repair/normalization
        ▼
LocalV4WorkspaceReader
        │ normalize + generation consistency check
        ▼
StorefrontCompilationInput → compiler → immutable compiled snapshot
        │
        ▼
publication repository → current-publication pointer → public runtime reader
```

### 1. Editable workspace

Files: `backend/src/storefront/workspace/`

The workspace stores template layout and theme configuration rather than live catalog data. Its principal records are:

- `StorefrontWorkspace`: generation counter for the aggregate.
- `StorefrontTemplate`: page-type layouts.
- `GlobalSection`: shared announcement/header/footer-style sections.
- `NavigationMenu`.
- `ThemeConfiguration`.
- `StorefrontTemplateAssignment`: resource/template assignment.
- preset records.

The workspace services are scoped by resource type:

| File | Responsibility |
| --- | --- |
| `template-service.ts` | Create/update/clone template layouts with revisions. |
| `global-section-service.ts` | Global reusable sections. |
| `menu-service.ts` | Navigation menus. |
| `theme-service.ts` | Theme settings/configuration. |
| `assignment-service.ts` | Assign templates to resources/defaults. |
| `mutation-runner.ts` | Coordinates mutations and workspace generation changes. |
| `workspace-reader.ts` | Normalized workspace read model. |
| `routes.ts` | Merchant storefront-workspace HTTP API. |

Template revision protects a single record against lost writes. Workspace **generation** protects compilation and publication against aggregate changes across templates, global sections, menus, assignments, or theme settings.

### 2. SQL adapter and normalized reader

Files:

- `backend/src/storefront/sql-v4-workspace-data-source.ts`
- `backend/src/storefront/local-v4-workspace-reader.ts`

`createSqlV4WorkspaceDataSource(sql, resourceIds)` queries only these V4 tables for the requested store:

```text
StorefrontWorkspace
StorefrontTemplate
GlobalSection
NavigationMenu
ThemeConfiguration
StorefrontTemplateAssignment
```

The compiler resource-ID loader also queries current-store IDs from:

```text
Product, Collection, StorePage, Blog, Article
```

Every query has `WHERE "storeId" = $1`. This means Store B templates, menus, assignments, catalog IDs, or content IDs cannot be compiled into Store A.

The SQL adapter returns persisted state as-is. It does not silently fix malformed layout JSON, missing collections, or invalid references. That is important: a validation/compiler diagnostic must describe what was actually saved.

`LocalV4WorkspaceReader` owns normalization. It converts nullable/absent persisted collections to arrays and maps SQL records to `StorefrontCompilationInput`. It also protects against a mixed aggregate:

```text
read generation before
→ read templates/globals/menus/theme/assignments/resource IDs in parallel
→ read generation after
→ generation changed? throw WorkspaceGenerationConflictError
```

The caller must retry after a stale-generation conflict; it never compiles half of generation N and half of N+1.

### 3. Compiler

Files: `backend/src/storefront/compiler/`

`StorefrontCompilationService` takes a `CompilationInputLoader`, registry, dynamic-source resolver, compiler version, and registry-manifest hash. It validates the input and produces a `RuntimeStorefrontSnapshotV4` only when diagnostics have no blocking errors.

Key files:

| File | Purpose |
| --- | --- |
| `compiler.ts` | Coordinates compile/diagnostics. |
| `service.ts` | API-facing compilation service and `CompilationInputLoader` contract. |
| `validate-registry.ts` | Checks sections/blocks/settings against the registry. |
| `validate-references.ts` | Checks menu, assignment, resource, and global references. |
| `validate-bindings.ts` | Checks dynamic setting bindings. |
| `dependency-graph.ts` | Records snapshot dependencies. |
| `snapshot.ts` | Constructs runtime snapshot output. |

`backend/src/storefront/local-v4-compilation.ts` is the concrete local composition point:

```text
SQL V4 workspace data source
→ LocalV4WorkspaceReader
→ StorefrontCompilationService
```

It supplies the shared storefront registry validator and supported local dynamic resource field types. `app.ts` creates this service once when `storefrontSql` exists, and both Validate, Preview compilation, and Publish receive that same dependency.

### 4. Validate, Preview, Publish, and runtime

Compiler routes are in `backend/src/storefront/compiler/routes.ts`:

- `POST .../storefront/validate`: compiles/validates without writing a publication.
- `POST .../storefront/preview/compile`: compiles current persisted draft without publishing.

Publication files are in `backend/src/storefront/publication/`:

- `service.ts`: `CompiledStorefrontPublicationService` compiles, saves immutable output, then activates it.
- `sql-repository.ts`: SQL persistence for compiled publications and current pointer.
- `routes.ts`: publish HTTP endpoint, idempotency key handling, and permission boundary.
- `repository.ts`: publication repository contracts.

The publish operation is:

```text
idempotency lookup
→ compile at expected workspace generation
→ save immutable snapshot + dependency metadata
→ atomically activate its current-publication pointer
```

If the same idempotency key is used again, the existing publication is reused/re-activated instead of producing a second publication.

The public runtime is in `backend/src/storefront/runtime/`:

- `service.ts` reads the current publication pointer then its immutable snapshot.
- `cache.ts` caches immutable snapshots by publication ID.

The runtime validates `snapshot.storeId === storeId` before returning it. An editable workspace is never served as a public snapshot.

## Frontend relationship

The Next.js app lives under `jellyshops/`. It calls the backend with `StoreEditorApi`:

- `jellyshops/src/features/store-editor/api/client.ts`: authenticated backend client.
- `jellyshops/src/app/admin/online-store/editor/page.tsx`: editor orchestration.
- `jellyshops/src/features/store-editor/preview-context.ts`: turns selected live resources into renderer page context.
- `jellyshops/src/features/storefront/product-presentation.ts`: shared Product presentation contract for editor preview and public Product page.
- `jellyshops/src/app/[storeSlug]/products/[productSlug]/page.tsx`: public Product route; it supplies live Product data and delegates cart writes to the existing repository.

For Product preview, the flow is:

```text
lightweight Product selector
→ selected product ID
→ StoreEditorApi.getProduct(currentStoreId, productId)
→ catalogProductToProduct adapter
→ createProductPresentationContext
→ shared gallery/info/options/purchase/description/related sections
```

Selected options and quantity are React runtime state. The preview injects a safe delegated cart action that reports cart mutations are disabled; renderer code never contains cart repository logic. The public route injects its real cart action through the same contract.

## Tests and local verification

Tests are colocated with their module and normally use Vitest. PGlite integration harnesses are under `backend/test/integration/`.

Useful backend test groups:

- `storefront/sql-v4-workspace-data-source.test.ts`: SQL table reads, optional state, malformed data pass-through, store isolation.
- `storefront/local-v4-workspace-reader.test.ts`: normalization and before/after generation protection.
- `app.local-v4.test.ts`: PGlite end-to-end Validate, Preview, Publish, and public snapshot composition.
- `storefront/publication/*.test.ts`: immutable storage, activation, idempotency.
- `catalog/postgres-repository.test.ts` and `catalog/service.test.ts`: same-store catalog reads and isolation.

Run TypeScript checks and focused tests from the relevant package directory. Treat existing unrelated repository failures separately; do not hide them by changing production behavior.

## Practical rules for future changes

1. Add a route only through `app.ts` composition and use the appropriate permission middleware.
2. Put authorization and store scoping at the service/repository boundary; include `storeId` in every tenant-owned query.
3. Keep SQL adapters literal. Put normalization in the normalized reader/service that owns that contract.
4. Keep live catalog/content/price/stock data outside compiled storefront snapshots.
5. Keep snapshot data immutable; publish a new snapshot rather than editing a public one.
6. Use workspace generation for aggregate consistency and record revision for individual editable records.
7. Add PGlite coverage whenever a new SQL adapter or multi-table behavior is introduced.
8. Do not put route-specific compiler construction in HTTP handlers. Validate, Preview, and Publish must share the same compilation path.

