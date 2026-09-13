# Jelly Shop Phase 1 Online Store Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Phase 1 Jelly Shop Online Store platform: tenant-safe catalog/content/custom-data foundations, normalized storefront workspace, typed dynamic sources, compiler-driven immutable publishing, editor V2, React/TypeScript Theme SDK, and secure developer extensions.

**Architecture:** Keep the current package boundaries and immutable-publication pattern, but replace the monolithic editable storefront document with normalized store-owned authoring resources. Compile those resources into a V4 immutable runtime snapshot; resolve live catalog/content/custom-data values at request time; render built-in sections natively and untrusted store code through a sandbox/capability bridge.

**Tech Stack:** TypeScript, Node.js, Express 5, Prisma 7/PostgreSQL, Zod 4, Vitest, PGlite integration tests, Next.js/React, Playwright, dnd-kit, existing `@jelly/storefront-*` packages, plus esbuild for developer artifacts and Monaco for the browser editor when Milestone 8 begins.

**Spec:** `docs/superpowers/specs/2026-09-13-jelly-shop-phase-1-online-store-platform-design.md`

## Global Constraints

- Read the approved spec before starting any task.
- Before writing or modifying Next.js app/router code, read the relevant installed guide under `jellyshops/node_modules/next/dist/docs/` as required by `jellyshops/AGENTS.md`.
- Use TDD: write a failing focused test, run it, implement the smallest passing change, rerun focused tests, then run the affected package/backend suite.
- All merchant-owned persistence must be scoped by `storeId`; knowing an object ID is never authorization.
- Keep one active theme per store in Phase 1. Do not add a multi-theme library, theme marketplace, or custom-domain product work.
- Keep product title, price, inventory, media, metafield values, and metaobject entry values live. Do not freeze them into storefront publications.
- Keep dynamic bindings declarative and structured. Do not introduce arbitrary expressions, Liquid-like evaluation, or merchant JavaScript in bindings.
- Keep checkout/account privileged logic isolated from arbitrary storefront theme code.
- Never execute store-uploaded TypeScript/React inside the privileged admin origin, Next.js server process, or Express backend process.
- Preserve V3 storefronts until an explicit successful V4 publish; migration work must not silently switch the live publication.
- The current storefront service's optimistic-concurrency and atomic live-publication pointer principles are retained, but generalized to resource revisions plus workspace generation.
- Milestone 4 concurrency is a first-class component. `WorkspaceMutationCoordinator` and revision errors must have focused unit/integration tests before template/menu/global-section repositories depend on them.
- Do not redesign editor UI ahead of the catalog/custom-data/workspace/compiler contracts.
- After every milestone, run `cd backend && npm test && npm run typecheck` for backend-affecting work and `cd jellyshops && npm test && npm run typecheck && npm run lint` for frontend/package-affecting work.

---

## File Structure Map

The plan deliberately introduces focused modules rather than growing `backend/src/app.ts`, `backend/src/storefront/service.ts`, or `jellyshops/src/features/store-editor/components/page-hierarchy.tsx` into god-files.

### Backend domains

```text
backend/src/
  auth/
    permissions.ts                 role → capability mapping
    middleware.ts                  authentication + capability enforcement
  tenants/
    store-context.ts               tenant-safe request context
  audit/
    types.ts
    repository.ts
    prisma-audit-repository.ts
    service.ts
  catalog/
    types.ts                       canonical public/domain contracts
    repository.ts
    prisma-catalog-repository.ts
    service.ts
    provider-sync.ts               provider-neutral synchronization contract
    routes.ts
  custom-data/
    repository.ts
    prisma-repository.ts
    service.ts
    routes.ts
  dynamic-sources/
    registry.ts
    validator.ts
    resolver.ts
  media/
    storage.ts                     storage interface
    local-media-storage.ts         local adapter
    prisma-media-repository.ts
    service.ts
  storefront/
    workspace/
      types.ts
      concurrency.ts               pure revision/generation rules
      prisma-mutation-coordinator.ts
      repositories/
        template-repository.ts
        global-section-repository.ts
        menu-repository.ts
        theme-repository.ts
        assignment-repository.ts
      service.ts
      routes.ts
    compiler/
      types.ts
      input-loader.ts
      validate-registry.ts
      validate-references.ts
      validate-bindings.ts
      validate-context.ts
      dependency-graph.ts
      snapshot.ts
      compiler.ts
    publication/
      service.ts
      repository.ts
    migration/
      import-v3.ts
    runtime/
      service.ts
      cache.ts
  content/
    repository.ts
    prisma-repository.ts
    service.ts
    routes.ts
  developer/
    repository.ts
    build-service.ts
    import-policy.ts
    routes.ts
```

### Shared packages/frontend

```text
jellyshops/packages/
  storefront-schema/src/
    custom-data.ts
    dynamic-sources.ts
    runtime-v4.ts
    diagnostics.ts
  storefront-sdk/
    package.json
    src/index.ts
    src/controls.ts
    src/section.ts
    src/block.ts
    src/manifest.ts
  storefront-registry/src/
    registry.ts
    types.ts
  storefront-renderer/src/
    runtime-context.ts
    dynamic-values.ts
    section-renderer.tsx
    sandbox/
      protocol.ts
      sandbox-section.tsx
  storefront-themes/
  storefront-ui/

jellyshops/src/features/
  store-editor/
    api/client.ts
    api/types.ts
    state/
    components/
      template-resource-selector.tsx
      template-hierarchy.tsx
      section-library.tsx
      global-section-panel.tsx
      dynamic-source-picker.tsx
      publish-diagnostics.tsx
  storefront/
    public-storefront-api.ts
    storefront-page.tsx
    resource-loader.ts
  navigation/
  content/
  developer-tools/

jellyshops/src/app/admin/
  online-store/editor/page.tsx
  online-store/navigation/page.tsx
  content/pages/page.tsx
  content/blogs/page.tsx
  content/metaobjects/page.tsx
  settings/custom-data/page.tsx
```

---

# Milestone 1 — Tenant, Capability, Audit, and Media Foundations

## Task 1: Replace suffix-based role checks with explicit capability mapping

**Files:**
- Create: `backend/src/auth/permissions.ts`
- Create: `backend/src/auth/permissions.test.ts`
- Modify: `backend/src/auth/types.ts`
- Modify: `backend/src/auth/middleware.ts`
- Modify: `backend/src/auth/middleware.test.ts`
- Modify: `backend/src/tenants/types.ts`
- Modify: `backend/prisma/schema.prisma`
- Add migration under: `backend/prisma/migrations/`

**Interfaces:**
- Produces: `StorePermission`, `ROLE_PERMISSIONS`, `hasStorePermission(principal, storeId, permission)`.
- Produces role `DEVELOPER` while retaining existing roles.
- Later admin/storefront routes consume `requireStorePermission(permission)`.

- [ ] **Step 1: Write permission-matrix tests**

```ts
it("does not let DESIGNER publish or edit developer source", () => {
  expect(roleHasPermission("DESIGNER", "storefront:edit")).toBe(true);
  expect(roleHasPermission("DESIGNER", "storefront:publish")).toBe(false);
  expect(roleHasPermission("DESIGNER", "developer:edit")).toBe(false);
});

it("lets DEVELOPER build but not publish unless mapped explicitly", () => {
  expect(roleHasPermission("DEVELOPER", "developer:build")).toBe(true);
  expect(roleHasPermission("DEVELOPER", "developer:publish")).toBe(false);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `cd backend && npm test -- src/auth/permissions.test.ts`
Expected: FAIL because `roleHasPermission`/`DEVELOPER` do not exist.

- [ ] **Step 3: Implement the explicit permission vocabulary**

```ts
export const storePermissions = [
  "storefront:view", "storefront:edit", "storefront:publish",
  "content:view", "content:edit", "catalog:view", "catalog:edit",
  "navigation:edit", "custom_data:edit", "media:upload", "media:delete",
  "developer:view", "developer:edit", "developer:build", "developer:publish",
  "team:manage", "settings:manage",
] as const;

