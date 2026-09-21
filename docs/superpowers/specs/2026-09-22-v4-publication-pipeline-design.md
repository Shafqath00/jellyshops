# V4 Publication Pipeline Design

## Goal

Persist compiled V4 storefront snapshots as immutable publications, activate them through a durable explicit pointer, and serve public storefront pages only from the active publication. The workspace identity remains `storeId`.

## Existing contracts and storage

This slice reuses and extends the existing V4 abstractions:

- `CompiledPublicationRecord` is the publication record and contains the compiled `RuntimeStorefrontSnapshotV4`.
- `CompiledPublicationRepository` is the publication persistence boundary.
- `CompiledStorefrontPublicationService` owns compile-before-persist publication orchestration.
- `CurrentPublicationPointer`, `PublicationSnapshotLoader`, `ImmutablePublicationCache`, and `StorefrontRuntimeService` are the public-read path.
- `StorefrontPublication.id` remains the publication ID.
- `Store.id` / workspace `storeId` remains the sole store and workspace identity.
- `Store.currentPublicationId` is the durable explicit current-publication reference.
- `StorefrontPublication` already has database triggers rejecting updates, deletes, and truncation.

No parallel local-only publication model is introduced.

## SQL representation

`StorefrontPublication` stores one append-only compiled publication:

- `id`: generated immutable publication ID
- `storeId`: owning store
- `sourceGeneration`: V4 workspace generation compiled into the snapshot
- `sourceRevision`: legacy compatibility column, written with the same generation
- `schemaVersion`, `compilerVersion`, and `themeArtifactId`: copied from the compiled snapshot
- `document`: the complete `RuntimeStorefrontSnapshotV4`
- `dependencyManifest`: the existing compiler dependency graph
- `idempotencyKey`: unique per store
- `publishedAt`: creation timestamp

The legacy `sourceRevision >= 1` constraint must be relaxed to `sourceRevision >= 0`, because a valid V4 workspace generation may be zero. The V4 snapshot remains the authoritative runtime document.

`Store.currentPublicationId` identifies the live publication. Public reads must never infer current state by publication timestamp.

## Repository contract

Extend `CompiledPublicationRepository` without introducing a second record type:

```ts
interface CompiledPublicationRepository {
  findByIdempotencyKey(storeId: string, idempotencyKey: string): Promise<CompiledPublicationRecord | null>;
  save(input: PublishCompiledSnapshotInput): Promise<CompiledPublicationRecord>;
  get(storeId: string, publicationId: string): Promise<CompiledPublicationRecord | null>;
  getCurrentPublicationId(storeId: string): Promise<string | null>;
  getCurrent(storeId: string): Promise<CompiledPublicationRecord | null>;
  activate(storeId: string, publicationId: string): Promise<void>;
}
```

`save` only inserts. It never updates `Store.currentPublicationId`. Duplicate publication IDs cannot overwrite existing rows, and the database immutability trigger remains the final enforcement boundary.

`activate` runs in a database transaction, verifies that the target publication belongs to the requested store, and updates only that store's `currentPublicationId`. A missing or cross-store publication fails without changing the prior pointer.

## Publish ordering and failure semantics

`CompiledStorefrontPublicationService.publish` uses the already-wired compiler and performs:

```text
idempotency lookup
→ compile persisted draft workspace
→ reject blocking diagnostics
→ save immutable publication
→ activate saved publication
→ return success
```

The service never duplicates Validate logic; it calls the same compiler service used by Validate and Preview.

Failure behavior:

- Compilation failure: no publication is saved or activated.
- Persistence failure: activation is not attempted and the previous pointer remains current.
- Activation failure: the new immutable publication may remain stored but inactive; the previous pointer remains current.
- Repeated idempotency key: return the existing publication. If it is not current because a previous activation failed, retry activation rather than compiling or inserting a duplicate.

The workspace is read-only throughout publication. Later draft edits cannot mutate stored snapshots because the repository persists and returns parsed immutable JSON values rather than shared object references.

## Public snapshot reader

The SQL publication repository implements both `CurrentPublicationPointer` and `PublicationSnapshotLoader`. One `StorefrontRuntimeService` composes those interfaces with `ImmutablePublicationCache`:

```text
storeId
→ Store.currentPublicationId
→ StorefrontPublication.document
→ RuntimeStorefrontSnapshotV4
→ V4 storefront runtime
```

No current pointer returns the existing unpublished/not-found response. A pointer whose publication cannot be loaded returns a safe unavailable/not-found result; it never falls back to the draft workspace. The store ID embedded in the snapshot must match the requested store.

## Application wiring

`createApp` constructs the SQL publication repository once from the same configured SQL executor used by local V4 compilation. It then constructs:

- `CompiledStorefrontPublicationService` for Publish, using the already-created `StorefrontCompilationService`.
- `StorefrontRuntimeService` for public snapshot reads.
- the existing publication and public HTTP adapters around those shared services.

Explicitly injected compiler, publication, or public APIs continue to take precedence. Validate and Preview retain their existing draft-only path.

## Restart durability

Publication rows and `Store.currentPublicationId` are SQL-backed, so a newly constructed repository/service/app instance resolves the same current publication after restart. The immutable cache is process-local only; it is a read-through optimization and is safely rebuilt after restart.

## Verification

Repository tests cover immutable insert/read, multiple publications, explicit activation, missing and cross-store activation, previous-publication readability, idempotency, and repository reinitialization.

Service tests cover successful publication, compile failure, save failure, activation failure, second publication pointer replacement, draft preservation, and snapshot independence from later draft edits.

End-to-end PGlite/app tests prove:

```text
Draft A → Publish → Public A
Draft B → Preview B → Public A
Publish B → Public B
Draft C → Preview C → Public B
restart services → Public B
```

Published V4 snapshots are exercised through the existing Home, Product, Collection, and Cart public runtime paths. Search may be included only if its existing implementation needs no expansion.

## Limitations and non-goals

- Workspace/publication identity is only `storeId`; installed multi-theme identity is not introduced.
- SQL-backed metafield/metaobject definition loading remains separate. Built-in resource references compile locally; custom-data bindings still require injected dynamic-source services.
- No Blog/Article expansion, richer Product work, Search expansion, Theme Store UI, publication rollback UI, or publication garbage collection is part of this slice.
