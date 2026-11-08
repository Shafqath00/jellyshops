# Local V4 Storefront Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Validate, Preview, Publish, and public V4 snapshots in local development.

**Architecture:** Add local implementations behind the existing compiler, publication, and public-read interfaces. `createApp` supplies them only when production dependencies are absent.

**Tech Stack:** TypeScript, Express, Vitest, existing storefront compiler and publication services.

**Spec:** `docs/superpowers/specs/2026-09-21-local-v4-storefront-publishing-design.md`

## Global Constraints

- Preserve explicitly injected production APIs.
- Never expose editable templates as public output.
- Keep existing generation, diagnostics, and idempotency behavior.

## Review Focus

- A stale generation must not publish.
- Reusing an idempotency key must reuse the prior publication.
- Preview must not write a publication.
- A store without a publication must remain not-found publicly.
- Supplied production adapters must win over local defaults.

### Task 1: Local compiler adapter

**Files:** Create `backend/src/storefront/local-v4-runtime.ts`; test `backend/src/storefront/local-v4-runtime.test.ts`.

- [ ] Write a failing test asserting `createLocalCompilerApi(directory).compile("store-a", 0)` returns an `ok` compilation result rather than a 503 route fallback.
- [ ] Run `npm test -- --run src/storefront/local-v4-runtime.test.ts` and confirm failure.
- [ ] Implement a local workspace input loader and wrap `StorefrontCompilationService` using the existing registry and dynamic-source resolver.
- [ ] Re-run the focused test and commit `feat: compile local v4 storefront workspaces`.

### Task 2: Local publication storage

**Files:** Modify `backend/src/storefront/local-v4-runtime.ts`; test `backend/src/storefront/local-v4-runtime.test.ts`.

- [ ] Write failing tests for publish success, repeated-key reuse, and a public reader that returns only the published snapshot.
- [ ] Run the focused test and confirm failure.
- [ ] Implement a data-directory-backed `CompiledPublicationRepository`, wrap it with `CompiledStorefrontPublicationService`, and expose a public reader.
- [ ] Re-run the focused test and commit `feat: publish local v4 storefront snapshots`.

### Task 3: Application wiring

**Files:** Modify `backend/src/app.ts`; test `backend/src/app.test.ts`.

- [ ] Write failing route tests that local Preview and Publish are not 503, while an injected production API is preserved.
- [ ] Run `npm test -- --run src/app.test.ts` and confirm failure.
- [ ] Instantiate and inject local adapters only for missing dependencies.
- [ ] Run backend tests and the frontend production build; commit `feat: enable local v4 storefront publishing`.