export type StorePermission = typeof storePermissions[number];
```

Use a fixed `Record<StoreRole, ReadonlySet<StorePermission>>`; remove `permission.endsWith(":write")` authorization logic from middleware.

- [ ] **Step 4: Update auth principal/middleware tests**

Make `MerchantPrincipal` expose numeric `userId` plus `storeRoles`; update Firebase/development auth providers accordingly. Test denied store membership, denied permission, and allowed permission separately.

Run: `cd backend && npm test -- src/auth/permissions.test.ts src/auth/middleware.test.ts src/auth/firebase-auth-provider.test.ts`
Expected: PASS.

- [ ] **Step 5: Generate Prisma client, run typecheck, commit**

Run: `cd backend && npm run prisma:generate && npm run typecheck`
Expected: PASS.

Commit:
```bash
git add backend/src/auth backend/src/tenants/types.ts backend/prisma
git commit -m "feat: add store capability authorization"
```

## Task 2: Introduce explicit tenant-safe store context

**Files:**
- Create: `backend/src/tenants/store-context.ts`
- Create: `backend/src/tenants/store-context.test.ts`
- Modify: `backend/src/auth/middleware.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- Produces `StoreRequestContext { storeId: string; userId: number; role: StoreRole }`.
- Produces `requireStorePermission(permission)` middleware that attaches `request.storeContext` only after membership + permission pass.
- Every new admin repository method accepts `storeId` explicitly.

- [ ] **Step 1: Write store-context tests**

```ts
it("attaches only the requested authorized store", async () => {
  const context = createStoreRequestContext(principal, "store-a", "catalog:edit");
  expect(context.storeId).toBe("store-a");
  expect(context.userId).toBe(7);
});

it("rejects a store id not present in memberships", () => {
  expect(() => createStoreRequestContext(principal, "store-b", "catalog:view"))
    .toThrowError(/cannot access/i);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd backend && npm test -- src/tenants/store-context.test.ts`
Expected: FAIL because the context helper does not exist.

- [ ] **Step 3: Implement context creation and Express request typing**

Add `request.storeContext?: StoreRequestContext`; middleware must derive store ID from route params, never from request body.

- [ ] **Step 4: Update one existing storefront/media route as proof of pattern**

Replace its direct `requireStoreAccess(...)` call with explicit capability middleware and use `request.storeContext!.storeId` in the handler. Do not convert all future routes in this task.

Run: `cd backend && npm test -- src/tenants/store-context.test.ts src/storefront/routes.test.ts src/media/routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/tenants backend/src/auth/middleware.ts backend/src/app.ts backend/src/storefront/routes.ts backend/src/media/routes.ts
git commit -m "refactor: add tenant-safe store request context"
```

## Task 3: Add store audit events

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Add migration under: `backend/prisma/migrations/`
- Create: `backend/src/audit/types.ts`
- Create: `backend/src/audit/repository.ts`
- Create: `backend/src/audit/prisma-audit-repository.ts`
- Create: `backend/src/audit/service.ts`
- Create: `backend/src/audit/prisma-audit-repository.integration.test.ts`

**Interfaces:**
- Produces `AuditService.record(input)`.
- `AuditEvent` fields: `id`, `storeId`, `actorUserId`, `action`, `subjectType`, `subjectId?`, `metadata Json?`, `createdAt`.
- Later publication/custom-data/developer tasks record high-risk events through this service.

- [ ] **Step 1: Add a failing PGlite integration test**

```ts
it("cannot record an audit event for a different store actor context", async () => {
  const event = await repo.create({
    storeId,
    actorUserId: userId,
    action: "STOREFRONT_PUBLISHED",
    subjectType: "StorefrontPublication",
    subjectId: "pub-1",
    metadata: { generation: 9 },
  });
  expect(event.storeId).toBe(storeId);
});
```

Include a FK/tenant test proving an unknown store is rejected.

- [ ] **Step 2: Run integration test and verify failure**

Run: `cd backend && npm run test:integration -- src/audit/prisma-audit-repository.integration.test.ts`
Expected: FAIL because schema/repository are absent.

- [ ] **Step 3: Add Prisma model and repository/service**

Keep audit writes append-only; expose listing later only when a UI needs it. `metadata` must be JSON-safe and may not contain secrets/tokens.

- [ ] **Step 4: Generate client and rerun tests**

Run: `cd backend && npm run prisma:generate && npm run test:integration -- src/audit/prisma-audit-repository.integration.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma backend/src/audit
git commit -m "feat: add store audit event foundation"
```

## Task 4: Separate media metadata from storage implementation

**Files:**
- Create: `backend/src/media/storage.ts`
- Modify: `backend/src/media/local-media-storage.ts`
- Create: `backend/src/media/prisma-media-repository.ts`
- Create: `backend/src/media/repository.ts`
- Modify: `backend/src/media/service.ts`
- Modify: `backend/src/media/types.ts`
- Modify: `backend/src/media/routes.ts`
- Modify: `backend/src/media/routes.test.ts`
- Modify: `backend/prisma/schema.prisma`
- Add migration under: `backend/prisma/migrations/`

**Interfaces:**
- Produces `MediaStorage.put/open/remove` for bytes.
- Produces `MediaRepository.create/get/list/delete` for metadata.
- Merchant settings store `mediaId`, not raw filesystem path.

- [ ] **Step 1: Write service tests using fake storage + fake repository**

