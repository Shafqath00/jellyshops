# V4 Publication Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist compiled V4 snapshots immutably, activate them through the durable store pointer, and serve only the active snapshot through the public V4 runtime.

**Architecture:** Extend the existing publication repository contract and implement it against `StorefrontPublication` plus `Store.currentPublicationId`. The existing compilation service feeds `CompiledStorefrontPublicationService`; storage and activation remain separate, while `StorefrontRuntimeService` performs pointer-based public reads. `createApp` composes one shared SQL-backed chain for Validate, Preview, Publish, and Public without changing compiler behavior.

**Tech Stack:** TypeScript, PostgreSQL/PGlite, Express, Vitest, existing V4 compiler and storefront runtime.

**Spec:** `docs/superpowers/specs/2026-09-22-v4-publication-pipeline-design.md`

## Global Constraints

- Workspace and publication identity remains `storeId`; do not introduce multi-theme identity.
- Reuse `CompiledPublicationRecord`, `CompiledPublicationRepository`, `CompiledStorefrontPublicationService`, and `StorefrontRuntimeService`.
- A publication row is append-only and immutable after insert.
- Save must complete before activation; activation never precedes persistence.
- Public reads follow `storeId → currentPublicationId → immutable publication`; they never read the draft workspace.
- Explicitly injected compiler, publication, and public APIs take precedence over local SQL defaults.
- Custom-data metafield/metaobject loading remains out of scope.
- Do not expand Blog, Article, Product, Search, or Theme Store UI.

## Review Focus

- A repeated idempotency key whose first activation failed must reactivate the stored publication without recompiling or inserting another row; Task 2 tests this branch.
- Concurrent activation requests must each be a single guarded SQL update and may not activate another store's publication; Task 2 tests the guarded update.
- A missing/corrupt current pointer must fail closed and never fall back to draft state; Task 4 tests the public adapter result.
- Generation zero must persist through the legacy `sourceRevision` compatibility column without coercion; Task 1 tests the migration.
- A caller-supplied snapshot object changed after `save` must not alter the stored publication; Task 2 tests an independent reread.

---

### Task 1: Align the Existing Publication Schema and Contracts

**Files:**
- Create: `backend/sql/migrations/20260922000000_v4_publication_activation.sql`
- Modify: `backend/test/integration/pglite.ts`
- Create: `backend/test/integration/publication-schema.test.ts`

**Interfaces:**
- Consumes: existing `StorefrontPublication` and `Store.currentPublicationId` tables.
- Produces: a PGlite schema that supports V4 generation zero while retaining database-enforced publication immutability.

- [ ] **Step 1: Write the failing schema test**

Create a PGlite test that inserts a V4 publication with `sourceRevision = 0`, verifies `Store.currentPublicationId` is initially null, and proves an attempted publication update fails with the existing immutability trigger:

```ts
await database.query(
  `INSERT INTO "StorefrontPublication"
     ("id", "storeId", "sourceRevision", "sourceGeneration", "schemaVersion",
      "compilerVersion", "document", "dependencyManifest", "idempotencyKey", "publishedAt")
   VALUES ('pub-zero', 'store-a', 0, 0, 4, 'local-v4-1', $1, $2, 'zero', CURRENT_TIMESTAMP)`,
  [snapshot(0), { edges: [] }],
);
await expect(database.query(
  `UPDATE "StorefrontPublication" SET "document" = '{}' WHERE "id" = 'pub-zero'`,
)).rejects.toThrow(/immutable/i);
```

- [ ] **Step 2: Run the schema test to verify RED**

Run: `npm run test:integration -- --run test/integration/publication-schema.test.ts`

Expected: FAIL because the PGlite migration set lacks compiled-publication columns and the legacy constraint rejects generation zero.

- [ ] **Step 3: Add the compatibility migration**

The migration must replace only the legacy check:

```sql
ALTER TABLE "StorefrontPublication"
  DROP CONSTRAINT IF EXISTS "StorefrontPublication_sourceRevision_check";

ALTER TABLE "StorefrontPublication"
  ADD CONSTRAINT "StorefrontPublication_sourceRevision_check"
  CHECK ("sourceRevision" >= 0);
```

Add `20260914010000_compile_storefront_publications.sql` and the new migration to `schemaMigrations`.

- [ ] **Step 4: Run schema and TypeScript checks**

Run: `npm run test:integration -- --run test/integration/publication-schema.test.ts && npm run typecheck`

Expected: schema test and TypeScript pass.

- [ ] **Step 5: Commit**

