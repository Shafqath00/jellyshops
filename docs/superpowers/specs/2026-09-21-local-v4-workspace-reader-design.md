# Local V4 Workspace Reader Design

## Goal

Provide a side-effect-free local reader that reconstructs a store's persisted V4 draft workspace as the existing `StorefrontCompilationInput`. The reader is the only local-persistence boundary consumed by the V4 compiler.

## Scope

This work implements the first prerequisite for local publishing: draft workspace reconstruction and compile-through validation. It does not add publication storage, public snapshot reads, app wiring, page expansion, or a second compiler.

## Workspace identity

The authoritative current identity is `storeId`.

`StorefrontWorkspace` is keyed by `storeId`; every V4 persistence table is scoped by it; and `ThemeConfiguration` has `storeId` as its primary key. Although `ThemeConfiguration` includes `themeId` and `themeVersion`, those describe the selected theme, not an installed-theme workspace key. The reader must therefore query exactly one store's records and must not filter, merge, or synthesize a second workspace identity from `themeId`.

This means the schema cannot yet host two independently editable installed themes for one store. Adding that capability requires a future migration and a corresponding compiler-input identity change; it is outside this reader.

## Reader boundary and input contract

The reader implements the existing `CompilationInputLoader` interface:

```ts
load(storeId: string, expectedGeneration: number, registryManifestHash: string): Promise<StorefrontCompilationInput>
```

It produces the existing V4 compiler types directly:

- `StorefrontCompilationInput`
- `CompilerTemplateInput`
- `CompilerGlobalSectionInput`
- `CompilerMenuInput`
- `CompilerAssignmentInput`

It does not introduce an alternate local theme document or compiler DTO. Persisted template layouts and section documents are adapted structurally at the reader boundary into the compiler's existing section-placement/node shapes.

## Persistence sources

For one `storeId`, the reader aggregates:

| Source | Compiler field | Notes |
| --- | --- | --- |
| `StorefrontWorkspace` | `generation` | Authoritative draft generation and stable-read check. |
| `StorefrontTemplate` | `templates` | Includes inline section placements and references to global sections. |
| `GlobalSection` | `globalSections` | Remains separate from templates. |
| `NavigationMenu` | `menus` | Supplies navigation references used by validation. |
| `ThemeConfiguration` | `theme` | Maps theme id/version/settings/draft artifact. |
| `StorefrontTemplateAssignment` | `assignments` | Carries only resource IDs and template IDs. |
| Store commerce/content repositories | `resourceIds` | Supplies product, collection, page, blog, and article identifiers only. No live resource payload is copied into theme state. |
| Metafield/metaobject repositories, when available | definition arrays | Existing compiler contract requires these arrays; absent optional sources normalize to empty arrays. |

The current repository interfaces expose list operations for templates, globals, and menus, but do not expose list-all assignments or resource-ID read models. The local reader needs read-only query methods/adapters for those sources. It must use the same store predicate as the persistence layer and never use editor route responses as a data source.

## Normalization and validation

The reader normalizes only missing optional compiler inputs:

- missing `NavigationMenu`, assignment, metafield-definition, or metaobject-definition collections become empty arrays;
- a missing theme configuration follows the pre-existing local fallback contract selected by the runtime adapter, rather than creating or persisting configuration;
- resource-ID categories always exist as `Set<string>`, even when empty.

It must not repair malformed data. Invalid layouts, section documents, global references, theme settings, assignments, or resource references flow into the existing compiler validation unchanged and yield the existing diagnostics. The reader creates no templates, sections, assignments, defaults, or resource records, and never enriches the workspace with product pricing, inventory, membership, or other live commerce details.

## Generation consistency

The reader captures the workspace generation before collecting records and checks it again after collection. It rejects a request whose expected generation does not match the captured generation through the existing generation-conflict mechanism. If generation changes during the aggregate read, it reports the current generation rather than compiling a mixed result.

The local persistence adapter currently offers independent reads rather than one transactional read snapshot. The before/after generation check detects concurrent mutations but cannot prove an atomic, repeatable snapshot if a mutation commits and is reversed between checks. This limitation is documented; the reader must not claim stronger consistency or alter compiler semantics to hide it.

## Data flow

```text
local store-scoped repositories
  -> normalized V4 workspace reader
  -> StorefrontCompilationInput
  -> StorefrontCompilationService
  -> existing V4 compiler and diagnostics
```

The compiler has no persistence dependency. The reader has no mutation dependency. Draft publication remains a later, separate responsibility.

## Tests and acceptance criteria

Focused tests must prove:

1. Complete reconstruction of templates, defaults/assignments, global sections, settings, generation, resource references, and navigation.
2. Store isolation: records from another store (and a differing theme configuration) never appear in output.
3. Optional absent state normalizes exactly as the compiler contract expects.
4. Invalid stored documents are passed to compilation without reader repair.
5. Reads issue no mutation operations and do not create records.
6. Unchanged state yields equivalent compiler input.
7. Generation changes during collection do not produce a mixed compiler input.
8. A realistic persisted local workspace compiles successfully through `StorefrontCompilationService` and the existing compiler.

## Error behavior

The reader preserves existing validation and generation behavior. It does not translate compiler diagnostics into a local-only format. Missing optional state is represented by the contract defaults above; invalid required state reaches the existing compiler rather than being silently discarded or corrected.