Test upload creates metadata, list is store-scoped, delete rejects referenced media, and storage deletion only happens after repository validation.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd backend && npm test -- src/media/service.test.ts src/media/routes.test.ts`
Expected: FAIL until the new interfaces are wired.

- [ ] **Step 3: Introduce `MediaStorage` and Prisma `Media` metadata**

Keep `LocalMediaStorage` as the development byte adapter. Add `Media` fields from the approved spec and a reference-safe deletion method.

- [ ] **Step 4: Wire app dependencies and pass tests**

Run: `cd backend && npm run prisma:generate && npm test -- src/media && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/media backend/src/app.ts backend/prisma
git commit -m "refactor: separate media storage and metadata"
```

**Milestone 1 gate:** backend tests/typecheck pass; explicit permissions are in use; one tenant context pattern is established; audit and media abstractions have database coverage.

---

# Milestone 2 — Canonical Catalog Foundation

## Task 5: Activate product, variant, inventory, collection, and product-media models

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Reference only: `backend/prisma/reference/commerce.prisma`
- Add migration under: `backend/prisma/migrations/`
- Create: `backend/src/catalog/prisma-catalog-repository.integration.test.ts`

**Interfaces:**
- Adds production `Product`, `ProductVariant`, `InventoryLevel`, `Collection`, `CollectionProduct`, and `ProductMedia` records with compound store-scoped constraints.
- Retains `CommerceProvider.NATIVE | SHOPIFY` and `externalId` fields.

- [ ] **Step 1: Write migration/repository integration fixtures first**

Test two stores can use the same product slug while one store cannot duplicate it; cross-store product-media and collection-product references must fail.

- [ ] **Step 2: Run integration test and verify schema failure**

Run: `cd backend && npm run test:integration -- src/catalog/prisma-catalog-repository.integration.test.ts`
Expected: FAIL because active schema lacks catalog tables.

- [ ] **Step 3: Port only storefront-required commerce models from the reference schema**

Include store-scoped unique constraints and indexes. Do not port checkout/order/payment/discount models in this milestone.

- [ ] **Step 4: Generate client, verify migration, pass integration test**

Run: `cd backend && npm run prisma:generate && npm run test:migration && npm run test:integration -- src/catalog/prisma-catalog-repository.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma backend/src/catalog/prisma-catalog-repository.integration.test.ts
git commit -m "feat: activate canonical catalog models"
```

## Task 6: Replace `DemoCatalog` as the production contract

**Files:**
- Replace/expand: `backend/src/catalog/types.ts`
- Create: `backend/src/catalog/repository.ts`
- Create: `backend/src/catalog/prisma-catalog-repository.ts`
- Create: `backend/src/catalog/service.ts`
- Create: `backend/src/catalog/service.test.ts`
- Modify: `backend/src/catalog/demo-catalog-provider.ts`

**Interfaces:**
- Produces `CatalogReader` with `getProduct`, `listProducts`, `getVariant`, `getCollection`, `listCollections`, and `resolveResource`.
- Produces stable Jelly resource IDs; provider IDs remain metadata.
- `DemoCatalogAdapter` implements the same reader only for dev/tests.

- [ ] **Step 1: Write `CatalogReader` service tests**

Test cursor/limit handling, inactive product filtering for public reads, stable IDs, variant price range, and collection membership ordering.

- [ ] **Step 2: Run tests and verify failure**

Run: `cd backend && npm test -- src/catalog/service.test.ts`
Expected: FAIL because canonical interfaces do not exist.

- [ ] **Step 3: Implement canonical types and Prisma repository**

Use explicit public/domain DTO mapping; never return raw Prisma rows from public methods.

- [ ] **Step 4: Adapt demo provider to the same interface**

Remove production dependencies on `DemoCatalog`; keep the deterministic demo products for tests/development.

Run: `cd backend && npm test -- src/catalog && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/catalog
git commit -m "feat: add canonical catalog service"
```

## Task 7: Add tenant-scoped catalog admin/public endpoints and minimum catalog UI

**Files:**
- Modify: `backend/src/catalog/routes.ts`
- Modify: `backend/src/catalog/routes.test.ts`
- Modify: `backend/src/app.ts`
- Create: `jellyshops/src/features/catalog/api.ts`
- Create: `jellyshops/src/features/catalog/api.test.ts`
- Modify: `jellyshops/src/app/admin/products/page.tsx`
- Create: `jellyshops/src/app/admin/products/[productId]/page.tsx`
- Create: `jellyshops/src/app/admin/collections/page.tsx`

**Interfaces:**
- Admin endpoints require `catalog:view`/`catalog:edit`.
- Public catalog endpoints expose sanitized active-resource DTOs only.
- Product editor covers title, description, status, media, variants, price, basic inventory, and collection membership.

- [ ] **Step 1: Read Next.js installed routing/data-fetching docs**

Read the relevant files under `jellyshops/node_modules/next/dist/docs/` before touching `src/app/admin/...`.

- [ ] **Step 2: Write route/client tests**

Backend tests prove Store A cannot read/edit Store B products. Frontend client tests prove authorization header and route shape.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `cd backend && npm test -- src/catalog/routes.test.ts`
Run: `cd jellyshops && npm test -- src/features/catalog/api.test.ts`
Expected: FAIL for missing endpoints/client.

- [ ] **Step 4: Implement endpoints and minimal admin pages**

Keep UI deliberately functional; do not redesign the full admin shell. Use stable Jelly IDs in links and mutations.

- [ ] **Step 5: Run suites and commit**

Run: `cd backend && npm test -- src/catalog && npm run typecheck`
Run: `cd jellyshops && npm test -- src/features/catalog && npm run typecheck && npm run lint`
Expected: PASS.

Commit:
```bash
git add backend/src/catalog backend/src/app.ts jellyshops/src/features/catalog jellyshops/src/app/admin/products jellyshops/src/app/admin/collections
git commit -m "feat: add catalog admin and public APIs"
```

## Task 8: Define provider synchronization boundary without coupling storefront code to Shopify

**Files:**
- Create: `backend/src/catalog/provider-sync.ts`
- Create: `backend/src/catalog/provider-sync.test.ts`
- Modify: `backend/src/catalog/service.ts`
- Modify: `backend/src/catalog/types.ts`

**Interfaces:**
- Produces `CatalogProviderSync` that upserts canonical Jelly records from provider payloads using `(storeId, externalId)`.
- No storefront/editor code imports Shopify types.

- [ ] **Step 1: Write provider-neutral sync tests**

Use a fake provider payload and assert the service maps it into canonical product/variant/media inputs while keeping provider-specific IDs in `externalId`.

- [ ] **Step 2: Run test and verify failure**

Run: `cd backend && npm test -- src/catalog/provider-sync.test.ts`
Expected: FAIL because the sync boundary is absent.

- [ ] **Step 3: Implement interface and mapping contract**

Do not implement live Shopify network integration here. The contract must be sufficient for a later webhook/sync adapter.

- [ ] **Step 4: Run catalog suite**

Run: `cd backend && npm test -- src/catalog && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/catalog
git commit -m "feat: define commerce provider sync boundary"
```

**Milestone 2 gate:** production code reads catalog through `CatalogReader`; public/admin DTOs are tenant-safe; demo catalog is no longer the application contract.

---

# Milestone 3 — Custom Data and Dynamic Source Type System

## Task 9: Add shared custom-data and dynamic-binding schemas to `storefront-schema`

**Files:**
- Create: `jellyshops/packages/storefront-schema/src/custom-data.ts`
- Create: `jellyshops/packages/storefront-schema/src/custom-data.test.ts`
- Create: `jellyshops/packages/storefront-schema/src/dynamic-sources.ts`
- Create: `jellyshops/packages/storefront-schema/src/dynamic-sources.test.ts`
- Modify: `jellyshops/packages/storefront-schema/src/index.ts`

**Interfaces:**
- Produces `DynamicValueType`, `DynamicBinding`, `SettingValue<T>`, metafield/metaobject definition DTO schemas, and compatibility helpers.

- [ ] **Step 1: Write schema tests**

Test valid resource-field/metafield/metaobject bindings, reject arbitrary expression strings, reject unsupported list types, and prove `isDynamicTypeCompatible("image", "image")` while rejecting `image ← string`.

- [ ] **Step 2: Run root tests and verify failure**

Run: `cd jellyshops && npm test -- packages/storefront-schema/src/custom-data.test.ts packages/storefront-schema/src/dynamic-sources.test.ts`
Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement Zod schemas + exported TS types**

Use explicit discriminated unions; do not permit unknown expression/evaluator fields.

- [ ] **Step 4: Build schema package and rerun tests**

Run: `cd jellyshops && npm run build --workspace @jelly/storefront-schema && npm test -- packages/storefront-schema/src`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/packages/storefront-schema
git commit -m "feat: add custom data and dynamic binding schemas"
```

## Task 10: Add metafield definitions and values

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Add migration under: `backend/prisma/migrations/`
- Create: `backend/src/custom-data/repository.ts`
- Create: `backend/src/custom-data/prisma-repository.ts`
- Create: `backend/src/custom-data/service.ts`
- Create: `backend/src/custom-data/service.test.ts`
- Create: `backend/src/custom-data/prisma-repository.integration.test.ts`

**Interfaces:**
- `namespace` + `key` immutable after create.
- Values validate against definition type.
- Definitions include `storefrontVisible`, `origin`, and archive state.

- [ ] **Step 1: Write service/integration tests**

Test duplicate namespace/key rejection per `(storeId, ownerType)`, cross-store ownership rejection, type validation, immutable key behavior, and archive rather than destructive delete when usage exists.

- [ ] **Step 2: Run tests and verify failure**

Run: `cd backend && npm test -- src/custom-data/service.test.ts && npm run test:integration -- src/custom-data/prisma-repository.integration.test.ts`
Expected: FAIL because models/services are absent.

- [ ] **Step 3: Add Prisma models and service validation**

Represent typed values as validated JSON behind the definition contract; keep owner identity explicit (`ownerType`, `ownerId`).

- [ ] **Step 4: Generate and pass tests**

Run: `cd backend && npm run prisma:generate && npm test -- src/custom-data/service.test.ts && npm run test:integration -- src/custom-data/prisma-repository.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma backend/src/custom-data
git commit -m "feat: add typed metafields"
```

## Task 11: Add metaobject definitions and entries

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Add migration under: `backend/prisma/migrations/`
- Extend: `backend/src/custom-data/repository.ts`
- Extend: `backend/src/custom-data/prisma-repository.ts`
- Extend: `backend/src/custom-data/service.ts`
- Create: `backend/src/custom-data/metaobjects.test.ts`

**Interfaces:**
- Definition field handles are stable; labels may change.
- Entry values are validated JSON keyed by field handle.
- Storefront visibility is enforced before values reach renderer/editor source picker.

- [ ] **Step 1: Write metaobject tests**

Create `Brand{name:string, logo:image}`; verify invalid logo text is rejected, field-handle mutation is rejected, and a product metafield can reference a Brand entry by stable Jelly ID.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/custom-data/metaobjects.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement models/repository/service**

Keep one JSON object for field definitions and one JSON object for entry values, validated through shared storefront-schema types.

- [ ] **Step 4: Run custom-data suite/typecheck**

Run: `cd backend && npm run prisma:generate && npm test -- src/custom-data && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma backend/src/custom-data
git commit -m "feat: add structured metaobjects"
```

## Task 12: Build dynamic-source registry and binding validator

