# Phase-one tenant and storefront migration

The operational schema is [schema.prisma](../prisma/schema.prisma). The full
commerce design is preserved separately in [commerce.prisma](../prisma/reference/commerce.prisma).
Prisma's configured schema is a single file, so reference models are not included
in normal generation or migration commands. Do not switch the configured schema
to the reference directory.

## Contents and review

[20260905090000_tenant_storefront/migration.sql](../prisma/migrations/20260905090000_tenant_storefront/migration.sql)
extends the existing User-only init migration with six tables: Store,
StoreMembership, StoreSettings, StoreDomain, StorefrontDraft and StorefrontPublication.
The init migration remains unchanged. Catalog, media, checkout, payments and all
other commerce tables are deferred.

The SQL was generated offline from the initial User datamodel and then edited:

- Existing User IDs, names, emails and timestamps are retained. updatedAt is
  backfilled from createdAt before becoming required; firebaseUid remains null.
  No guessed Firebase links, stores or memberships are inserted.
- Composite foreign keys prohibit a store from selecting another store's live
  publication. Membership keys and user/store foreign keys enforce valid links.
- CHECK constraints reject negative draft revisions, publication revisions below
  one, non-object documents and malformed country/currency code casing/length.
  Currency/country checks enforce shape, not membership in an ISO code list.
- Publication triggers reject UPDATE, DELETE and TRUNCATE, including after
  unpublishing. A store with publications cannot be hard-deleted; archive it.
  Controlled retention operations require separately reviewed administrative SQL.
- BEGIN/COMMIT wraps the migration, including the existing-user backfill.

Prisma does not model the custom checks or triggers. Preserve them when generating
later migrations. @updatedAt and UUID defaults are Prisma client behavior: raw SQL
writers must supply those fields. Database owners can disable triggers; runtime
credentials should not own tables or have permission to alter them.

## Verification

Run from backend after npm install:

```powershell
npm run test:migration
.\node_modules\.bin\prisma.cmd validate
.\node_modules\.bin\prisma.cmd validate --schema prisma/reference/commerce.prisma
npm run typecheck
```

The migration test uses an isolated in-memory PGlite PostgreSQL engine and never
reads DATABASE_URL. It applies the original migration, inserts an existing user,
then applies the new SQL. Its 20 checks cover row/sequence preservation, exact table
scope, membership constraints, tenant-safe publication pointers, revision/document
bounds, currency/country shape, unique Firebase identity and immutable history.
It also exercises successful store, membership, settings, domain, draft and
publication writes. This is SQL verification, not a test of Firebase or Prisma
repositories, which are not implemented yet.

## Before deployment

Supabase Postgres is the initial managed database; Google Cloud SQL is no longer
the phase-one target. Firebase remains the authentication provider. Jellyshops
connects through Prisma and does not use Supabase Auth or the browser Data API.

Use DATABASE_URL for runtime application traffic and DIRECT_URL for Prisma
migrations. For the persistent Express backend, start with Supavisor session mode
on port 5432. For migrations, prefer Supabase's direct connection when the runner
supports IPv6, or use session mode on IPv4-only runners. Do not run migrations
through transaction mode on port 6543. Store both URLs only in server-side secret
configuration and require TLS.

Create separate migration and runtime database roles. The runtime role receives
only the table and sequence privileges needed by the application and cannot alter
the schema or disable publication triggers. If the Supabase Data API is unused,
disable it; otherwise do not expose public until RLS has a separate reviewed
design. Never place a database password or Supabase service-role key in Next.js
NEXT_PUBLIC variables.

No Supabase database has been inspected or migrated. Test first on a dedicated
Supabase development project in the same region intended for the backend,
including database version, TLS, roles, permissions, connection limits, migration
history and backfill lock duration. Confirm that the existing init migration is
recorded as applied; do not mark it applied unless the database matches it.

Configure prisma.config.ts to use DIRECT_URL, then use prisma migrate deploy
against the deliberately selected Supabase project. Do not use db push or accept
regenerated SQL that omits the reviewed constraints. Roll forward after deployment
rather than dropping tables. No rollback script is provided because deleting
tenant data/history would be destructive.

Next implement Firebase user lookup, tenant repositories and membership
authorization, then PrismaStorefrontRepository behind the existing service.
Create store plus OWNER membership atomically; protect the final owner in that
service. Draft saves must use compare-and-swap revisions, and publishing must copy
the validated draft and update the live pointer in one transaction. These runtime
guarantees are not supplied by the migration alone.

The default local providers remain active. The generated Prisma client has not
been replaced; regenerate it when implementing the repositories. The current
editor API and document validation contract remain unchanged.
