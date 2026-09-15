# Jelly Shop Phase 1 Online Store Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Phase 1 Jelly Shop Online Store platform: tenant-safe catalog/content/custom-data foundations, normalized storefront workspace, typed dynamic sources, compiler-driven immutable publishing, editor V2, React/TypeScript Theme SDK, and secure developer extensions.

**Architecture:** Keep the current package boundaries and immutable-publication pattern, but replace the monolithic editable storefront document with normalized store-owned authoring resources. Compile those resources into a V4 immutable runtime snapshot; resolve live catalog/content/custom-data values at request time; render built-in sections natively and untrusted store code through a sandbox/capability bridge.

**Tech Stack:** TypeScript, Node.js, Express 5, Prisma 7/PostgreSQL, Zod 4, Vitest, PGlite integration tests, Next.js/React, Playwright, dnd-kit, existing `@jelly/storefront-*` packages, esbuild for developer artifacts, and Monaco for the browser editor when Milestone 8 begins.

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
- Milestone 4 concurrency is a first-class component. `WorkspaceMutationCoordinator` and revision/generation errors must have focused unit/integration tests before template/menu/global-section repositories depend on them.
- Do not redesign editor UI ahead of the catalog/custom-data/workspace/compiler contracts.
- After every milestone, run `cd backend && npm test && npm run typecheck` for backend-affecting work and `cd jellyshops && npm test && npm run typecheck && npm run lint` for frontend/package-affecting work.

---

## File Structure Map

The plan deliberately introduces focused modules rather than growing `backend/src/app.ts`, `backend/src/storefront/service.ts`, or `jellyshops/src/features/store-editor/components/page-hierarchy.tsx` into god-files.

### Backend domains

```text
backend/src/
  auth/
    permissions.ts
    middleware.ts
  tenants/
    store-context.ts
  audit/
    types.ts
    repository.ts
    prisma-audit-repository.ts
    service.ts
  catalog/
    types.ts
    repository.ts
    prisma-catalog-repository.ts
    service.ts
    provider-sync.ts
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
    storage.ts
    local-media-storage.ts
    repository.ts
    prisma-media-repository.ts
    service.ts
  storefront/
    workspace/
      types.ts
      errors.ts
      concurrency.ts
      prisma-mutation-coordinator.ts
      repositories/
        template-repository.ts
        prisma-template-repository.ts
        global-section-repository.ts
        prisma-global-section-repository.ts
        preset-repository.ts
        prisma-preset-repository.ts
        menu-repository.ts
        prisma-menu-repository.ts
        theme-repository.ts
        prisma-theme-repository.ts
        assignment-repository.ts
        prisma-assignment-repository.ts
      template-service.ts
      global-section-service.ts
      menu-service.ts
      theme-service.ts
      assignment-service.ts
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
      routes.ts
    publication/
      service.ts
      repository.ts
      prisma-repository.ts
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
    prisma-repository.ts
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
    manifest.ts
  storefront-renderer/src/
    runtime-context.ts
    dynamic-values.ts
    section-renderer.tsx
    sandbox/
      protocol.ts
      capabilities.ts
      sandbox-section.tsx
  storefront-themes/
  storefront-ui/

jellyshops/src/features/
  store-editor/
    api/client.ts
    api/types.ts
    state/autosave-controller.ts
    state/reducer.ts
    state/types.ts
    components/template-resource-selector.tsx
    components/template-hierarchy.tsx
    components/section-library.tsx
    components/global-section-panel.tsx
    components/dynamic-source-picker.tsx
    components/publish-diagnostics.tsx
  storefront/
    public-storefront-api.ts
    storefront-page.tsx
    resource-loader.ts
  navigation/
    api.ts
    menu-editor.tsx
  content/
    api.ts
    resource-form.tsx
    seo-fields.tsx
  developer-tools/
    api.ts
    code-editor.tsx

jellyshops/src/app/admin/
  online-store/editor/page.tsx
  online-store/navigation/page.tsx
  online-store/developer/page.tsx
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
- Modify: `backend/src/auth/firebase-auth-provider.ts`
- Modify: `backend/src/auth/firebase-auth-provider.test.ts`
- Modify: `backend/src/auth/development-auth-provider.ts`
- Modify: `backend/src/tenants/types.ts`
- Modify: `backend/prisma/schema.prisma`
- Generate migration: `cd backend && npx prisma migrate dev --name add_developer_membership_role`

**Interfaces:**
- Produces `StorePermission`, `ROLE_PERMISSIONS`, `roleHasPermission(role, permission)`, and `hasStorePermission(principal, storeId, permission)`.
- Adds role `DEVELOPER` while retaining existing roles.
- Changes `MerchantPrincipal.merchantId: string` to `MerchantPrincipal.userId: number` so audit records can use the existing internal User ID.
- Later routes consume `requireStorePermission(permission)`.

- [ ] **Step 1: Write permission-matrix tests**

```ts
it("does not let DESIGNER publish or edit developer source", () => {
  expect(roleHasPermission("DESIGNER", "storefront:edit")).toBe(true);
  expect(roleHasPermission("DESIGNER", "storefront:publish")).toBe(false);
  expect(roleHasPermission("DESIGNER", "developer:edit")).toBe(false);
});