**Files:**
- Create: `backend/src/dynamic-sources/registry.ts`
- Create: `backend/src/dynamic-sources/validator.ts`
- Create: `backend/src/dynamic-sources/validator.test.ts`
- Create: `backend/src/custom-data/routes.ts`
- Create: `backend/src/custom-data/routes.test.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- Produces `listDynamicSources(context, controlType)` and `validateDynamicBinding(binding, expectedType, templateContext)`.
- Product-only sources are absent/invalid outside Product context.

- [ ] **Step 1: Write validator tests**

Test product title → text allowed; vendor → image rejected; product metafield only appears when storefront-visible; Product-specific global section binding rejected on Home context.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/dynamic-sources/validator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement registry using canonical catalog + custom-data definitions**

Do not load live values in this registry; it describes source contracts/paths/types.

- [ ] **Step 4: Add admin custom-data routes**

Require `custom_data:edit`; list source descriptors via read permission appropriate to editor use.

Run: `cd backend && npm test -- src/dynamic-sources src/custom-data/routes.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/dynamic-sources backend/src/custom-data/routes.ts backend/src/custom-data/routes.test.ts backend/src/app.ts
git commit -m "feat: add typed dynamic source registry"
```

**Milestone 3 gate:** one shared type system drives persistence and binding compatibility; custom-data schema identifiers are stable; source registry contains no arbitrary execution.

---

# Milestone 4 — Normalized Storefront Workspace

## Task 13: Add normalized workspace/content persistence models

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Add migration under: `backend/prisma/migrations/`
- Create: `backend/src/storefront/workspace/types.ts`
- Create: `backend/src/storefront/workspace/schema.integration.test.ts`

**Interfaces:**
- Adds `StorefrontWorkspace`, `StorefrontTemplate`, `GlobalSection`, `SectionPreset`, `NavigationMenu`, `ThemeConfiguration`, `StorefrontTemplateAssignment`.
- Adds first-class `StorePage`, `Blog`, and `Article` content resources.
- Every mutable storefront authoring record has integer `revision`; `StorefrontWorkspace` has integer `generation`.

- [ ] **Step 1: Write schema integration tests before migration**

Prove `(storeId, handle/type)` uniqueness, cross-store FK rejection, one workspace/theme configuration per store, and content resources can share handles across stores.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm run test:integration -- src/storefront/workspace/schema.integration.test.ts`
Expected: FAIL because models do not exist.

- [ ] **Step 3: Add Prisma models and only required indexes/constraints**

Keep template/global/menu layouts as JSON. Do not normalize individual section/block setting fields into rows.

- [ ] **Step 4: Generate client and pass migration/integration tests**

Run: `cd backend && npm run prisma:generate && npm run test:migration && npm run test:integration -- src/storefront/workspace/schema.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma backend/src/storefront/workspace
git commit -m "feat: add normalized storefront workspace models"
```

## Task 14: Implement workspace generation/revision concurrency as its own component

**Files:**
- Create: `backend/src/storefront/workspace/concurrency.ts`
- Create: `backend/src/storefront/workspace/concurrency.test.ts`
- Create: `backend/src/storefront/workspace/prisma-mutation-coordinator.ts`
- Create: `backend/src/storefront/workspace/prisma-mutation-coordinator.integration.test.ts`
- Create: `backend/src/storefront/workspace/errors.ts`

**Interfaces:**
- Produces `ResourceRevisionConflictError(currentRevision)`.
- Produces `WorkspaceGenerationConflictError(currentGeneration)`.
- Produces `WorkspaceMutationCoordinator.run(storeId, operation)` that locks/creates the workspace row, executes one resource mutation inside the same transaction, and increments generation exactly once only after that mutation succeeds.
- Resource repositories perform their own expected-revision check inside the coordinator transaction.
- Publish later uses `assertWorkspaceGeneration(storeId, expectedGeneration, tx)` under store/workspace lock.

- [ ] **Step 1: Write pure revision/generation rule tests**

```ts
it("rejects a stale resource revision", () => {
  expect(() => assertExpectedRevision(7, 6)).toThrow(ResourceRevisionConflictError);
});

it("increments without wrapping", () => {
  expect(nextRevision(7)).toBe(8);
  expect(() => nextRevision(2_147_483_647)).toThrow(/limit/i);
});
```

- [ ] **Step 2: Write transaction-level integration tests before implementation**

Required cases:

1. successful mutation increments resource revision and workspace generation once;
2. operation throws → resource mutation and generation bump both roll back;
3. stale resource write returns conflict and generation does not change;
4. editing Template A and Menu B from their correct independent revisions both succeeds even though generation changes between them;
5. concurrent successful mutations produce monotonic unique generations rather than lost increments;
6. `assertWorkspaceGeneration(olderGeneration)` returns current generation conflict.

- [ ] **Step 3: Run focused unit/integration tests and verify failure**

Run: `cd backend && npm test -- src/storefront/workspace/concurrency.test.ts`
Run: `cd backend && npm run test:integration -- src/storefront/workspace/prisma-mutation-coordinator.integration.test.ts`
Expected: FAIL because concurrency component does not exist.

- [ ] **Step 4: Implement coordinator and errors, then rerun tests**

Use a short Prisma transaction and row lock for `StorefrontWorkspace`/Store as needed. The coordinator must never know template/menu business rules; its only purpose is atomic mutation + generation semantics.

Run: `cd backend && npm test -- src/storefront/workspace/concurrency.test.ts && npm run test:integration -- src/storefront/workspace/prisma-mutation-coordinator.integration.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit concurrency independently before any resource repository**

```bash
git add backend/src/storefront/workspace/concurrency.ts backend/src/storefront/workspace/concurrency.test.ts backend/src/storefront/workspace/errors.ts backend/src/storefront/workspace/prisma-mutation-coordinator.ts backend/src/storefront/workspace/prisma-mutation-coordinator.integration.test.ts
git commit -m "feat: add storefront workspace concurrency coordinator"
```

## Task 15: Add template repository/service using the concurrency component

**Files:**
- Create: `backend/src/storefront/workspace/repositories/template-repository.ts`
- Create: `backend/src/storefront/workspace/repositories/prisma-template-repository.ts`
- Create: `backend/src/storefront/workspace/template-service.ts`
- Create: `backend/src/storefront/workspace/template-service.test.ts`
- Create: `backend/src/storefront/workspace/prisma-template-repository.integration.test.ts`

**Interfaces:**
- `updateTemplate(storeId, templateId, expectedRevision, patch)` returns `{ template, generation }`.
- Every update runs through `WorkspaceMutationCoordinator`.
- Template types restricted to `home|product|collection|page|blog|article|search|cart`.

- [ ] **Step 1: Write service + repository tests**

Test create default handle, clone layout to create a new template, stale revision rejection, and generation returned after save.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/workspace/template-service.test.ts && npm run test:integration -- src/storefront/workspace/prisma-template-repository.integration.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement repository/service through coordinator**

Do not duplicate generation-bump SQL in the template repository.

- [ ] **Step 4: Run tests/typecheck**

Run: `cd backend && npm test -- src/storefront/workspace/template-service.test.ts && npm run test:integration -- src/storefront/workspace/prisma-template-repository.integration.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storefront/workspace
git commit -m "feat: add versioned storefront templates"
```

## Task 16: Add global sections, presets, theme settings, menus, and assignments

**Files:**
- Create repository/service files under: `backend/src/storefront/workspace/repositories/`
- Create: `backend/src/storefront/workspace/global-section-service.test.ts`
- Create: `backend/src/storefront/workspace/menu-service.test.ts`
- Create: `backend/src/storefront/workspace/assignment-service.test.ts`

**Interfaces:**
- Global section updates are versioned/generation-bumped.
- Preset insert copies JSON; global placement stores stable global-section ID.
- Menu items store stable Jelly resource IDs for internal targets.
- Assignment service enforces resource belongs to same store and compatible template type.

- [ ] **Step 1: Write focused behavior tests**

Test preset copy divergence, global-section shared reference, nested menu ordering, stable resource IDs, invalid cross-store target, and Product assigned to Page template rejection.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd backend && npm test -- src/storefront/workspace/global-section-service.test.ts src/storefront/workspace/menu-service.test.ts src/storefront/workspace/assignment-service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement focused repositories/services**

All workspace mutations use Task 14 coordinator. Keep assignment/menu validation out of concurrency module.

- [ ] **Step 4: Run workspace suite**

Run: `cd backend && npm test -- src/storefront/workspace && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storefront/workspace
git commit -m "feat: add reusable storefront workspace resources"
```

## Task 17: Add Page/Blog/Article content lifecycle separate from storefront generation

**Files:**
- Create: `backend/src/content/repository.ts`
- Create: `backend/src/content/prisma-repository.ts`
- Create: `backend/src/content/service.ts`
- Create: `backend/src/content/service.test.ts`
- Create: `backend/src/content/routes.ts`
- Create: `backend/src/content/routes.test.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- Page/article content save/publish is content lifecycle, not storefront layout publication.
- Changing content fields does not bump workspace generation.
- Changing template assignment goes through storefront assignment service and does bump generation.

- [ ] **Step 1: Write lifecycle tests**

Test page draft → published, article draft → scheduled/published timestamp behavior chosen by current schema, SEO fields, and prove content edit leaves workspace generation unchanged.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/content`
Expected: FAIL.

- [ ] **Step 3: Implement content service/routes**

Require `content:view`/`content:edit`; keep template assignment call separate.

- [ ] **Step 4: Run tests/typecheck**

Run: `cd backend && npm test -- src/content src/storefront/workspace && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/content backend/src/app.ts
git commit -m "feat: add page and blog content resources"
```

## Task 18: Replace monolithic draft routes with resource-oriented workspace API

**Files:**
- Create: `backend/src/storefront/workspace/routes.ts`
- Create: `backend/src/storefront/workspace/routes.test.ts`
- Modify: `backend/src/storefront/routes.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- `GET /api/stores/:storeId/storefront/workspace`
- CRUD routes for templates/global-sections/menus/theme-settings/assignments with `expectedRevision` where mutable.
- Legacy `/draft` remains temporarily read-compatible for V3 migration only; new editor must not depend on it after Milestone 7.