```bash
git add backend/sql/migrations/20260922000000_v4_publication_activation.sql backend/test/integration/pglite.ts backend/test/integration/publication-schema.test.ts
git commit -m "feat: define v4 publication activation contract"
```

### Task 2: Implement Immutable Storage and Save-Before-Activate Publication

**Files:**
- Modify: `backend/src/storefront/publication/repository.ts`
- Create: `backend/src/storefront/publication/sql-repository.ts`
- Create: `backend/src/storefront/publication/sql-repository.test.ts`
- Modify: `backend/src/storefront/publication/service.ts`
- Modify: `backend/src/storefront/publication/service.test.ts`

**Interfaces:**
- Consumes: `SqlExecutor`, `RuntimeStorefrontSnapshotV4`, the two existing SQL tables, and the existing compiler publisher API.
- Produces: the extended `CompiledPublicationRepository`, `SqlCompiledPublicationRepository implements CompiledPublicationRepository, CurrentPublicationPointer, PublicationSnapshotLoader`, and safe compile → save → activate service orchestration.

- [ ] **Step 1: Write failing PGlite repository tests**

Cover literal outcomes for:

```ts
const first = await repository.save(input("store-a", "pub-a1", "key-a1", 1));
expect(await repository.get("store-a", first.id)).toEqual(first);
expect(await repository.getCurrentPublicationId("store-a")).toBeNull();

await repository.activate("store-a", first.id);
expect(await repository.getCurrent("store-a")).toEqual(first);

const second = await repository.save(input("store-a", "pub-a2", "key-a2", 2));
await repository.activate("store-a", second.id);
expect((await repository.getCurrent("store-a"))?.id).toBe("pub-a2");
expect((await repository.get("store-a", "pub-a1"))?.id).toBe("pub-a1");
```

Also assert duplicate-ID overwrite fails, repeated `(storeId, idempotencyKey)` returns the original record, Store A cannot `get` or `activate` Store B's publication, missing activation throws while preserving the old pointer, mutating the original input after save does not change a reread, and a second repository instance sees the same pointer. Add service tests for compilation failure, save failure, activation failure, second-publish replacement, and idempotent reactivation.

- [ ] **Step 2: Run repository tests to verify RED**

Run: `npm test -- --run src/storefront/publication/sql-repository.test.ts src/storefront/publication/service.test.ts`

Expected: FAIL because `SqlCompiledPublicationRepository` and the separated repository methods do not exist.

- [ ] **Step 3: Extend the contract and implement row mapping plus append-only save**

Change `publish` on `CompiledPublicationRepository` to `save`, then add:

```ts
get(storeId: string, publicationId: string): Promise<CompiledPublicationRecord | null>;
getCurrentPublicationId(storeId: string): Promise<string | null>;
getCurrent(storeId: string): Promise<CompiledPublicationRecord | null>;
activate(storeId: string, publicationId: string): Promise<void>;
```

Align `actorUserId` to `string`, matching the authenticated route contract; it remains audit context and is not invented as a new publication column.

Insert `snapshot` into `document`, `dependencies` into `dependencyManifest`, and copy the snapshot metadata into the existing columns. Use an injected `id: () => string` and `now: () => Date` only as normal production dependencies with `randomUUID`/`new Date` defaults.

Map every read through `runtimeStorefrontSnapshotV4Schema.parse` and reconstruct the existing record:

```ts
return {
  id: String(row.id),
  storeId: String(row.storeId),
  sourceGeneration: Number(row.sourceGeneration),
  schemaVersion: Number(row.schemaVersion),
  compilerVersion: String(row.compilerVersion),
  snapshot: runtimeStorefrontSnapshotV4Schema.parse(row.document),
  dependencies: row.dependencyManifest as StorefrontDependencyGraph,
  themeArtifactId: row.themeArtifactId ? String(row.themeArtifactId) : null,
  idempotencyKey: String(row.idempotencyKey),
  publishedAt: new Date(row.publishedAt as string | Date),
};
```

- [ ] **Step 4: Implement guarded activation and public loader methods**

Activation must be one atomic guarded statement:

```sql
UPDATE "Store" AS store
SET "currentPublicationId" = $2, "updatedAt" = CURRENT_TIMESTAMP
WHERE store."id" = $1
  AND EXISTS (
    SELECT 1 FROM "StorefrontPublication" publication
    WHERE publication."id" = $2 AND publication."storeId" = store."id"
  )
RETURNING store."id"
```