it("lets DEVELOPER build but not publish", () => {
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

Use a fixed `Record<StoreRole, ReadonlySet<StorePermission>>`; remove `permission.endsWith(":write")` authorization logic.

- [ ] **Step 4: Update principals/providers/middleware and rerun tests**

Firebase auth returns `userId: account.id`; development auth returns its configured demo user ID. Test denied membership, denied permission, and allowed permission separately.

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
- Modify: `backend/src/storefront/routes.ts`
- Modify: `backend/src/media/routes.ts`

**Interfaces:**
- Produces `StoreRequestContext { storeId: string; userId: number; role: StoreRole }`.
- Produces `requireStorePermission(permission)` middleware that attaches `request.storeContext` only after membership + permission pass.
- Every new admin repository method accepts `storeId` explicitly.

- [ ] **Step 1: Write store-context tests**

```ts
it("attaches only the requested authorized store", () => {
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

Add `request.storeContext?: StoreRequestContext`; derive store ID only from route params.

- [ ] **Step 4: Convert existing storefront/media routes as proof of pattern**

Use `request.storeContext!.storeId` rather than reparsing body/store IDs.

Run: `cd backend && npm test -- src/tenants/store-context.test.ts src/storefront/routes.test.ts src/media/routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/tenants backend/src/auth/middleware.ts backend/src/storefront/routes.ts backend/src/media/routes.ts
git commit -m "refactor: add tenant-safe store request context"
```

## Task 3: Add append-only store audit events

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Generate migration: `cd backend && npx prisma migrate dev --name add_audit_events`
- Create: `backend/src/audit/types.ts`
- Create: `backend/src/audit/repository.ts`
- Create: `backend/src/audit/prisma-audit-repository.ts`
- Create: `backend/src/audit/service.ts`
- Create: `backend/src/audit/prisma-audit-repository.integration.test.ts`

**Interfaces:**
- Produces `AuditService.record(input)`.
- `AuditEvent`: `id`, `storeId`, `actorUserId`, `action`, `subjectType`, `subjectId?`, `metadata Json?`, `createdAt`.
- Later publication/custom-data/developer tasks record high-risk events through this service.

- [ ] **Step 1: Add a failing PGlite integration test**

```ts
it("records a store-scoped publish audit event", async () => {
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

Also prove an unknown store/user FK is rejected.

- [ ] **Step 2: Run integration test and verify failure**

Run: `cd backend && npm run test:integration -- src/audit/prisma-audit-repository.integration.test.ts`
Expected: FAIL because schema/repository are absent.

- [ ] **Step 3: Add model/repository/service**

Keep audit writes append-only; reject metadata keys matching `token`, `secret`, `password`, or `authorization` in `AuditService`.

- [ ] **Step 4: Generate client and rerun tests**

Run: `cd backend && npm run prisma:generate && npm run test:integration -- src/audit/prisma-audit-repository.integration.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma backend/src/audit
git commit -m "feat: add store audit event foundation"
```

## Task 4: Separate media metadata from byte storage

**Files:**
- Create: `backend/src/media/storage.ts`
- Create: `backend/src/media/repository.ts`
- Modify: `backend/src/media/local-media-storage.ts`
- Create: `backend/src/media/prisma-media-repository.ts`
- Create: `backend/src/media/prisma-media-repository.integration.test.ts`
- Modify: `backend/src/media/service.ts`
- Create: `backend/src/media/service.test.ts`
- Modify: `backend/src/media/types.ts`
- Modify: `backend/src/media/routes.ts`
- Modify: `backend/src/media/routes.test.ts`
- Modify: `backend/prisma/schema.prisma`
- Generate migration: `cd backend && npx prisma migrate dev --name add_media_metadata`

**Interfaces:**
- Produces `MediaStorage.put/open/remove` for bytes.
- Produces `MediaRepository.create/get/list/delete` for metadata.
- Merchant settings store `mediaId`, never filesystem/storage path.

- [ ] **Step 1: Write service tests using fake storage + repository**

Test upload creates metadata, list is store-scoped, delete rejects referenced media, and byte deletion runs only after repository validation.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd backend && npm test -- src/media/service.test.ts src/media/routes.test.ts`
Expected: FAIL until the new interfaces are wired.

- [ ] **Step 3: Add `MediaStorage`, Prisma `Media`, and repository**

Keep `LocalMediaStorage` as the development byte adapter. Store stable metadata fields from the approved spec.

- [ ] **Step 4: Wire app dependencies and pass tests**

Run: `cd backend && npm run prisma:generate && npm test -- src/media && npm run test:integration -- src/media/prisma-media-repository.integration.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/media backend/src/app.ts backend/prisma
git commit -m "refactor: separate media storage and metadata"
```

**Milestone 1 gate:** backend tests/typecheck pass; explicit permissions are used; tenant context is established; audit and media abstractions have database coverage.

---

# Milestone 2 — Canonical Catalog Foundation

## Task 5: Activate product, variant, inventory, collection, and product-media models

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Reference only: `backend/prisma/reference/commerce.prisma`
- Generate migration: `cd backend && npx prisma migrate dev --name add_canonical_catalog`
- Create: `backend/src/catalog/prisma-catalog-repository.integration.test.ts`

**Interfaces:**
- Adds production `Product`, `ProductVariant`, `InventoryLevel`, `Collection`, `CollectionProduct`, and `ProductMedia` records with store-scoped constraints.
- Retains `CommerceProvider.NATIVE | SHOPIFY` and provider `externalId` fields.

- [ ] **Step 1: Write schema/repository integration fixtures first**

Prove two stores can use the same product slug while one store cannot duplicate it; cross-store product-media and collection-product references fail.

- [ ] **Step 2: Run integration test and verify failure**

Run: `cd backend && npm run test:integration -- src/catalog/prisma-catalog-repository.integration.test.ts`
Expected: FAIL because active schema lacks catalog tables.

- [ ] **Step 3: Port only storefront-required commerce models**

Do not port checkout/order/payment/discount models.

- [ ] **Step 4: Generate client, verify migration, pass test**

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
- Produces stable Jelly IDs; provider IDs remain metadata.
- `DemoCatalogAdapter` implements the same reader only for dev/tests.

- [ ] **Step 1: Write `CatalogReader` service tests**

Test cursor/limit handling, inactive-product filtering for public reads, stable IDs, variant price range, and collection ordering.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/catalog/service.test.ts`
Expected: FAIL because canonical interfaces do not exist.

- [ ] **Step 3: Implement canonical types and Prisma repository**

Use explicit public/domain DTO mapping; never return raw Prisma rows from public methods.

- [ ] **Step 4: Adapt demo provider and pass catalog tests**

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

- [ ] **Step 1: Read installed Next.js routing/data-fetching docs**

Read the relevant files under `jellyshops/node_modules/next/dist/docs/` before touching `src/app/admin/...`.

- [ ] **Step 2: Write backend/client tests**

Prove Store A cannot read/edit Store B products; prove frontend client sends authenticated store-scoped route.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `cd backend && npm test -- src/catalog/routes.test.ts`
Run: `cd jellyshops && npm test -- src/features/catalog/api.test.ts`
Expected: FAIL for missing endpoints/client.

- [ ] **Step 4: Implement endpoints and minimum admin pages**

Use stable Jelly IDs in links/mutations; keep UI functional rather than redesigning the admin shell.

- [ ] **Step 5: Run suites and commit**

Run: `cd backend && npm test -- src/catalog && npm run typecheck`
Run: `cd jellyshops && npm test -- src/features/catalog && npm run typecheck && npm run lint`
Expected: PASS.

Commit:
```bash
git add backend/src/catalog backend/src/app.ts jellyshops/src/features/catalog jellyshops/src/app/admin/products jellyshops/src/app/admin/collections
git commit -m "feat: add catalog admin and public APIs"
```

## Task 8: Define provider synchronization boundary without leaking Shopify types

**Files:**
- Create: `backend/src/catalog/provider-sync.ts`
- Create: `backend/src/catalog/provider-sync.test.ts`
- Modify: `backend/src/catalog/service.ts`
- Modify: `backend/src/catalog/types.ts`

**Interfaces:**
- Produces `CatalogProviderSync` that upserts canonical Jelly records from provider payloads using `(storeId, externalId)`.
- No storefront/editor module imports provider-specific API types.

- [ ] **Step 1: Write provider-neutral sync tests**

Use a fake provider payload and assert canonical product/variant/media inputs preserve provider IDs only in `externalId`.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/catalog/provider-sync.test.ts`
Expected: FAIL because the sync boundary is absent.

- [ ] **Step 3: Implement interface and mapping contract**

Do not add live Shopify network integration here; this task defines the adapter contract and canonical upsert semantics.

- [ ] **Step 4: Run catalog suite**

Run: `cd backend && npm test -- src/catalog && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/catalog
git commit -m "feat: define commerce provider sync boundary"
```

**Milestone 2 gate:** production reads go through `CatalogReader`; public/admin DTOs are tenant-safe; demo catalog is only a dev/test adapter.

---

# Milestone 3 — Custom Data and Dynamic Source Type System

## Task 9: Add shared custom-data and dynamic-binding schemas

**Files:**
- Create: `jellyshops/packages/storefront-schema/src/custom-data.ts`
- Create: `jellyshops/packages/storefront-schema/src/custom-data.test.ts`
- Create: `jellyshops/packages/storefront-schema/src/dynamic-sources.ts`
- Create: `jellyshops/packages/storefront-schema/src/dynamic-sources.test.ts`
- Modify: `jellyshops/packages/storefront-schema/src/index.ts`

**Interfaces:**
- Produces `DynamicValueType`, `DynamicBinding`, `SettingValue<T>`, custom-data schemas, and compatibility helpers.

- [ ] **Step 1: Write schema tests**

Test valid resource/metafield/metaobject bindings, reject expression strings, reject unsupported list types, allow `image ← image`, reject `image ← string`.

- [ ] **Step 2: Run root tests and verify failure**

Run: `cd jellyshops && npm test -- packages/storefront-schema/src/custom-data.test.ts packages/storefront-schema/src/dynamic-sources.test.ts`
Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement discriminated Zod unions + TS exports**

Do not permit unknown expression/evaluator fields.

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
- Generate migration: `cd backend && npx prisma migrate dev --name add_metafields`
- Create: `backend/src/custom-data/repository.ts`
- Create: `backend/src/custom-data/prisma-repository.ts`
- Create: `backend/src/custom-data/service.ts`
- Create: `backend/src/custom-data/service.test.ts`
- Create: `backend/src/custom-data/prisma-repository.integration.test.ts`

**Interfaces:**
- `namespace` + `key` immutable after create.
- Values validate against definition type.
- Definitions include `storefrontVisible`, `origin`, archive state.

- [ ] **Step 1: Write service/integration tests**

Test duplicate namespace/key rejection per `(storeId, ownerType)`, cross-store ownership rejection, type validation, immutable key behavior, and archive semantics.

- [ ] **Step 2: Run tests and verify failure**

Run: `cd backend && npm test -- src/custom-data/service.test.ts && npm run test:integration -- src/custom-data/prisma-repository.integration.test.ts`
Expected: FAIL because models/services are absent.

- [ ] **Step 3: Add Prisma models and service validation**

Represent values as validated JSON behind the definition contract; retain explicit `ownerType`/`ownerId`.

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
- Generate migration: `cd backend && npx prisma migrate dev --name add_metaobjects`
- Extend: `backend/src/custom-data/repository.ts`
- Extend: `backend/src/custom-data/prisma-repository.ts`
- Extend: `backend/src/custom-data/service.ts`
- Create: `backend/src/custom-data/metaobjects.test.ts`

**Interfaces:**
- Definition field handles are stable; labels may change.
- Entry values are validated JSON keyed by field handle.
- Storefront visibility is enforced before renderer/editor source listing.

- [ ] **Step 1: Write metaobject tests**

Create `Brand{name:string, logo:image}`; reject invalid logo text, reject field-handle mutation, allow a product metafield to reference Brand by stable Jelly ID.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/custom-data/metaobjects.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement models/repository/service**

Keep definition fields and entry values as validated JSON documents.

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
- Produces `listDynamicSources(context, acceptedTypes)` and `validateDynamicBinding(binding, expectedType, templateContext)`.
- Product-only sources are absent/invalid outside Product context.

- [ ] **Step 1: Write validator tests**

Test product title → text allowed; vendor → image rejected; hidden product metafield omitted; Product-specific global-section binding rejected on Home context.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/dynamic-sources/validator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement registry from canonical catalog + custom-data definitions**

Do not load live values; this registry describes source contracts/paths/types.

- [ ] **Step 4: Add custom-data/source routes and test**

Require `custom_data:edit` for definition mutations and store read permission for source listing.

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

## Task 13: Add normalized workspace and content persistence models

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Generate migration: `cd backend && npx prisma migrate dev --name add_storefront_workspace`
- Create: `backend/src/storefront/workspace/types.ts`
- Create: `backend/src/storefront/workspace/schema.integration.test.ts`

**Interfaces:**
- Adds `StorefrontWorkspace`, `StorefrontTemplate`, `GlobalSection`, `SectionPreset`, `NavigationMenu`, `ThemeConfiguration`, `StorefrontTemplateAssignment`.
- Adds `StorePage`, `Blog`, `Article`, and `ContentStatus { DRAFT, PUBLISHED }`.
- Mutable storefront authoring records have integer `revision`; workspace has integer `generation`.
- `StorePage`/`Article` have `publishedAt DateTime?`; Phase 1 does not implement scheduled publishing.

- [ ] **Step 1: Write schema integration tests before migration**

Prove `(storeId, handle/type)` uniqueness, cross-store FK rejection, one workspace/theme configuration per store, and handles can repeat across stores.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm run test:integration -- src/storefront/workspace/schema.integration.test.ts`
Expected: FAIL because models do not exist.

- [ ] **Step 3: Add models and only required indexes/constraints**

Keep template/global/menu layouts as JSON; do not normalize individual block settings into rows.

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
- Resource repositories own expected-revision checks inside the coordinator transaction.
- Publication later uses `assertWorkspaceGeneration(storeId, expectedGeneration, tx)` under lock.

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
3. stale resource write conflicts and generation does not change;
4. Template A and Menu B edits with their own correct revisions both succeed even though workspace generation changes between them;
5. concurrent successful mutations produce monotonic unique generations with no lost increment;
6. `assertWorkspaceGeneration(olderGeneration)` reports current generation.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `cd backend && npm test -- src/storefront/workspace/concurrency.test.ts`
Run: `cd backend && npm run test:integration -- src/storefront/workspace/prisma-mutation-coordinator.integration.test.ts`
Expected: FAIL because concurrency component does not exist.

- [ ] **Step 4: Implement coordinator/errors and rerun tests**

Use a short Prisma transaction and workspace/store row lock as required. The coordinator must know no template/menu business rules.

Run: `cd backend && npm test -- src/storefront/workspace/concurrency.test.ts && npm run test:integration -- src/storefront/workspace/prisma-mutation-coordinator.integration.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit concurrency independently before resource repositories**

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
- Every mutation runs through `WorkspaceMutationCoordinator`.
- Template types: `home|product|collection|page|blog|article|search|cart`.

- [ ] **Step 1: Write service/repository tests**

Test create default handle, clone layout, stale revision rejection, and returned new generation.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/workspace/template-service.test.ts && npm run test:integration -- src/storefront/workspace/prisma-template-repository.integration.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement through coordinator**

Do not duplicate generation SQL in the template repository.

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
- Create: `backend/src/storefront/workspace/repositories/global-section-repository.ts`
- Create: `backend/src/storefront/workspace/repositories/prisma-global-section-repository.ts`
- Create: `backend/src/storefront/workspace/repositories/preset-repository.ts`
- Create: `backend/src/storefront/workspace/repositories/prisma-preset-repository.ts`
- Create: `backend/src/storefront/workspace/repositories/menu-repository.ts`
- Create: `backend/src/storefront/workspace/repositories/prisma-menu-repository.ts`
- Create: `backend/src/storefront/workspace/repositories/theme-repository.ts`
- Create: `backend/src/storefront/workspace/repositories/prisma-theme-repository.ts`
- Create: `backend/src/storefront/workspace/repositories/assignment-repository.ts`
- Create: `backend/src/storefront/workspace/repositories/prisma-assignment-repository.ts`
- Create: `backend/src/storefront/workspace/global-section-service.ts`
- Create: `backend/src/storefront/workspace/menu-service.ts`
- Create: `backend/src/storefront/workspace/theme-service.ts`
- Create: `backend/src/storefront/workspace/assignment-service.ts`
- Create: `backend/src/storefront/workspace/global-section-service.test.ts`
- Create: `backend/src/storefront/workspace/menu-service.test.ts`
- Create: `backend/src/storefront/workspace/assignment-service.test.ts`

**Interfaces:**
- Global-section updates are versioned/generation-bumped.
- Preset insertion copies JSON; global placement stores stable global-section ID.
- Menu internal targets store stable Jelly resource IDs.
- Assignment service enforces same-store ownership and template-type compatibility.

- [ ] **Step 1: Write focused behavior tests**

Test preset copy divergence, global shared reference, nested menu ordering, stable IDs, cross-store target rejection, and Product→Page-template rejection.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd backend && npm test -- src/storefront/workspace/global-section-service.test.ts src/storefront/workspace/menu-service.test.ts src/storefront/workspace/assignment-service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement focused repositories/services**

All workspace mutations use Task 14 coordinator; assignment/menu validation stays outside concurrency code.

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
- Phase 1 status is only `DRAFT` or `PUBLISHED`; publishing sets `publishedAt = now()`, unpublishing returns to `DRAFT` and clears `publishedAt`.
- Content-field changes do not bump workspace generation.
- Template assignment goes through storefront assignment service and does bump generation.

- [ ] **Step 1: Write lifecycle tests**

Test Page DRAFT→PUBLISHED, Article DRAFT→PUBLISHED, unpublish clears `publishedAt`, SEO fields persist, and content edit leaves workspace generation unchanged.

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
- `GET /api/stores/:storeId/storefront/workspace`.
- CRUD routes for templates/global-sections/menus/theme-settings/assignments with `expectedRevision` where mutable.
- Legacy `/draft` remains read-compatible for V3 migration only; new editor stops writing it in Milestone 7.

- [ ] **Step 1: Write route contract tests**

Test capability checks, conflict response includes current revision, successful mutation includes new generation, Store A cannot address Store B resources.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/workspace/routes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement router/app wiring**

Map `ResourceRevisionConflictError` to HTTP 409 with `currentRevision`; map generation conflicts to separate code/currentGeneration.

- [ ] **Step 4: Run storefront/workspace suites**

Run: `cd backend && npm test -- src/storefront && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storefront backend/src/app.ts
git commit -m "feat: expose normalized storefront workspace API"
```

**Milestone 4 gate:** Task 14 concurrency tests are green independently; every workspace repository uses the coordinator; content-only edits do not bump generation; unrelated resource edits do not conflict through a single global revision.

---

# Milestone 5 — Compiler V4 and Safe Publishing

## Task 19: Define runtime V4 schema and structured diagnostics

**Files:**
- Create: `jellyshops/packages/storefront-schema/src/runtime-v4.ts`
- Create: `jellyshops/packages/storefront-schema/src/runtime-v4.test.ts`
- Create: `jellyshops/packages/storefront-schema/src/diagnostics.ts`
- Modify: `jellyshops/packages/storefront-schema/src/index.ts`

**Interfaces:**
- Produces `RuntimeStorefrontSnapshotV4`.
- Produces `CompilationDiagnostic { severity, code, message, location }`.
- Snapshot stores binding instructions/artifact identity, not live product/custom-data values.

- [ ] **Step 1: Write runtime-schema tests**

Accept templates/global sections/menus/assignments/bindings; reject embedded live inventory and unsupported version.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- packages/storefront-schema/src/runtime-v4.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement schema/diagnostic types**

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
- Create: `backend/src/storefront/compiler/input-loader.test.ts`
- Create: `backend/src/storefront/compiler/validate-registry.ts`
- Create: `backend/src/storefront/compiler/validate-registry.test.ts`
- Create: `backend/src/storefront/compiler/validate-references.ts`
- Create: `backend/src/storefront/compiler/validate-references.test.ts`
- Create: `backend/src/storefront/compiler/validate-bindings.ts`
- Create: `backend/src/storefront/compiler/validate-bindings.test.ts`
- Create: `backend/src/storefront/compiler/validate-context.ts`
- Create: `backend/src/storefront/compiler/validate-context.test.ts`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`

**Interfaces:**
- `loadCompilationInput(storeId, generation)` returns one consistent authoring view.
- Validators return diagnostics rather than throwing generic errors for merchant-correctable problems.

- [ ] **Step 1: Write failing validator tests**

Cover unknown section, deleted menu, missing global section, binding type mismatch, product binding on Home, invalid assignment.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/compiler`
Expected: FAIL.

- [ ] **Step 3: Implement small validator modules**

If backend needs registry contracts, add `@jelly/storefront-registry` as a local file dependency and extend backend build to build schema/registry first. Do not put all rules into one compiler function.

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
- Dependency edges include placement, binding, navigation, assignment, media, extension.

- [ ] **Step 1: Write graph/snapshot tests**

Compile Product template referencing global banner, main menu, product metafield, media; assert all edges and binding path rather than current value.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/compiler/dependency-graph.test.ts src/storefront/compiler/snapshot.test.ts src/storefront/compiler/compiler.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement graph, assembler, orchestration**

Parse final output with `RuntimeStorefrontSnapshotV4` before success.

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
- `POST /storefront/preview/compile` returns selected preview snapshot plus diagnostics without publishing.

- [ ] **Step 1: Write route tests**

Test warning vs error semantics, stale generation, and diagnostic location fields.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/compiler/routes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement routes with `storefront:view`**

Preview endpoint must not mutate `currentPublicationId`.

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
- Generate migration: `cd backend && npx prisma migrate dev --name compile_storefront_publications`
- Modify: `backend/src/storefront/routes.ts`

**Interfaces:**
- Publication fields: `sourceGeneration`, `schemaVersion`, `compilerVersion`, `document`, `dependencyManifest`, optional `themeArtifactId`, `idempotencyKey` unique per store.
- `publish(storeId, expectedGeneration, idempotencyKey, actorUserId)` compiles first, then performs short locked generation check + insert + pointer swap.

- [ ] **Step 1: Write publisher unit/integration tests**

Cover compile error leaves pointer unchanged; generation changes after compile → `WORKSPACE_CHANGED`; success atomically switches; duplicate idempotency key returns same publication; audit event recorded.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/publication/service.test.ts && npm run test:integration -- src/storefront/publication/prisma-repository.integration.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement compile-before-transaction publisher**

Do not hold DB locks while compiler executes. Recheck generation under lock immediately before insert/swap.

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
- Modify: `jellyshops/packages/storefront-schema/src/migrations.ts`
- Modify: `jellyshops/packages/storefront-schema/src/migrations.test.ts`

**Interfaces:**
- Import V3 draft/document into normalized resources without changing `currentPublicationId`.
- Import creates initial workspace generation and returns V4 preview diagnostics.

- [ ] **Step 1: Write fixture-based migration tests**

Cover Home, product/collection defaults, custom page, header/footer, theme settings, media references; assert current V3 publication ID unchanged after import.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/storefront/migration/import-v3.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement importer + dry-run script**

Script writes normalized draft resources and prints counts/diagnostics only; publishing stays explicit.

- [ ] **Step 4: Run migration/schema tests**

Run: `cd backend && npm test -- src/storefront/migration && npm run test:migration`
Run: `cd jellyshops && npm test -- packages/storefront-schema/src/migrations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storefront/migration backend/scripts jellyshops/packages/storefront-schema/src/migrations.ts jellyshops/packages/storefront-schema/src/migrations.test.ts
git commit -m "feat: add safe storefront v3 workspace importer"
```

**Milestone 5 gate:** full compile produces validated V4 snapshot; failed/stale compile never changes live publication; V3 import is non-destructive.

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
- Fallback: dynamic value → binding fallback → control default → null.

- [ ] **Step 1: Write resolver/cache tests**

Publish `product.title` binding, change product title/metafield value, assert new live values without publication change; test fallback and hidden metafield denial.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/dynamic-sources/resolver.test.ts src/storefront/runtime/service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement resolver/runtime service**

Use sanitized public DTOs; renderer never receives repositories/provider clients.

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
- `SectionRenderer` looks up definition rather than branching by section type.
- Existing editor-selection metadata stays supported.

- [ ] **Step 1: Write registry-renderer test**

Register test section; assert rendering works without central renderer edits; unknown section warns in editor/preview and renders null published.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- packages/storefront-renderer/src/registry-renderer.test.tsx`
Expected: FAIL while dispatch is hard-coded.

- [ ] **Step 3: Implement generic registry dispatch**

Migrate existing built-in components into registry render definitions without changing merchant defaults.

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
- Resolve current publication, route resource, assignment/default template, current live public data, renderer context.
- Missing ordinary merchant data degrades safely.

- [ ] **Step 1: Read relevant installed Next.js docs**

Read routing/server/data-fetching docs required for the concrete storefront route files.

- [ ] **Step 2: Write loader tests**

Test handle→stable ID→assigned template; handle rename does not break ID-based menu/assignment; archived featured resource yields safe empty state.

- [ ] **Step 3: Run and verify failure**

Run: `cd jellyshops && npm test -- src/features/storefront`
Expected: FAIL until loader/runtime client is updated.

- [ ] **Step 4: Implement loader/page integration**

Keep public DTOs explicit; never expose admin-shaped records.

- [ ] **Step 5: Run frontend suite and commit**

Run: `cd jellyshops && npm test -- src/features/storefront packages/storefront-renderer && npm run typecheck && npm run lint`
Expected: PASS.

Commit:
```bash
git add jellyshops/src/features/storefront jellyshops/packages/storefront-renderer
git commit -m "feat: render public storefront from compiled publications"
```

**Milestone 6 gate:** published layout is immutable, live data resolves independently, renderer has no central per-section dispatch.

---

# Milestone 7 — Online Store Editor V2

## Task 28: Replace editor monolithic draft API/state with workspace resources

**Files:**
- Modify: `jellyshops/src/features/store-editor/api/types.ts`
- Modify: `jellyshops/src/features/store-editor/api/client.ts`
- Modify: `jellyshops/src/features/store-editor/api/client.test.ts`
- Modify: `jellyshops/src/features/store-editor/state/types.ts`
- Modify: `jellyshops/src/features/store-editor/state/reducer.ts`
- Modify: `jellyshops/src/features/store-editor/state/reducer.test.ts`
- Modify: `jellyshops/src/features/store-editor/state/autosave-controller.ts`
- Modify: `jellyshops/src/features/store-editor/state/autosave-controller.test.ts`
- Modify: `jellyshops/src/features/store-editor/editor-store.ts`
- Modify: `jellyshops/src/features/store-editor/editor-store.test.ts`

**Interfaces:**
- Client methods: `loadWorkspace`, resource CRUD, `validate`, `compilePreview`, `publish(expectedGeneration, idempotencyKey)`.
- State tracks per-resource revisions plus workspace generation.

- [ ] **Step 1: Write API/state tests**

Saving Template revision 3 sends only that resource, receives revision 4 + generation 22, unrelated Menu state is not conflicted.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- src/features/store-editor/api src/features/store-editor/editor-store.test.ts src/features/store-editor/state`
Expected: FAIL.

- [ ] **Step 3: Implement resource-oriented client/state adapter**

Keep V3 read adapter during migration; new editor writes normalized APIs only.

- [ ] **Step 4: Run focused tests**

Run: `cd jellyshops && npm test -- src/features/store-editor && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/src/features/store-editor
git commit -m "refactor: move editor state to storefront workspace resources"
```

## Task 29: Add Online Store route, template selector, preview-resource selector, hierarchy

**Files:**
- Create: `jellyshops/src/app/admin/online-store/editor/page.tsx`
- Modify: `jellyshops/src/app/admin/store-design/page.tsx`
- Create: `jellyshops/src/features/store-editor/components/template-resource-selector.tsx`
- Create: `jellyshops/src/features/store-editor/components/template-resource-selector.test.tsx`
- Create: `jellyshops/src/features/store-editor/components/template-hierarchy.tsx`
- Create: `jellyshops/src/features/store-editor/components/template-hierarchy.test.tsx`
- Refactor: `jellyshops/src/features/store-editor/components/page-hierarchy.tsx`

**Interfaces:**
- Layout selector and preview-resource selector are separate.
- `page-hierarchy.tsx` stops owning page creation/whole-document replacement.

- [ ] **Step 1: Read installed Next.js route docs**

Do this before creating `/admin/online-store/editor`.

- [ ] **Step 2: Write component tests**

Selecting `product.featured` does not change preview product; changing preview product does not mutate template; hierarchy targets active template.

- [ ] **Step 3: Run and verify failure**

Run: `cd jellyshops && npm test -- src/features/store-editor/components/template-resource-selector.test.tsx src/features/store-editor/components/template-hierarchy.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implement route/components/compatibility redirect**

Retain current toolbar/preview/inspector where APIs fit.

- [ ] **Step 5: Run tests/typecheck/lint and commit**

```bash
cd jellyshops
npm test -- src/features/store-editor
npm run typecheck
npm run lint
git add src/app/admin/online-store src/app/admin/store-design src/features/store-editor
git commit -m "feat: add template-based online store editor"
```

## Task 30: Add preset/global-section workflows and dynamic-source picker

**Files:**
- Create: `jellyshops/src/features/store-editor/components/section-library.tsx`
- Create: `jellyshops/src/features/store-editor/components/section-library.test.tsx`
- Create: `jellyshops/src/features/store-editor/components/global-section-panel.tsx`
- Create: `jellyshops/src/features/store-editor/components/global-section-panel.test.tsx`
- Create: `jellyshops/src/features/store-editor/components/dynamic-source-picker.tsx`
- Create: `jellyshops/src/features/store-editor/components/dynamic-source-picker.test.tsx`
- Modify: `jellyshops/src/features/store-editor/components/inspector/inspector.tsx`
- Modify: `jellyshops/src/features/store-editor/components/inspector/setting-groups.tsx`

**Interfaces:**
- Preset insert copies section.
- Global insert creates reference.
- Dynamic-source button appears only for compatible controls.

- [ ] **Step 1: Write interaction tests**

Test preset copy semantics, Make Global confirmation, Detach local copy, incompatible source omitted.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- src/features/store-editor/components/section-library.test.tsx src/features/store-editor/components/global-section-panel.test.tsx src/features/store-editor/components/dynamic-source-picker.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement via registry metadata**

Do not hard-code metafield names or section-specific source UI.

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
- Create: `jellyshops/src/features/navigation/api.ts`
- Create: `jellyshops/src/features/navigation/api.test.ts`
- Create: `jellyshops/src/features/navigation/menu-editor.tsx`
- Create: `jellyshops/src/features/navigation/menu-editor.test.tsx`
- Create: `jellyshops/src/app/admin/content/pages/page.tsx`
- Create: `jellyshops/src/app/admin/content/blogs/page.tsx`
- Create: `jellyshops/src/app/admin/content/metaobjects/page.tsx`
- Create: `jellyshops/src/app/admin/settings/custom-data/page.tsx`
- Create: `jellyshops/src/features/content/api.ts`
- Create: `jellyshops/src/features/content/api.test.ts`
- Create: `jellyshops/src/features/content/resource-form.tsx`
- Create: `jellyshops/src/features/content/resource-form.test.tsx`
- Create: `jellyshops/src/features/content/seo-fields.tsx`
- Create: `jellyshops/src/features/content/seo-fields.test.tsx`

**Interfaces:**
- Menu editor supports nested internal/external/anchor targets.
- Resource forms expose SEO title, description, handle, social image, index visibility, canonical override.
- Content editor exposes template assignment separately.

- [ ] **Step 1: Read installed Next.js docs for new route patterns**

- [ ] **Step 2: Write navigation/content tests**

Test nested reorder serialization, internal target uses resource ID, SEO validation, Customize Template preserves preview resource.

- [ ] **Step 3: Run and verify failure**

Run: `cd jellyshops && npm test -- src/features/navigation src/features/content`
Expected: FAIL.

- [ ] **Step 4: Implement pages/features against backend APIs**

Menu edits use workspace lifecycle; Page/Article content uses content lifecycle.

- [ ] **Step 5: Run tests/typecheck/lint and commit**

```bash
cd jellyshops
npm test -- src/features/navigation src/features/content
npm run typecheck
npm run lint
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
- Modify: `jellyshops/e2e/store-editor.spec.ts`

**Interfaces:**
- Diagnostics navigate to template/section/block/field.
- Publish sends workspace generation + idempotency key.
- `WORKSPACE_CHANGED` refreshes generation/diagnostics without overwriting edits.

- [ ] **Step 1: Write diagnostic/publish tests**

Test warnings vs errors, Open Setting, stale-generation UI, public publication unchanged after failed publish.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- src/features/store-editor/components/publish-diagnostics.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement tolerant preview + strict publish**

Preview may render section error placeholder; Publish blocks on errors.

- [ ] **Step 4: Extend editor Playwright scenario and execute**

Run: `cd jellyshops && npm run test:e2e`
Expected: template edit → preview → diagnostics → successful publish works.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/src/features/store-editor jellyshops/e2e/store-editor.spec.ts
git commit -m "feat: integrate compiler diagnostics into store editor"
```

**Milestone 7 gate:** editor no longer saves giant document; template/resource concepts are separate; diagnostics are navigable; existing toolbar/preview strengths remain.

---

# Milestone 8 — Theme SDK and Developer Artifacts

## Task 33: Create `@jelly/storefront-sdk` typed builders

**Files:**
- Create: `jellyshops/packages/storefront-sdk/package.json`
- Create: `jellyshops/packages/storefront-sdk/tsconfig.json`
- Create: `jellyshops/packages/storefront-sdk/tsconfig.build.json`
- Create: `jellyshops/packages/storefront-sdk/src/index.ts`
- Create: `jellyshops/packages/storefront-sdk/src/controls.ts`
- Create: `jellyshops/packages/storefront-sdk/src/controls.test.ts`
- Create: `jellyshops/packages/storefront-sdk/src/section.ts`
- Create: `jellyshops/packages/storefront-sdk/src/section.test.ts`
- Create: `jellyshops/packages/storefront-sdk/src/block.ts`
- Create: `jellyshops/packages/storefront-sdk/src/manifest.ts`
- Create: `jellyshops/packages/storefront-sdk/src/manifest.test.ts`

**Interfaces:**
- `defineSection`, `defineBlock`, control builders, API version, capability/manifest types.
- Builders produce editor metadata + runtime validation metadata from one definition.

- [ ] **Step 1: Write SDK tests**

Define `brand-story`; heading accepts string source, image accepts image source, invalid defaults fail validation.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- packages/storefront-sdk`
Expected: FAIL because package does not exist.

- [ ] **Step 3: Implement package with `apiVersion: "2026-01"`**

SDK imports shared persisted types from storefront-schema, never editor internals.

- [ ] **Step 4: Install/build/test workspace**

Run: `cd jellyshops && npm install && npm test -- packages/storefront-sdk && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/packages/storefront-sdk jellyshops/package-lock.json
git commit -m "feat: add typed Jelly storefront sdk"
```

## Task 34: Migrate built-in registry definitions onto SDK and add manifest hashing

**Files:**
- Modify: `jellyshops/packages/storefront-registry/src/types.ts`
- Modify: `jellyshops/packages/storefront-registry/src/registry.ts`
- Modify: `jellyshops/packages/storefront-registry/src/blocks.ts`
- Modify: `jellyshops/packages/storefront-registry/src/sections/layout.ts`
- Modify: `jellyshops/packages/storefront-registry/src/sections/content.ts`
- Modify: `jellyshops/packages/storefront-registry/src/sections/commerce.ts`
- Create: `jellyshops/packages/storefront-registry/src/manifest.ts`
- Create: `jellyshops/packages/storefront-registry/src/manifest.test.ts`

**Interfaces:**
- Registry accepts SDK definitions.
- Produces deterministic `registryManifestHash` from section/block/API metadata.

- [ ] **Step 1: Write compatibility/hash tests**

Same manifest → same hash; schema/control/capability change → different hash; existing built-ins still validate existing fixtures.

- [ ] **Step 2: Run and verify failure**

Run: `cd jellyshops && npm test -- packages/storefront-registry`
Expected: FAIL before migration/hash implementation.

- [ ] **Step 3: Migrate definitions without merchant-visible default changes**

- [ ] **Step 4: Run registry/renderer/schema/SDK suites**

Run: `cd jellyshops && npm test -- packages/storefront-registry packages/storefront-renderer packages/storefront-schema packages/storefront-sdk && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/packages/storefront-registry jellyshops/packages/storefront-renderer
git commit -m "refactor: drive registry from storefront sdk"
```

## Task 35: Add developer source, immutable artifacts, and build service

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Generate migration: `cd backend && npx prisma migrate dev --name add_theme_developer_artifacts`
- Create: `backend/src/developer/repository.ts`
- Create: `backend/src/developer/prisma-repository.ts`
- Create: `backend/src/developer/build-service.ts`
- Create: `backend/src/developer/build-service.test.ts`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Modify: `backend/src/storefront/compiler/input-loader.ts`
- Modify: `backend/src/storefront/compiler/validate-registry.ts`
- Modify: `backend/src/storefront/publication/service.ts`

**Interfaces:**
- `ThemeDeveloperSource` stores editable files.
- `ThemeArtifact` is immutable with bundle storage key, manifest, artifact hash, SDK version.
- Build performs type/bundle/manifest work but never executes bundle in backend.

- [ ] **Step 1: Write build-service tests**

Same source → same artifact hash; invalid SDK version and syntax return diagnostics; artifact not activated automatically.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/developer/build-service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add pinned esbuild dependency and implement build/persistence**

Use esbuild only to transform/bundle; backend never `import()`s merchant output.

- [ ] **Step 4: Add compiler artifact validation and run tests**

Run: `cd backend && npm run prisma:generate && npm test -- src/developer src/storefront/compiler src/storefront/publication && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/developer backend/prisma backend/package.json backend/package-lock.json backend/src/storefront
git commit -m "feat: add immutable storefront developer artifacts"
```

## Task 36: Add CLI and browser editor using the same build API

**Files:**
- Create: `jellyshops/packages/storefront-cli/package.json`
- Create: `jellyshops/packages/storefront-cli/src/index.ts`
- Create: `jellyshops/packages/storefront-cli/src/client.ts`
- Create: `jellyshops/packages/storefront-cli/src/client.test.ts`
- Create: `backend/src/developer/routes.ts`
- Create: `backend/src/developer/routes.test.ts`
- Modify: `backend/src/app.ts`
- Create: `jellyshops/src/features/developer-tools/api.ts`
- Create: `jellyshops/src/features/developer-tools/api.test.ts`
- Create: `jellyshops/src/features/developer-tools/code-editor.tsx`
- Create: `jellyshops/src/features/developer-tools/code-editor.test.tsx`
- Create: `jellyshops/src/app/admin/online-store/developer/page.tsx`
- Modify: `jellyshops/package.json`
- Modify: `jellyshops/package-lock.json`

**Interfaces:**
- Source/build/activate-draft endpoints require developer capabilities.
- CLI/browser call the same routes/build service.
- Neither path publishes production directly.

- [ ] **Step 1: Write route/client tests**

Designer denied; Developer can save/build; Developer without `developer:publish` cannot approve code publication; CLI/browser payload shapes match.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/developer/routes.test.ts`
Run: `cd jellyshops && npm test -- packages/storefront-cli src/features/developer-tools`
Expected: FAIL.

- [ ] **Step 3: Implement API, CLI, Monaco shell**

Initial CLI: `validate`, `pull`, `push`, `build`; `push` changes draft source/artifact only.

- [ ] **Step 4: Run backend/frontend suites**

Run: `cd backend && npm test -- src/developer && npm run typecheck`
Run: `cd jellyshops && npm test -- packages/storefront-cli src/features/developer-tools && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/developer backend/src/app.ts jellyshops/packages/storefront-cli jellyshops/src/features/developer-tools jellyshops/src/app/admin/online-store/developer jellyshops/package.json jellyshops/package-lock.json
git commit -m "feat: add shared cli and browser developer workflow"
```

**Milestone 8 gate:** one SDK drives editor/compiler/renderer metadata; source/artifact are separate; CLI/browser share build service; developer push never bypasses publish.

---

# Milestone 9 — Sandbox, Security, Migration, and Release Hardening

## Task 37: Add sandboxed custom-section runtime and capability bridge

**Files:**
- Create: `jellyshops/packages/storefront-renderer/src/sandbox/protocol.ts`
- Create: `jellyshops/packages/storefront-renderer/src/sandbox/capabilities.ts`
- Create: `jellyshops/packages/storefront-renderer/src/sandbox/sandbox-section.tsx`
- Create: `jellyshops/packages/storefront-renderer/src/sandbox/sandbox-section.test.tsx`
- Create: `jellyshops/src/app/storefront-sandbox/[artifactId]/page.tsx`

**Interfaces:**
- Untrusted iframe uses `sandbox="allow-scripts"` without `allow-same-origin`.
- Parent sends serialized public props/theme tokens and validates protocol messages.
- Initial capabilities: navigation, search, cart actions only.

- [ ] **Step 1: Read installed Next.js docs for the sandbox route**

- [ ] **Step 2: Write protocol/security tests**

Reject unknown channel/message and ungranted capability; assert no `allow-same-origin`; valid `cart.add` request is validated before dispatch.

- [ ] **Step 3: Run and verify failure**

Run: `cd jellyshops && npm test -- packages/storefront-renderer/src/sandbox`
Expected: FAIL.

- [ ] **Step 4: Implement sandbox host/runtime and rerun**

Pass semantic tokens as serialized data/CSS variables; never pass auth/admin tokens.

Run: `cd jellyshops && npm test -- packages/storefront-renderer && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add jellyshops/packages/storefront-renderer jellyshops/src/app/storefront-sandbox
git commit -m "feat: sandbox untrusted storefront extensions"
```

## Task 38: Enforce import policy and checkout/account trust boundary

**Files:**
- Create: `backend/src/developer/import-policy.ts`
- Create: `backend/src/developer/import-policy.test.ts`
- Create: `backend/src/developer/security.integration.test.ts`
- Modify: `backend/src/developer/build-service.ts`
- Modify: `jellyshops/packages/storefront-sdk/src/manifest.ts`
- Create: `jellyshops/packages/storefront-sdk/src/checkout-account-surfaces.test.ts`
- Create: `jellyshops/packages/storefront-renderer/src/sandbox/checkout-boundary.test.tsx`

**Interfaces:**
- Store-custom source may import React and approved Jelly packages by default.
- Reject Node built-ins, Prisma, Firebase Admin, filesystem, child processes, backend internals, undeclared arbitrary packages.
- Checkout/account use smaller capability/component contracts and never load normal arbitrary theme bundle.

- [ ] **Step 1: Write explicit deny/allow tests**

Allow `react`, `@jelly/storefront-sdk`, `@jelly/storefront-ui`; reject `node:fs`, `node:child_process`, `@prisma/client`, `firebase-admin`, undeclared npm package.

- [ ] **Step 2: Run and verify failure**

Run: `cd backend && npm test -- src/developer/import-policy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement bundler-resolution import policy**

Reject before artifact activation; linting alone is not security.

- [ ] **Step 4: Add checkout/account boundary tests and run suites**

Prove storefront extension with `cart:write` cannot request payment/auth capability and normal theme artifact cannot be selected for checkout runtime.

Run: `cd backend && npm test -- src/developer && npm run test:integration -- src/developer/security.integration.test.ts`
Run: `cd jellyshops && npm test -- packages/storefront-sdk packages/storefront-renderer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/developer jellyshops/packages/storefront-sdk jellyshops/packages/storefront-renderer
git commit -m "security: enforce extension trust boundaries"
```

## Task 39: Execute migration, concurrency, performance, and critical-flow release gates

**Files:**
- Create: `backend/src/storefront/phase-one.integration.test.ts`
- Create: `backend/src/storefront/workspace/concurrency-stress.integration.test.ts`
- Create: `backend/src/storefront/compiler/performance.test.ts`
- Create: `jellyshops/e2e/phase-1-online-store.spec.ts`
- Modify: `backend/scripts/verify-phase-one-migration.mjs`
- Create: `docs/phase-1-online-store-release-checklist.md`

**Interfaces:**
- No new product contract; proves approved contracts work together.

- [ ] **Step 1: Add eight spec-critical end-to-end flows**

Required flows:

1. store → product → page → template edit → preview → publish → public render;
2. shared Product template assigned to multiple products;
3. one global section updates multiple placements;
4. metafield value change updates public page without storefront republish;
5. nested menu survives target handle rename through resource ID;
6. independent resource edits succeed while stale publish generation fails;
7. custom artifact previews/publishes through sandbox and never executes in admin/backend;
8. V3 remains live during V4 import and switches only on explicit V4 publish.

- [ ] **Step 2: Add concurrency stress integration coverage**

Parallel template/menu/global-section mutations against one store: no lost generation increments, resource conflicts local, failed mutations do not bump generation.

- [ ] **Step 3: Add deterministic performance regression test**

In `performance.test.ts`, build one fixed fixture (100 templates, 20 global sections, 10 menus, 1,000 binding edges), run five warm-up compiles then 20 measured compiles, store median in test output, and fail only if the slowest measured compile exceeds 3× that run's median. For publication cache, perform one cold load then 100 cache hits and assert the repository loader is called exactly once. This catches pathological regressions without pretending to define a production latency SLA.

- [ ] **Step 4: Run complete verification matrix**

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
git add backend/src/storefront backend/scripts/verify-phase-one-migration.mjs jellyshops/e2e/phase-1-online-store.spec.ts docs/phase-1-online-store-release-checklist.md
git commit -m "test: harden phase 1 online store release gates"
```

**Milestone 9 / Phase 1 gate:** every acceptance criterion in the approved spec has automated coverage or an explicit release-checklist verification; V3 migration is safe; concurrency invariants are proven; untrusted code remains outside privileged execution contexts.

---

# Cross-Milestone Review Checkpoints

After each milestone, stop implementation and review the diff against the approved spec before starting the next milestone.

- After Milestone 1, verify every new route can be expressed with explicit capabilities rather than role-name conditionals.
- After Milestone 2, verify storefront/editor code is provider-neutral and `DemoCatalog` is only a dev/test adapter.
- After Milestone 3, verify all binding/custom-data types come from one shared schema contract.
- After Milestone 4, rerun Task 14 concurrency tests independently and verify no repository performs a manual generation bump outside `WorkspaceMutationCoordinator`.
- After Milestone 5, verify no compiler output embeds current prices/inventory/metafield values and publish cannot switch a stale generation.
- After Milestone 6, verify renderer has no provider/admin-data access and public caching keys on immutable publication ID.
- After Milestone 7, verify editor does not persist a monolithic V4 document back to backend.
- After Milestone 8, verify source/artifact/build/publish are four separate states/actions.
- After Milestone 9, run full verification from a clean checkout and migration database.

# Execution Notes

- Execute milestones sequentially; parallelize tasks only when their listed Interfaces do not depend on one another.
- For Prisma migrations, generate migration SQL in the implementation worktree and inspect it before committing; never rewrite existing migration history.
- Keep commits at task boundaries so one behavior can be reviewed/reverted independently.
- If implementation discovers a requirement that changes an approved architectural boundary—freezing live catalog values into a publication, executing store code in backend/admin, or replacing resource revisions with one global revision—stop and return to design review rather than silently changing this plan.