- [ ] **Step 1: Write route contract tests**

Test capability checks, conflict response includes current revision, successful mutation response includes new generation, and Store A cannot address Store B resources.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/workspace/routes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement router and app wiring**

Map `ResourceRevisionConflictError` to HTTP 409 with `currentRevision`; workspace generation conflicts use separate code/currentGeneration.

- [ ] **Step 4: Run storefront/workspace suites**

Run: `cd backend && npm test -- src/storefront && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storefront backend/src/app.ts
git commit -m "feat: expose normalized storefront workspace API"
```

**Milestone 4 gate:** concurrency tests from Task 14 are green independently; every storefront workspace repository uses the coordinator; content-only edits do not bump generation; unrelated resource edits do not conflict through a single global revision.

---

# Milestone 5 — Compiler V4 and Safe Publishing

## Task 19: Define runtime V4 schema and structured compiler diagnostics

**Files:**
- Create: `jellyshops/packages/storefront-schema/src/runtime-v4.ts`
- Create: `jellyshops/packages/storefront-schema/src/runtime-v4.test.ts`
- Create: `jellyshops/packages/storefront-schema/src/diagnostics.ts`
- Modify: `jellyshops/packages/storefront-schema/src/index.ts`

**Interfaces:**
- Produces `RuntimeStorefrontSnapshotV4`.
- Produces `CompilationDiagnostic { severity, code, message, location }`.
- Snapshot stores binding instructions and artifact/registry identity, not live product/custom-data values.

- [ ] **Step 1: Write runtime-schema tests**

Assert snapshot accepts templates/global sections/menus/assignments/bindings and rejects embedded live inventory or unsupported schema version.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- packages/storefront-schema/src/runtime-v4.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement schema and diagnostic types**

Keep V2/V3 exports/migrations intact.

- [ ] **Step 4: Build/test schema package**

Run: `cd jellyshops && npm run build --workspace @jelly/storefront-schema && npm test -- packages/storefront-schema/src`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/packages/storefront-schema
git commit -m "feat: define storefront runtime v4 schema"
```

## Task 20: Build compiler input loader and validation stages

**Files:**
- Create: `backend/src/storefront/compiler/types.ts`
- Create: `backend/src/storefront/compiler/input-loader.ts`
- Create: `backend/src/storefront/compiler/validate-registry.ts`
- Create: `backend/src/storefront/compiler/validate-references.ts`
- Create: `backend/src/storefront/compiler/validate-bindings.ts`
- Create: `backend/src/storefront/compiler/validate-context.ts`
- Create tests beside each validator
- Modify: `backend/package.json` to depend on/build `@jelly/storefront-registry` if required by compiler contracts

**Interfaces:**
- `loadCompilationInput(storeId, generation)` returns one consistent authoring view.
- Validators return diagnostics; expected merchant errors are not thrown as generic 500s.

- [ ] **Step 1: Write failing validator tests**

Required cases: unknown section, deleted menu, missing global section, dynamic type mismatch, product-only binding on Home, invalid assignment.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/compiler`
Expected: FAIL.

- [ ] **Step 3: Implement small validator modules**

Keep each validator pure where practical. Do not create one large `compiler.ts` containing all rules.

- [ ] **Step 4: Run compiler tests/typecheck**

Run: `cd backend && npm test -- src/storefront/compiler && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storefront/compiler backend/package.json backend/package-lock.json
git commit -m "feat: add storefront compiler validation stages"
```

## Task 21: Generate dependency graph and runtime snapshot

**Files:**
- Create: `backend/src/storefront/compiler/dependency-graph.ts`
- Create: `backend/src/storefront/compiler/dependency-graph.test.ts`
- Create: `backend/src/storefront/compiler/snapshot.ts`
- Create: `backend/src/storefront/compiler/snapshot.test.ts`
- Create: `backend/src/storefront/compiler/compiler.ts`
- Create: `backend/src/storefront/compiler/compiler.test.ts`

**Interfaces:**
- `compileStorefront(input): CompilationResult` returns `{ ok, snapshot?, dependencies, diagnostics }`.
- Dependency edges include placement, binding, navigation, assignment, media, and extension reasons.

- [ ] **Step 1: Write graph/snapshot tests**

Compile a Product template referencing a global banner, main menu, product metafield, and media; assert all edges exist and snapshot stores binding path rather than current value.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/compiler/dependency-graph.test.ts src/storefront/compiler/snapshot.test.ts src/storefront/compiler/compiler.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement graph builder, assembler, orchestration**

Parse final output with `RuntimeStorefrontSnapshotV4` before returning success.

- [ ] **Step 4: Run compiler suite**

Run: `cd backend && npm test -- src/storefront/compiler && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storefront/compiler
git commit -m "feat: compile storefront dependency graph and runtime snapshot"
```

## Task 22: Add preview/validate compiler endpoints

**Files:**
- Create: `backend/src/storefront/compiler/routes.ts`
- Create: `backend/src/storefront/compiler/routes.test.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- `POST /storefront/validate` performs full validation for expected generation.
- `POST /storefront/preview/compile` may return snapshot plus blocking/nonblocking diagnostics for selected template/resource.

- [ ] **Step 1: Write route tests**

Test warnings do not mark compile invalid; errors do; stale requested generation is reported; diagnostics include navigation location fields.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/compiler/routes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement routes with `storefront:view` permission**

Preview endpoint must not publish or mutate `currentPublicationId`.

- [ ] **Step 4: Run route/compiler suites**

Run: `cd backend && npm test -- src/storefront/compiler src/storefront/workspace && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storefront/compiler backend/src/app.ts
git commit -m "feat: add storefront validation and preview compilation"
```

## Task 23: Replace copy-on-publish with compile-and-swap publisher

**Files:**
- Create: `backend/src/storefront/publication/repository.ts`
- Create: `backend/src/storefront/publication/prisma-repository.ts`
- Create: `backend/src/storefront/publication/service.ts`
- Create: `backend/src/storefront/publication/service.test.ts`
- Create: `backend/src/storefront/publication/prisma-repository.integration.test.ts`
- Modify: `backend/prisma/schema.prisma`
- Add migration under: `backend/prisma/migrations/`
- Modify: `backend/src/storefront/routes.ts`

**Interfaces:**
- Publication fields include `sourceGeneration`, `schemaVersion`, `compilerVersion`, `document`, `dependencyManifest`, optional `themeArtifactId`.
- `publish(storeId, expectedGeneration, idempotencyKey, actorUserId)` compiles first, then performs short locked generation check + publication insert + pointer swap.

- [ ] **Step 1: Write publisher unit/integration tests**

Required cases: compile error leaves pointer unchanged; generation changes after compile → `WORKSPACE_CHANGED`; successful publish creates immutable snapshot and switches pointer in one transaction; duplicate idempotency key returns same publication; audit event recorded.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/publication/service.test.ts && npm run test:integration -- src/storefront/publication/prisma-repository.integration.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement compile-before-transaction publisher**

Do not hold DB row locks while compiler executes. Recheck generation under lock immediately before publication creation.

- [ ] **Step 4: Run publication/storefront suites**

Run: `cd backend && npm test -- src/storefront && npm run test:integration -- src/storefront/publication/prisma-repository.integration.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storefront/publication backend/src/storefront/routes.ts backend/prisma
git commit -m "feat: publish compiled immutable storefront snapshots"
```

## Task 24: Add V3 → normalized workspace importer while keeping V3 live

**Files:**
- Create: `backend/src/storefront/migration/import-v3.ts`
- Create: `backend/src/storefront/migration/import-v3.test.ts`
- Create: `backend/scripts/migrate-storefront-v3-workspaces.mjs`
- Extend: `jellyshops/packages/storefront-schema/src/migrations.ts`
- Extend: `jellyshops/packages/storefront-schema/src/migrations.test.ts`

**Interfaces:**
- Import V3 draft/document into normalized resources without changing `currentPublicationId`.
- Import creates initial workspace generation and can compile V4 preview diagnostics.

- [ ] **Step 1: Write fixture-based migration tests**

Cover Home, product/collection defaults, custom page, header/footer, theme settings, and media references. Assert existing current V3 publication ID remains unchanged after import.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/migration/import-v3.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement importer + dry-run script**

Script prints diagnostics/result counts and only writes normalized draft resources; publishing remains explicit through normal publish endpoint.

- [ ] **Step 4: Run migration/schema tests**

Run: `cd backend && npm test -- src/storefront/migration && npm run test:migration`
Run: `cd jellyshops && npm test -- packages/storefront-schema/src/migrations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storefront/migration backend/scripts jellyshops/packages/storefront-schema/src/migrations*
git commit -m "feat: add safe storefront v3 workspace importer"
```

**Milestone 5 gate:** full compile produces a validated V4 snapshot; failed or stale compile never changes live publication; V3 import is non-destructive.

---

# Milestone 6 — Runtime Resolver and Registry-Driven Renderer

## Task 25: Add runtime resource/data resolver and immutable publication cache

**Files:**
- Create: `backend/src/dynamic-sources/resolver.ts`
- Create: `backend/src/dynamic-sources/resolver.test.ts`
- Create: `backend/src/storefront/runtime/service.ts`
- Create: `backend/src/storefront/runtime/cache.ts`
- Create: `backend/src/storefront/runtime/service.test.ts`

**Interfaces:**
- Resolve runtime binding values from current public catalog/content/custom data.
- Cache publication snapshot by immutable publication ID, never mutable store ID alone.
- Fallback order: dynamic value → binding fallback → control default → null.

- [ ] **Step 1: Write resolver/cache tests**

Publish binding `product.title`, then change product title/metafield value and assert resolver returns new values without publication change. Test missing value fallback order and no storefront-visible access to private metafield.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/dynamic-sources/resolver.test.ts src/storefront/runtime/service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement resolver/runtime service**

Use sanitized public resource DTOs. Do not give renderer repository/provider objects.

- [ ] **Step 4: Run runtime tests**

Run: `cd backend && npm test -- src/dynamic-sources src/storefront/runtime && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/dynamic-sources backend/src/storefront/runtime
git commit -m "feat: resolve live storefront dynamic values"
```

## Task 26: Replace hard-coded section dispatch with registry-driven rendering

**Files:**
- Modify: `jellyshops/packages/storefront-registry/src/types.ts`
- Modify: `jellyshops/packages/storefront-registry/src/registry.ts`
- Modify: `jellyshops/packages/storefront-renderer/src/section-renderer.tsx`
- Create: `jellyshops/packages/storefront-renderer/src/runtime-context.ts`
- Create: `jellyshops/packages/storefront-renderer/src/registry-renderer.test.tsx`

**Interfaces:**
- Registry exposes render definition lookup.
- `SectionRenderer` looks up the definition rather than branching on each section type.
- Existing editor-selection data attributes remain supported.

- [ ] **Step 1: Write registry-renderer test**

Register a test section definition and assert it renders without editing `section-renderer.tsx`; unknown section shows editor/preview warning and renders null in published mode.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- packages/storefront-renderer/src/registry-renderer.test.tsx`
Expected: FAIL while renderer remains hard-coded.

