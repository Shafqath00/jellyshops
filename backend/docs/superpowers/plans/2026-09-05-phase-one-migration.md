# Phase-one database implementation plan

**Goal:** Prepare the tenant and storefront migration without activating runtime providers.

**Architecture:** Keep the full commerce target in prisma/reference/commerce.prisma.
Use prisma/schema.prisma as the operational phase-one schema, preserving the
existing User integer primary key and storefront document contracts.

**Tech stack:** PostgreSQL, Prisma 7, existing Node backend.

**Spec:** ../../commerce-data-model.md

## Steps

- [x] Preserve the commerce target and restrict the active schema to User, Store,
  StoreMembership, StoreSettings, StoreDomain, StorefrontDraft and
  StorefrontPublication. Defer logo media and all commerce relations.
- [x] Generate SQL from the initial User schema to the phase-one schema using
  Prisma migrate diff with schema file inputs; no database connection.
- [x] Backfill User.updatedAt from createdAt before setting NOT NULL. Add revision
  bounds, JSON object checks and immutable-publication update/delete/truncate
  triggers in an explicit transaction. Preserve existing init SQL.
- [x] Validate both schemas and inspect generated SQL for unexpected tables or
  destructive operations. Exercise migrations against an isolated PostgreSQL
  engine if available, including existing-user preservation, cross-store live
  pointers, revision checks and publication mutation rejection.
- [x] Document deployment boundaries and the next repository implementation.

## Constraints

No live database migrations, provider activation, generated-client replacement,
checkout, payment or catalog implementation. Keep existing local runtime behavior.
Only migration-specific verification is added; no unrelated code refactoring.
