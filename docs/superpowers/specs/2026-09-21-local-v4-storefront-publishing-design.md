# Local V4 Storefront Publishing

## Goal

Make the local Jelly Shop backend support Validate, Preview, and Publish from the Store Editor. A published local V4 snapshot must be readable by the public storefront endpoint.

## Current failure

`createApp()` starts without `storefrontCompilerApi` or `storefrontPublicationApi`. The corresponding routes deliberately return 503, even though the compiler and publication service contracts already exist.

## Design

Add development-only adapters when no production services are injected:

1. A local workspace input loader reads templates, global sections, theme configuration, assignments, and workspace generation from the existing local workspace API/state.
2. A local compiler adapter delegates to the existing `StorefrontCompilationService` and registry validation. It supports Validate and Preview without writing a publication.
3. A local compiled-publication repository persists snapshots by store and idempotency key in the configured data directory. The existing `CompiledStorefrontPublicationService` owns idempotency and publication semantics.
4. A local public-storefront adapter reads only the latest compiled publication. It never exposes an editable template as public output.
5. `createApp()` injects these adapters only when callers have not supplied production compiler/publication/public APIs. Production dependency injection remains unchanged.

## Flow

```text
editor draft workspace
→ local compiler input loader
→ existing compiler
→ Preview response OR publication service
→ local compiled publication repository
→ public storefront endpoint
```

## Error behavior

- Invalid draft: Validate/Preview/Publish return existing 422 diagnostics.
- Generation mismatch: use existing compiler diagnostics; never publish stale state.
- Missing publication: public endpoint returns its normal not-found behavior.
- Production injected services take precedence over local adapters.

## Tests

- local Validate returns a compilation response, not 503
- local Preview returns a snapshot, not 503
- local Publish returns a publication and supports idempotency
- public endpoint returns the published snapshot only after publish
- no production injected service is replaced