- [ ] **Step 3: Implement generic registry dispatch**

Migrate existing built-in components into registry render definitions while preserving their behavior.

- [ ] **Step 4: Run registry/renderer suites**

Run: `cd jellyshops && npm test -- packages/storefront-registry packages/storefront-renderer && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/packages/storefront-registry jellyshops/packages/storefront-renderer
git commit -m "refactor: render storefront sections from registry"
```

## Task 27: Update public storefront loader to route → resource → template → publication

**Files:**
- Modify: `jellyshops/src/features/storefront/public-storefront-api.ts`
- Modify: `jellyshops/src/features/storefront/public-storefront-api.test.ts`
- Modify: `jellyshops/src/features/storefront/storefront-page.tsx`
- Modify: `jellyshops/src/features/storefront/storefront-page.test.tsx`
- Create: `jellyshops/src/features/storefront/resource-loader.ts`
- Create: `jellyshops/src/features/storefront/resource-loader.test.ts`

**Interfaces:**
- Public page resolves current publication, route resource, assignment/default template, current live public data, then renderer context.
- Missing ordinary merchant data degrades safely.

- [ ] **Step 1: Read relevant installed Next.js docs**

Read routing/server/data-fetching docs required for the concrete route files used by the storefront.

- [ ] **Step 2: Write loader tests**

Test product handle resolves stable product ID then assigned template; changed handle does not break ID-based menu/assignment; archived featured resource produces safe empty state.

- [ ] **Step 3: Run and verify failure**

Run: `cd jellyshops && npm test -- src/features/storefront`
Expected: FAIL until loader/runtime client is updated.

- [ ] **Step 4: Implement loader/page integration**

Keep public DTOs explicit; do not expose admin-shaped records.

- [ ] **Step 5: Run frontend suite and commit**

Run: `cd jellyshops && npm test -- src/features/storefront packages/storefront-renderer && npm run typecheck && npm run lint`
Expected: PASS.

Commit:
```bash
git add jellyshops/src/features/storefront jellyshops/packages/storefront-renderer
git commit -m "feat: render public storefront from compiled publications"
```

**Milestone 6 gate:** published layout is immutable, live data resolves independently, and the renderer has no central per-section `if/else` dispatch.

---

# Milestone 7 — Online Store Editor V2

## Task 28: Replace editor monolithic draft API/state with workspace resources

**Files:**
- Modify: `jellyshops/src/features/store-editor/api/types.ts`
- Modify: `jellyshops/src/features/store-editor/api/client.ts`
- Modify: `jellyshops/src/features/store-editor/api/client.test.ts`
- Modify: `jellyshops/src/features/store-editor/state/*`
- Modify: `jellyshops/src/features/store-editor/editor-store.ts`
- Modify: `jellyshops/src/features/store-editor/editor-store.test.ts`

**Interfaces:**
- Client methods: `loadWorkspace`, template/global/menu/theme resource CRUD, `validate`, `compilePreview`, `publish(expectedGeneration, idempotencyKey)`.
- State tracks per-resource revisions plus workspace generation.

- [ ] **Step 1: Write API/state tests**

Test saving Template revision 3 sends only that template mutation, receives revision 4 + generation 22, and unrelated Menu state is not marked conflicted.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- src/features/store-editor/api src/features/store-editor/editor-store.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement resource-oriented client/state adapter**

Keep an adapter for legacy V3 store loading during migration; new editor writes only normalized APIs.

- [ ] **Step 4: Run focused frontend tests**

Run: `cd jellyshops && npm test -- src/features/store-editor && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/src/features/store-editor
git commit -m "refactor: move editor state to storefront workspace resources"
```

## Task 29: Add Online Store route, template selector, preview-resource selector, and template hierarchy

**Files:**
- Create: `jellyshops/src/app/admin/online-store/editor/page.tsx`
- Modify: `jellyshops/src/app/admin/store-design/page.tsx` to redirect
- Create: `jellyshops/src/features/store-editor/components/template-resource-selector.tsx`
- Create: `jellyshops/src/features/store-editor/components/template-resource-selector.test.tsx`
- Create: `jellyshops/src/features/store-editor/components/template-hierarchy.tsx`
- Create: `jellyshops/src/features/store-editor/components/template-hierarchy.test.tsx`
- Refactor: `jellyshops/src/features/store-editor/components/page-hierarchy.tsx`

**Interfaces:**
- Layout selector and preview-resource selector are separate state concepts.
- `page-hierarchy.tsx` stops owning custom-page creation and whole-document template replacement.

- [ ] **Step 1: Read installed Next.js route docs**

Do this before creating `/admin/online-store/editor`.

- [ ] **Step 2: Write component tests**

Test selecting `product.featured` does not change preview product; changing preview product does not mutate template; hierarchy actions target active template.

- [ ] **Step 3: Run and verify failure**

