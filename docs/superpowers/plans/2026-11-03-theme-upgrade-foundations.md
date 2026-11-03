# Theme upgrade foundations implementation plan

**Goal:** Begin Phase 4 with a shared compatibility contract and a non-mutating migration engine, usable by the CLI and backend.

**Spec:** `docs/plans/theme-sdk-plan.md`, sections 3.7 and Phase 4.

**Scope:** This increment does not expose a merchant upgrade button. Side-by-side runtime registries, transactional draft upgrades, saved rollback snapshots and Store designs UI remain the next increment. Existing published snapshots and staging are untouched.

**Architecture:** Keep optional `engines` and `migrations` in the manifest JSON already persisted with immutable packages. Shared version primitives live in storefront-schema, avoiding a themes/registry cycle; the migration engine lives in storefront-themes, exported by theme-sdk. No new dependency is needed. A forward SQL migration aligns package/draft version constraints with SemVer (the backend regression test found the old package constraint only accepted x.y.z).

## Global constraints and decisions

- Existing manifests without `engines` or `migrations` remain valid.
- Platform theme API version starts at `1.0.0`; it is independent of package versions.
- Theme versions use strict SemVer, including prerelease precedence and build metadata.
- `engines.jelly` supports whitespace-separated comparators (`>=1 <2`, `>=1.0.0 <2.0.0`, exact versions). Unsupported syntax is rejected explicitly; no pretending to support npm's entire range language.
- Migration entries are inline in `theme.json`, like recipes: `{from, to, operations}`. This preserves package format 1 and existing JSON storage. Separate migration files may be added later.
- Setting operations target `theme`, `section` or `block`; section/block targets require a type. Section/block type renames apply throughout nested blocks. Dotted paths cannot traverse prototype keys or overwrite an existing destination. Defaults only fill missing values, including when merchant values are false, zero, empty or null.
- The migration engine consumes `{settings, sections}`: the upgrade service will gather global and inline draft sections into this representation. It returns a clone and a path-based diff; it never saves or publishes anything.

## Review focus

Prerelease ordering; invalid/unsupported engine ranges; missing or ambiguous migration chains; destination conflicts and prototype paths; nested blocks and preservation of false/zero/null values.

### Task 1: Compatibility contract

- [x] Add failing tests for SemVer ordering, engine validation, legacy manifests and shared project diagnostics.
- [x] Add `theme-version.ts`, optional manifest engines, exported SDK helpers, generated schemas and scaffold range.
- [x] Verify the focused tests and package builds.

### Task 2: Migration dry run

- [x] Add failing tests for all five operations, chains, conflicts, nested blocks, immutable input and invalid manifests.
- [x] Add `migrations.ts`, strict schemas, manifest integration and SDK exports. Scan migration values with existing executable-content checks.
- [x] Verify focused tests and generated schema freshness.

### Task 3: Upload and install enforcement

- [x] Add failing backend tests for incompatible installs, SemVer ordering and breaking version changes without migration paths.
- [x] Use the shared comparator; require a major bump for removed/changed setting types and removed recipes, and a migration path from the latest upload for a major bump. Check engines before install writes.
- [x] Repack shared packages, verify backend/frontend typechecks and affected suites, review changes, update roadmap and developer guide.

## Verification

- Affected frontend/schema/registry/themes/SDK/CLI suites: **400 passed**, 46 files.
- Affected backend package/workspace/theme-library/starter/compiler suites: **80 passed**, 14 files.
- Frontend and backend `npm run typecheck`: passed.
- Shared package builds, JSON Schema freshness and `git diff --check`: passed.
- Independent review completed; regression tests reproduced and verified fixes for responsive overrides, concurrent uploads, prerelease plus build starter installation, JSON Schema grammar and opaque node type names. The SQL migration's preflight and runtime numeric/length limits are covered with local PGlite queries. No staging changes or remote inventory were made.
- This was a focused regression run, not a rerun of the entire application suite or browser staging journey.

## Review decisions

- Keep the documented, bounded engine grammar rather than adding a dependency for npm's whole range language; unsupported shorthand fails explicitly.
- Keep migrations inline for package-format compatibility; a future file loader can populate the same declarations.
- Apply setting renames/removals to existing responsive overrides; defaults stay on base settings so overrides keep inheriting.
- Serialize uploads in one transaction with a per-theme advisory lock; read-only adapters without transaction support cannot upload.
- Enforce strict SemVer at rollout with an atomic preflight. No remote inventory or migration was performed. If legacy invalid rows exist, rollout is blocked until an explicit data policy is agreed; immutable versions are never silently rewritten.
- The existing newest-wins runtime registry, persistent upgrades/rollback and merchant UI remain explicitly outside this increment. Without those, installing a newer starter still replaces draft content rather than migrating it.
