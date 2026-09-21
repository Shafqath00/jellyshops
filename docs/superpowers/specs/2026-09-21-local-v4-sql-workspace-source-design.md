# Local V4 SQL Workspace Source Design

## Goal

Connect the accepted normalized V4 workspace reader to real local SQL persistence without changing the compiler-facing reader contract or introducing publication behavior.

## Architecture

Add a concrete `LocalV4WorkspaceDataSource` implementation/factory. It owns read-only, `storeId`-scoped SQL and existing repository/service reads. `LocalV4WorkspaceReader` remains the sole adapter from persisted records to `StorefrontCompilationInput`; `StorefrontCompilationService` and the existing V4 compiler remain the sole validation and compilation path.

```text
SQL/repositories -> LocalV4WorkspaceDataSource -> LocalV4WorkspaceReader
  -> StorefrontCompilationInput -> StorefrontCompilationService -> compiler
```

## Identity and scope

The workspace key remains `storeId`. All SQL queries bind that ID, and resource readers receive it as their first argument. `ThemeConfiguration.themeId` describes the selected theme but is not a workspace key. The current schema therefore supports only one installed editable theme per store; multi-theme work requires a future schema and identity migration.

## Data source responsibilities

The adapter reads `StorefrontWorkspace`, `StorefrontTemplate`, `GlobalSection`, `NavigationMenu`, `ThemeConfiguration`, and `StorefrontTemplateAssignment`. It obtains only product, collection, page, blog, and article IDs from existing store-scoped catalog/content accessors. It returns optional missing collections faithfully for reader normalization.

It never compiles, validates theme semantics, repairs malformed documents, creates templates, resolves live commerce payloads, or publishes snapshots. Persisted JSON documents are returned unchanged enough for existing compiler diagnostics.

## Generation and wiring

The source exposes plain workspace generation reads. The reader retains its existing before/after generation checks and throws `WorkspaceGenerationConflictError`; the SQL source adds no competing consistency policy.

Backend dependency construction explicitly creates one source, one reader, and one `StorefrontCompilationService` for local V4 compilation. Routes consume that service via the existing compiler API boundary. Publication repository/service wiring remains out of scope.

## Verification

PGlite integration coverage persists representative Store A Home and Product/Collection templates, default handles, assignment, announcement/header/footer globals, theme configuration, generation, and resource IDs. It proves Store A SQL source -> reader -> existing compiler creates a valid snapshot while Store B rows never appear. Additional cases cover optional absent collections, generation conflict propagation, malformed persisted documents reaching compiler diagnostics, and explicit local compiler dependency construction.

## Non-goals

No compiler changes, reader bypasses, publication storage, current-publication activation, or public-storefront behavior changes.