Run: `cd jellyshops && npm test -- src/features/store-editor/components/template-resource-selector.test.tsx src/features/store-editor/components/template-hierarchy.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implement route/components and compatibility redirect**

Retain current toolbar/preview/inspector where their APIs still fit.

- [ ] **Step 5: Run tests/typecheck/lint and commit**

```bash
cd jellyshops && npm test -- src/features/store-editor && npm run typecheck && npm run lint
git add src/app/admin/online-store src/app/admin/store-design src/features/store-editor
git commit -m "feat: add template-based online store editor"
```

## Task 30: Add preset/global-section workflows and dynamic-source picker

**Files:**
- Create: `jellyshops/src/features/store-editor/components/section-library.tsx`
- Create: `jellyshops/src/features/store-editor/components/global-section-panel.tsx`
- Create: `jellyshops/src/features/store-editor/components/dynamic-source-picker.tsx`
- Create tests for each
- Modify: `jellyshops/src/features/store-editor/components/inspector/inspector.tsx`
- Modify: `jellyshops/src/features/store-editor/components/inspector/setting-groups.tsx`

**Interfaces:**
- Preset insert copies section.
- Global section insert creates reference.
- Dynamic-source button appears only for controls declaring compatible types.

- [ ] **Step 1: Write interaction tests**

Test “Save as preset” copy semantics, “Make global” confirmation, “Detach” local copy, and incompatible dynamic source omitted from picker.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- src/features/store-editor/components/section-library.test.tsx src/features/store-editor/components/global-section-panel.test.tsx src/features/store-editor/components/dynamic-source-picker.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement components using registry metadata**

Do not hard-code metafield names or section-specific dynamic UI into inspector.

- [ ] **Step 4: Run editor tests**

Run: `cd jellyshops && npm test -- src/features/store-editor && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/src/features/store-editor
git commit -m "feat: add global sections and dynamic sources to editor"
```

## Task 31: Add navigation manager and resource SEO/content admin surfaces

**Files:**
- Create: `jellyshops/src/app/admin/online-store/navigation/page.tsx`
- Create: `jellyshops/src/features/navigation/*`
- Create: `jellyshops/src/app/admin/content/pages/page.tsx`
- Create: `jellyshops/src/app/admin/content/blogs/page.tsx`
- Create: `jellyshops/src/app/admin/content/metaobjects/page.tsx`
- Create: `jellyshops/src/app/admin/settings/custom-data/page.tsx`
- Create: `jellyshops/src/features/content/*`

**Interfaces:**
- Menu editor supports nested internal/external/anchor targets.
- Resource forms expose SEO title, description, handle, social image, index visibility, advanced canonical override.
- Content editor exposes template assignment separately from content values.

- [ ] **Step 1: Read installed Next.js docs for each new route pattern**

- [ ] **Step 2: Write navigation/content feature tests**

Test nested reorder serialization, internal target uses resource ID rather than URL, SEO form validation, and “Customize template” navigation preserves preview resource.

- [ ] **Step 3: Run and verify failure**

Run: `cd jellyshops && npm test -- src/features/navigation src/features/content`
Expected: FAIL.

- [ ] **Step 4: Implement pages/features against existing backend APIs**

Keep menu edits in workspace lifecycle; page/article content publish uses content lifecycle.

- [ ] **Step 5: Run tests/typecheck/lint and commit**

```bash
cd jellyshops && npm test -- src/features/navigation src/features/content && npm run typecheck && npm run lint
git add src/app/admin/online-store/navigation src/app/admin/content src/app/admin/settings/custom-data src/features/navigation src/features/content
git commit -m "feat: add navigation content and seo management"
```

## Task 32: Integrate compiler diagnostics, preview compilation, and publish UX

**Files:**
- Create: `jellyshops/src/features/store-editor/components/publish-diagnostics.tsx`
- Create: `jellyshops/src/features/store-editor/components/publish-diagnostics.test.tsx`
- Modify: `jellyshops/src/features/store-editor/components/editor-toolbar.tsx`
- Modify: `jellyshops/src/features/store-editor/components/preview-canvas.tsx`
- Modify: `jellyshops/src/features/store-editor/components/editor-shell.tsx`
- Add Playwright coverage under existing e2e structure

**Interfaces:**
- Diagnostics can navigate to template/section/block/field.
- Publish sends current workspace generation + idempotency key.
- `WORKSPACE_CHANGED` refreshes generation/diagnostics without silently overwriting edits.

- [ ] **Step 1: Write diagnostic/publish component tests**

Test warning vs error display, “Open setting” selection, stale-generation conflict UI, and public publication remains unchanged after failed publish.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- src/features/store-editor/components/publish-diagnostics.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement tolerant preview + strict publish flow**

Preview may show section-level error placeholder; Publish blocks on compiler errors.

- [ ] **Step 4: Add/execute editor end-to-end scenario**

Run: `cd jellyshops && npm run test:e2e`
Expected: editor can modify a template, preview it, see diagnostics, and publish successfully.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/src/features/store-editor jellyshops/tests jellyshops/e2e 2>/dev/null || true
git commit -m "feat: integrate compiler diagnostics into store editor"
```

**Milestone 7 gate:** editor no longer saves a giant document; template/resource concepts are separate; diagnostics are navigable; existing toolbar/preview strengths remain.

---

# Milestone 8 — Theme SDK and Developer Artifacts

## Task 33: Create `@jelly/storefront-sdk` with typed control/section/block builders

**Files:**
- Create: `jellyshops/packages/storefront-sdk/package.json`
- Create: `jellyshops/packages/storefront-sdk/tsconfig.json`
- Create: `jellyshops/packages/storefront-sdk/tsconfig.build.json`
- Create: `jellyshops/packages/storefront-sdk/src/index.ts`
- Create: `jellyshops/packages/storefront-sdk/src/controls.ts`
- Create: `jellyshops/packages/storefront-sdk/src/section.ts`
- Create: `jellyshops/packages/storefront-sdk/src/block.ts`
- Create: `jellyshops/packages/storefront-sdk/src/manifest.ts`
- Create tests under the same package

**Interfaces:**
- `defineSection`, `defineBlock`, control builders, API version, capability/manifest types.
- Control builders produce editor metadata + runtime validation metadata from one definition.

- [ ] **Step 1: Write SDK type/runtime tests**

Define a test `brand-story` section; assert heading accepts string dynamic sources, image accepts image dynamic sources, and invalid defaults fail validation.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- packages/storefront-sdk`
Expected: FAIL because package does not exist.

- [ ] **Step 3: Implement package with explicit `apiVersion: "2026-01"` contract**

SDK must import shared persisted types from storefront-schema, not editor internals.

- [ ] **Step 4: Build/test workspace**

Run: `cd jellyshops && npm install && npm test -- packages/storefront-sdk && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/packages/storefront-sdk jellyshops/package-lock.json
git commit -m "feat: add typed Jelly storefront sdk"
```

## Task 34: Migrate built-in registry definitions onto SDK contracts and add manifest hashing

**Files:**
- Modify: `jellyshops/packages/storefront-registry/src/types.ts`
- Modify: `jellyshops/packages/storefront-registry/src/registry.ts`
- Modify built-in section/block definition files
- Create: `jellyshops/packages/storefront-registry/src/manifest.ts`
- Create: `jellyshops/packages/storefront-registry/src/manifest.test.ts`

**Interfaces:**
- Registry accepts SDK definitions.
- Produces deterministic `registryManifestHash` from section/block/API contract metadata.

- [ ] **Step 1: Write compatibility/hash tests**

Same manifest → same hash; control/schema/capability change → different hash; existing built-ins still validate old fixtures.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- packages/storefront-registry`
Expected: FAIL before migration/hash implementation.

- [ ] **Step 3: Migrate definitions incrementally**

Do not change merchant-visible defaults during contract migration unless a test captures the intentional change.

- [ ] **Step 4: Run registry/renderer/schema suites**

Run: `cd jellyshops && npm test -- packages/storefront-registry packages/storefront-renderer packages/storefront-schema packages/storefront-sdk && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/packages/storefront-registry jellyshops/packages/storefront-renderer
git commit -m "refactor: drive registry from storefront sdk"
```

## Task 35: Add developer source, immutable artifacts, and shared build service

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Add migration under: `backend/prisma/migrations/`
- Create: `backend/src/developer/repository.ts`
- Create: `backend/src/developer/prisma-repository.ts`
- Create: `backend/src/developer/build-service.ts`
- Create: `backend/src/developer/build-service.test.ts`
- Modify: `backend/package.json` to add pinned `esbuild`
- Modify compiler/publication input to include artifact ID/hash/manifest

**Interfaces:**
- `ThemeDeveloperSource` stores editable files.
- `ThemeArtifact` is immutable with bundle location, manifest, SDK version, artifact hash.
- Build does type/bundle/manifest work but never executes output in backend.

- [ ] **Step 1: Write build-service tests**

Test deterministic artifact hash for same source, invalid SDK API version rejection, syntax failure returns diagnostics, and artifact is not activated automatically.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/developer/build-service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement build service and persistence**

Use esbuild for bundling only. Build output is data/artifact bytes, never `import()`ed by Express.

- [ ] **Step 4: Add compiler artifact identity validation and run tests**

Run: `cd backend && npm run prisma:generate && npm test -- src/developer src/storefront/compiler src/storefront/publication && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/developer backend/prisma backend/package.json backend/package-lock.json backend/src/storefront
git commit -m "feat: add immutable storefront developer artifacts"
```

## Task 36: Add CLI contracts and browser code editor using the same build API

**Files:**
- Create: `jellyshops/packages/storefront-cli/package.json`
- Create: `jellyshops/packages/storefront-cli/src/index.ts`
- Create: `jellyshops/packages/storefront-cli/src/client.ts`
- Create tests
- Create: `backend/src/developer/routes.ts`
- Create: `backend/src/developer/routes.test.ts`
- Create: `jellyshops/src/features/developer-tools/*`
- Create: `jellyshops/src/app/admin/online-store/developer/page.tsx`
- Modify: `jellyshops/package.json` to add pinned Monaco dependencies

**Interfaces:**
- Backend source/build/activate-draft endpoints require developer capabilities.
- CLI and browser editor both call the same routes/build service.
- Neither path publishes directly; storefront publish remains separate.

- [ ] **Step 1: Write route/client tests**

Test Designer denied, Developer can save/build, Developer without publish permission cannot publish, browser and CLI payload shapes are identical.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/developer/routes.test.ts`
Run: `cd jellyshops && npm test -- packages/storefront-cli src/features/developer-tools`
Expected: FAIL.

- [ ] **Step 3: Implement API, CLI commands, and Monaco editor shell**

Initial CLI commands: `validate`, `pull`, `push`, `build`. `push` updates draft source/artifact only.

- [ ] **Step 4: Run backend/frontend suites**

Run: `cd backend && npm test -- src/developer && npm run typecheck`
Run: `cd jellyshops && npm test -- packages/storefront-cli src/features/developer-tools && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/developer backend/src/app.ts jellyshops/packages/storefront-cli jellyshops/src/features/developer-tools jellyshops/src/app/admin/online-store/developer jellyshops/package.json jellyshops/package-lock.json
git commit -m "feat: add shared cli and browser developer workflow"
```

**Milestone 8 gate:** one SDK drives editor/compiler/renderer metadata; source and artifacts are separate; CLI/browser share build service; developer push never bypasses storefront publish.

---

# Milestone 9 — Sandbox, Security, Migration, and Release Hardening

## Task 37: Add sandboxed custom-section runtime and capability bridge

**Files:**
- Create: `jellyshops/packages/storefront-renderer/src/sandbox/protocol.ts`
- Create: `jellyshops/packages/storefront-renderer/src/sandbox/sandbox-section.tsx`
- Create: `jellyshops/packages/storefront-renderer/src/sandbox/sandbox-section.test.tsx`
- Create a sandbox runtime route/page under the appropriate Next.js route after reading installed docs
- Create: `jellyshops/packages/storefront-renderer/src/sandbox/capabilities.ts`

**Interfaces:**
- Untrusted iframe uses `sandbox="allow-scripts"` without `allow-same-origin`.
- Parent sends serialized public props/theme tokens and validates all messages.
- Initial capability set: public navigation, search, and cart actions only.

- [ ] **Step 1: Write protocol/security tests**

Test unknown origin/channel/message rejected, ungranted capability rejected, no `allow-same-origin`, no direct parent DOM access assumption, and valid `cart.add` request is validated before dispatch.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- packages/storefront-renderer/src/sandbox`
Expected: FAIL.

- [ ] **Step 3: Implement sandbox host/runtime**

Pass semantic theme tokens as serialized data/CSS variables. Do not pass auth/admin tokens.

- [ ] **Step 4: Run renderer tests/typecheck**

Run: `cd jellyshops && npm test -- packages/storefront-renderer && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/packages/storefront-renderer jellyshops/src/app
git commit -m "feat: sandbox untrusted storefront extensions"
```

## Task 38: Enforce developer import policy and checkout/account trust boundary

**Files:**
- Create: `backend/src/developer/import-policy.ts`
- Create: `backend/src/developer/import-policy.test.ts`
- Extend: `backend/src/developer/build-service.ts`
- Create security tests under backend/frontend renderer test suites
- Add checkout/account extension contract types to `jellyshops/packages/storefront-sdk/src/manifest.ts`

**Interfaces:**
- Store-custom source may import React and approved Jelly packages only by default.
- Reject Node built-ins, Prisma, Firebase Admin, filesystem, child processes, backend internals.
- Checkout/account surfaces have a smaller approved capability/component contract and cannot load normal arbitrary theme bundle.

- [ ] **Step 1: Write explicit deny/allow tests**

Allow `react`, `@jelly/storefront-sdk`, `@jelly/storefront-ui`; reject `node:fs`, `node:child_process`, `@prisma/client`, `firebase-admin`, and undeclared arbitrary npm packages.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/developer/import-policy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement AST/bundler-resolution import policy**

Reject before artifact activation; do not rely on lint warnings as security.

- [ ] **Step 4: Add checkout/account contract tests**

Prove storefront extension with `cart:write` cannot request payment/auth capability and normal theme artifact cannot be selected for checkout runtime.

Run: `cd backend && npm test -- src/developer`
Run: `cd jellyshops && npm test -- packages/storefront-sdk packages/storefront-renderer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/developer jellyshops/packages/storefront-sdk jellyshops/packages/storefront-renderer
git commit -m "security: enforce extension trust boundaries"
```

## Task 39: Execute migration, concurrency, performance, and critical-flow release gates

**Files:**
- Add/extend backend integration tests under `backend/src/**/*.integration.test.ts`
- Add/extend Playwright tests under the repository's existing e2e test location
- Extend: `backend/scripts/verify-phase-one-migration.mjs`
- Create: `docs/phase-1-online-store-release-checklist.md`

**Interfaces:**
- This task adds no new product contract; it proves the approved contracts work together.

- [ ] **Step 1: Add the eight spec-critical end-to-end flows**

Required flows:

1. create store → product → custom page → template edit → preview → publish → public render;
2. assign shared Product template to multiple products and observe one layout update;
3. global section placed in multiple templates updates all previews;
4. metafield binding remains published while changing value updates public page without republish;
5. nested menu survives target handle rename through resource ID;
6. independent resource edits succeed while stale publish generation fails safely;
7. custom developer artifact previews/publishes through sandbox and never executes in admin/backend;
8. V3 store stays live during V4 import and switches only on explicit V4 publish.

- [ ] **Step 2: Add focused concurrency stress/integration coverage**

Run parallel template/menu/global-section mutations against one store; assert no lost generation increments, resource conflicts are local, and failed mutations do not bump generation.

- [ ] **Step 3: Add basic performance assertions**

Measure representative full compile and cached publication load with deterministic fixtures. Record thresholds in the release checklist based on CI baseline after measurement; the test should compare regression against that committed baseline rather than inventing a production SLA.

- [ ] **Step 4: Run the complete verification matrix**

Run:
```bash
cd backend
npm run prisma:generate
npm run build
npm test
npm run test:integration
npm run test:migration
npm run typecheck