Zero returned rows throws `PublicationActivationError`. `loadPublication(publicationId)` loads by immutable ID for the runtime cache, while `getCurrent` joins through the explicit pointer.

- [ ] **Step 5: Implement and verify compile → save → activate service behavior**

Use a small in-memory fake repository that records saved publications and a current pointer. Add tests proving:

- invalid compilation calls neither `save` nor `activate`;
- successful compilation calls `save` before `activate` and returns 201-compatible `reused: false`;
- save failure does not call `activate` and keeps publication A current;
- activation failure leaves B stored, keeps A current, and throws/returns the existing error path;
- a second successful publish switches A to B;
- repeated idempotency returns the stored publication without compile/save and activates it if not current;
- draft/compiler input objects changed after publish cannot mutate the stored snapshot.

The ordering assertion uses a literal event list:

```ts
expect(events).toEqual(["compile", "save:pub-b", "activate:pub-b"]);
```

Keep compilation unchanged and replace the final repository call:

```ts
const publication = await this.repository.save(input);
await this.repository.activate(storeId, publication.id);
```

For an existing idempotent record, check `getCurrentPublicationId`; call `activate` only when needed, then return `{ reused: true }`. Do not recompile or resave.

- [ ] **Step 6: Run repository, service, schema, and TypeScript checks**

Run: `npm test -- --run src/storefront/publication/sql-repository.test.ts src/storefront/publication/service.test.ts src/storefront/publication/routes.test.ts && npm run test:integration -- --run test/integration/publication-schema.test.ts && npm run typecheck`

Expected: all publication/schema suites and TypeScript pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/storefront/publication/repository.ts backend/src/storefront/publication/sql-repository.ts backend/src/storefront/publication/sql-repository.test.ts backend/src/storefront/publication/service.ts backend/src/storefront/publication/service.test.ts
git commit -m "feat: persist and activate immutable v4 publications"
```

### Task 3: Wire Publish and the Strict Public Snapshot Reader

**Files:**
- Modify: `backend/src/storefront/runtime/service.ts`
- Modify: `backend/src/storefront/runtime/service.test.ts`
- Modify: `backend/src/storefront/routes.ts`
- Modify: `backend/src/storefront/routes.test.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/app.local-v4.test.ts`

**Interfaces:**
- Consumes: the one SQL repository from Task 2 and the one compiler service already constructed by `createLocalV4CompilationService`.
- Produces: one `StorefrontPublicationApi` for Publish and one `PublicStorefrontApi` that returns `{ id, document: RuntimeStorefrontSnapshotV4 }`.

- [ ] **Step 1: Write failing runtime/public-reader tests**

Extend `StorefrontRuntimeService` with:

```ts
getPublishedPublication(storeId: string): Promise<{
  id: string;
  snapshot: RuntimeStorefrontSnapshotV4;
} | null>;
```

Test no pointer, missing snapshot, Store A pointer resolving a Store B snapshot, and switching the pointer. Missing/cross-store results must fail closed and never invoke a draft loader.

- [ ] **Step 2: Write failing application tests**

With PGlite and the real persisted V4 workspace, assert:

```ts
expect((await post("publish", { expectedGeneration: 4, idempotencyKey: "pub-a" })).status).toBe(201);
expect((await get("public")).body.document.sourceGeneration).toBe(4);
```

Assert an app with no current publication returns 404, and injected publication/public APIs are not replaced.

- [ ] **Step 3: Run focused tests to verify RED**

Run: `npm test -- --run src/storefront/runtime/service.test.ts src/storefront/routes.test.ts src/app.local-v4.test.ts`

Expected: Publish remains 503 and the public route still uses the legacy `StorefrontRepository`.

- [ ] **Step 4: Implement the public runtime result and route boundary**

Have `StorefrontRuntimeService` load the explicit pointer, then the cached immutable snapshot, verify `snapshot.storeId`, and return both pointer ID and snapshot. Adapt `createStorefrontRouter` so `/public` calls the injected `PublicStorefrontApi`; keep `/draft` on the legacy service for migration compatibility.

The HTTP body remains compatible with the frontend loader:

```ts
{ id: publication.id, document: publication.snapshot }
```

- [ ] **Step 5: Compose shared dependencies once in `createApp`**

When SQL and the compiler are present and no explicit overrides exist:

```ts
const publications = new SqlCompiledPublicationRepository(storefrontSql);
const publicationApi = new CompiledStorefrontPublicationService(storefrontCompilerApi, publications);
const runtime = new StorefrontRuntimeService(
  publications,
  new ImmutablePublicationCache(publications),
);
const publicApi = {
  async load(storeId: string) {
    const current = await runtime.getPublishedPublication(storeId);
    if (!current) return null;
    return { id: current.id, document: current.snapshot };
  },
};
```

Adjust `PublicStorefrontApi.load` to return nullable. Mount the existing 503 Publish fallback only when this composition cannot be created. Explicit injected APIs win independently.

- [ ] **Step 6: Run focused tests and TypeScript**

Run: `npm test -- --run src/storefront/runtime/service.test.ts src/storefront/routes.test.ts src/app.local-v4.test.ts src/app.test.ts src/app.public-storefront.test.ts && npm run typecheck`

Expected: all focused tests and TypeScript pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/storefront/runtime/service.ts backend/src/storefront/runtime/service.test.ts backend/src/storefront/routes.ts backend/src/storefront/routes.test.ts backend/src/app.ts backend/src/app.local-v4.test.ts
git commit -m "feat: wire v4 publish and public snapshot reads"
```