cd ../jellyshops
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```
Expected: all commands PASS.

- [ ] **Step 5: Commit release gates**

```bash
git add backend jellyshops docs/phase-1-online-store-release-checklist.md
git commit -m "test: harden phase 1 online store release gates"
```

**Milestone 9 / Phase 1 gate:** every acceptance criterion in the approved spec has an automated test or explicit release-checklist verification; V3 migration is safe; concurrency invariants are proven; untrusted code remains outside privileged execution contexts.

---

# Cross-Milestone Review Checkpoints

After each milestone, stop implementation and review the diff against the approved spec before starting the next milestone. In particular:

- After Milestone 1, verify every new route can be expressed with explicit capabilities rather than role-name conditionals.
- After Milestone 2, verify storefront/editor code is provider-neutral and `DemoCatalog` is only a test/dev adapter.
- After Milestone 3, verify all binding/custom-data types come from one shared schema contract.
- After Milestone 4, rerun Task 14 concurrency tests independently and verify no repository performs a manual generation bump outside `WorkspaceMutationCoordinator`.
- After Milestone 5, verify no compiler output embeds current prices/inventory/metafield values and publish cannot switch a stale generation.
- After Milestone 6, verify renderer has no store-provider/admin-data access and public caching keys on immutable publication identity.
- After Milestone 7, verify editor does not persist a monolithic V4 document back to the backend.
- After Milestone 8, verify source/artifact/build/publish are four separate states/actions.
- After Milestone 9, run the full verification matrix from a clean checkout/migration database.

# Execution Notes

- Execute milestones sequentially; tasks inside a milestone may only be parallelized when their listed Interfaces do not depend on each other.
- For schema migrations, generate the migration through Prisma in the implementation worktree and inspect SQL before committing; do not hand-edit existing migration history.
- Keep commits at the task boundaries above so a reviewer can reject/revert one behavior without discarding an entire milestone.
- If implementation discovers a requirement that changes an approved architectural boundary (for example freezing live catalog values into a publication, executing custom code in the backend, or replacing resource revisions with one global revision), stop and return to design review rather than silently changing this plan.