### Task 4: Prove Draft/Public Isolation, Restart Durability, and Runtime Routes

**Files:**
- Create: `backend/test/integration/local-v4-publication-pipeline.test.ts`
- Create: `jellyshops/src/features/storefront/published-v4-routes.test.ts`
- Modify: `backend/README.md`

**Interfaces:**
- Consumes: the fully composed app, SQL workspace reader/compiler, SQL publication repository, public HTTP contract, and existing `resolveStorefrontRoute` V4 runtime.
- Produces: end-to-end evidence for the accepted publication milestone; no new production interfaces.

- [ ] **Step 1: Write the full PGlite HTTP lifecycle test**

Persist Home, Product, Collection, and Cart default templates plus compiler-required resources. Drive the real app through:

```text
Draft A (generation 1) → Publish key-a → Public contains A
Draft B (generation 2) → Preview contains B → Public still contains A
Publish key-b → Public contains B
Draft C (generation 3) → Preview contains C → Public still contains B
```

Record publication A/B IDs and assert they differ, both immutable rows remain readable, and draft generation/layout remain unchanged by each Publish.

- [ ] **Step 2: Add failure-path integration cases**

Starting with live A:

- make Draft B reference a missing global, Publish returns 422, no new row is saved, and Public remains A;
- wrap the repository so `save` throws, assert activation is not attempted and Public remains A;
- wrap it so `activate` throws after real `save`, assert B exists inactive and Public remains A.

Use explicit dependency injection at the repository/service boundary; do not alter HTTP routes to create failures.

- [ ] **Step 3: Add restart persistence verification**

Create a second repository/runtime/app composition over the same PGlite database after publishing B. Assert the current publication ID and public snapshot are still B, while the current draft may be C.

- [ ] **Step 4: Add V4 runtime route verification**

Feed the schema-validated published snapshot fixture containing Home, Product, Collection, and Cart defaults into the existing `resolveStorefrontRoute` with real resource-reader results. Assert all four routes return `status: "ready"` with their published template IDs. This adds no new page behavior.

- [ ] **Step 5: Run lifecycle and runtime tests to verify RED/GREEN**

Run:

```bash
cd backend && npm run test:integration -- --run test/integration/local-v4-publication-pipeline.test.ts
cd ../jellyshops && npm test -- --run src/features/storefront/published-v4-routes.test.ts
```

Expected: both suites pass after Tasks 1-3; any failure identifies an integration contract missed by the focused tests.

- [ ] **Step 6: Document the milestone limitations**

Update the backend README with the strict Draft/Preview/Publish/Public separation, SQL restart durability, `storeId`-only identity, and the known custom-data dynamic-binding limitation.

- [ ] **Step 7: Run the complete verification gate**

```bash
cd backend
npm test
npm run test:integration
npm run typecheck
npm run build
cd ../jellyshops
npm test -- --run src/features/storefront/public-storefront-api.test.ts src/features/storefront/resource-loader.test.ts src/features/storefront/storefront-page.test.tsx src/features/storefront/published-v4-routes.test.ts
npm run build
cd ..
git diff --check
```

Expected: all focused and integration tests, both TypeScript/build commands, and diff check pass. Record the known unrelated baseline failures by exact test name rather than changing them.

- [ ] **Step 8: Commit**

```bash
git add backend/test/integration/local-v4-publication-pipeline.test.ts jellyshops/src/features/storefront/published-v4-routes.test.ts backend/README.md
git commit -m "test: prove durable v4 publication lifecycle"
```
