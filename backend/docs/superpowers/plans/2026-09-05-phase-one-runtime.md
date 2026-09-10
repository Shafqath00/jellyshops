# Phase-one runtime implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Firebase-authenticated merchant create a store, access it through
database memberships, and save/publish storefront documents in Supabase Postgres.

**Architecture:** Keep Express and the existing StorefrontService and
StorefrontRepository contracts. Add Firebase identity verification and Prisma
repositories connected to a dedicated Supabase Postgres project. Local development
continues to use demo auth and JSON storage; Supabase Auth and the Data API are not
part of the application architecture.

**Tech stack:** Supabase-managed PostgreSQL, existing Prisma 7.10/pg adapter,
Express 5, TypeScript, Vitest, and Firebase Admin SDK (new dependency).

**Spec:** [Commerce data model](../../commerce-data-model.md) and
[prepared migration](../../phase-one-migration.md).

## Global constraints

- Supabase Postgres is the initial managed database; Firebase Authentication is
  the merchant identity provider.
- Prisma is the server-side database access layer. No database URL, password or
  Supabase service-role key may enter browser code or a NEXT_PUBLIC variable.
- DATABASE_URL is the least-privileged runtime connection. DIRECT_URL is the
  migration connection and must never be used by the application server.
- Existing editor API routes and storefront document response shapes remain stable.
- No production migration, provider switch or credential change is authorized by
  this implementation plan.

---

This is the next implementation plan, not implemented runtime behavior.
Execute the tasks below in order in the current session when implementation is
requested. No deployment or live migration is implied.

## Decisions and scope

- Supabase replaces Google Cloud SQL as the initial managed PostgreSQL provider.
  The Prisma schema, SQL migrations, repository interfaces and tenant model stay
  provider-neutral so a later PostgreSQL move does not change domain code.
- Firebase Authentication remains the only merchant identity provider. Do not
  create parallel Supabase Auth users or put a Supabase service-role key in the
  browser. Disable the Supabase Data API if it is unused; otherwise remove public
  from its exposed schemas until a separate RLS policy design is complete.
- Use separate secrets: DATABASE_URL for application traffic and DIRECT_URL for
  migrations and administrative checks. Start the persistent Express backend on
  Supavisor session mode (port 5432), which supports session semantics and IPv4.
  Prefer a direct connection for migrations when the deployment runner has IPv6;
  otherwise use the session pooler. Never migrate through transaction mode 6543.
- If the backend later moves to highly autoscaled or short-lived compute, evaluate
  Supavisor transaction mode (6543) for DATABASE_URL, including prepared-statement
  compatibility and connection limits. That is a deployment change, not phase one.
- Create distinct database roles: jellyshops_migrator owns/applies schema changes;
  jellyshops_runtime receives only CONNECT, schema USAGE and required table/sequence
  DML. The runtime role must not create, alter, drop or disable triggers.
- Cloud mode uses Firebase plus Prisma together. Reject Firebase/local-json and
  development/Prisma combinations unless both adapters are explicitly injected
  by a test. Reject production demo auth even with dependency injection.
- Require verified email for onboarding because User.email is currently required
  and unique. Existing users are resolved by firebaseUid, never silently linked
  by email. An email collision with another UID or an unlinked legacy row returns
  409 ACCOUNT_LINK_REQUIRED. An administrative linking workflow is separate work.
- Auto-provision a User on the first verified request, with zero memberships.
  Never auto-provision a store or grant access based on token custom claims.
- Store creation always starts in NATIVE mode. SHOPIFY remains a schema option
  but is not selectable through phase-one APIs.
- No invitation, membership editing, ownership transfer, domain verification,
  settings editing, catalog, checkout, GCS or frontend implementation in this slice.
  With no membership deletion API, final-owner removal is not exposed.
- Local media remains available on durable local storage; GCS selection fails
  explicitly until implemented. This slice does not make image hosting suitable
  for ephemeral production instances.
- Keep storefront URLs, revision request bodies and record response shapes.
  Firebase bearer-token acquisition is a separate frontend authentication task.

## Current code findings

1. src/config.ts validates Firebase and database variables but omits them from
   AppConfig. src/app.ts always falls back to development/local adapters even
   when configuration requests cloud providers.
2. requireStoreAccess only checks storeIds. Membership roles currently have no
   representation or enforcement in MerchantPrincipal.
3. DefaultStorefrontService.saveDraft catches repository failures and converts
   them to DOCUMENT_INVALID. Narrow that catch to document parsing.
4. prisma-client output is outside tsconfig.rootDir. Move the operational
   generator output to src/generated/prisma and exclude generated sources from
   test discovery; compile them into dist/generated/prisma.
5. src/server.ts owns no database cleanup yet. Preserve the user's existing
   server edits while adding shutdown of resources.
6. README.md currently contains only a plus sign in the working tree. Do not
   overwrite that unexplained change. Put this slice's documentation in
   docs/phase-one-runtime.md instead.
7. The backend's file dependency points to a sibling Git repository. Local builds
   can compile that package first, but a backend-only cloud build will not contain
   the sibling path. Before deployment, either build from a parent context that
   includes both projects or publish/version the shared package and replace the
   file dependency. Do not copy source into two independently maintained packages.

## Task 1: Database client and executable integration fixture

**Files:** prisma/schema.prisma, prisma.config.ts, src/database/client.ts,
src/database/client.test.ts, src/generated/prisma (generated), package.json,
package-lock.json, .gitignore, test/integration/database.ts,
vitest.integration.config.ts.

**Interface:**

```ts
import type { PrismaClient } from "../generated/prisma/client.js";

export interface DatabaseResource {
  client: PrismaClient;
  close(): Promise<void>;
}
export function createDatabase(databaseUrl: string): DatabaseResource;
```

- [x] Point the operational generator to ../src/generated/prisma. Leave the
  full commerce reference generator untouched. Add prisma:generate script and
  call it before typecheck/build in CI; ignore generated source in Git.
- [x] Use the installed PrismaPg adapter and one PrismaClient per runtime.
  Verify adapter connection ownership against its installed API; close the pool
  exactly once. Default the application pool conservatively for the selected
  Supabase compute tier and document how to monitor connections. Do not log
  connection strings or enable SQL parameter logging.
- [x] Change prisma.config.ts to read DIRECT_URL for migration commands while
  src/database/client.ts reads DATABASE_URL. Validate both as postgresql URLs,
  require TLS for non-loopback hosts and redact credentials in all errors.
- [x] Add an integration harness requiring TEST_DATABASE_URL pointed to a
  disposable local PostgreSQL database. Refuse non-loopback hosts and require
  database name jellyshops_test. Do not use DATABASE_URL as fallback.
- [x] Create a unique schema per test suite, apply the two migration SQL files
  with that schema in search_path, and connect Prisma to that schema. Teardown
  drops only the exact generated schema. Never truncate publication tables.
- [x] Test connection, read/write and repeat-safe close. Keep npm run
  test:migration as the fast PGlite SQL check, but run repository concurrency
  tests against actual PostgreSQL using separate connections.
- [x] Verify npm run build then node index.js in local mode serves /health.
  Resolve generated import/output paths before implementing repositories.
- [x] Give @jelly/storefront-schema a Node-compatible ESM build while retaining
  its TypeScript development export for Next.js. Add explicit .js specifiers to
  emitted ESM, compile it before backend/frontend production builds, and run a
  built-server health smoke test. Record the sibling-package deployment boundary.

**Exit:** A generated phase-one Prisma client runs from compiled JavaScript,
accepts the Supabase session-pooler URL, and the integration suite can isolate
database state without touching the Supabase project.

## Task 2: Tenant repository and atomic store creation

**Files:** src/tenants/types.ts, src/tenants/repository.ts,
src/tenants/prisma-tenant-repository.ts, test/integration/tenants.test.ts.

**Interfaces:**

```ts
export type StoreRole = "OWNER" | "ADMIN" | "DESIGNER" | "ORDER_MANAGER" | "STAFF";
export interface VerifiedMerchantIdentity {
  uid: string;
  email: string;
  name: string;
}
export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  currency: string;
  country: string;
  role: StoreRole;
}
export interface MerchantAccount {
  id: number;
  stores: StoreSummary[];
}
export interface CreateStoreInput {
  name: string;
  slug: string;
  currency: string;
  country: string;
}
export interface TenantRepository {
  resolveMerchant(identity: VerifiedMerchantIdentity): Promise<MerchantAccount>;
  listStores(userId: number): Promise<StoreSummary[]>;
  createStore(userId: number, input: CreateStoreInput): Promise<StoreSummary>;
}
```

- [x] Write integration cases for an existing UID, new verified identity,
  concurrent same-UID onboarding, conflicting email, no-membership users and
  archived-store filtering.
- [x] Resolve by UID first. For existing UID, preserve stored profile fields in
  this phase. For a new UID, create with verified identity fields; on P2002,
  reread by UID and succeed only if that exact UID exists. Otherwise return
  ACCOUNT_LINK_REQUIRED without revealing another account's details.
- [x] Load non-archived store memberships afresh on each authenticated request.
  No cross-request membership cache and no custom-claim store access.
- [x] Create Store, StoreSettings with UTC timezone, and OWNER membership in one
  transaction. Set commerceProvider=NATIVE in code, ignoring no client field:
  reject extra request fields instead. Return the created StoreSummary.
- [x] Test duplicate slug returns 409 STORE_SLUG_TAKEN and leaves no orphan
  membership/settings/store. Test invalid user FK rolls back all writes.
- [x] Test a user with multiple memberships sees only their stores and role.
  User lookup itself must never alter an existing user's access.

## Task 3: Firebase provider and role-aware middleware

**Files:** src/auth/firebase-token-verifier.ts,
src/auth/firebase-auth-provider.ts, src/auth/types.ts,
src/auth/development-auth-provider.ts, src/auth/middleware.ts,
src/auth/firebase-auth-provider.test.ts, src/auth/middleware.test.ts,
src/storefront/routes.ts, src/media/routes.ts, package manifests.

**Interfaces:**

```ts
export interface FirebaseTokenVerifier {
  verify(token: string): Promise<{
    uid: string;
    email?: string;
    emailVerified: boolean;
    name?: string;
  }>;
}
// Extend the existing principal; keep merchantId and storeIds.
export interface MerchantPrincipal {
  merchantId: string;
  storeIds: string[];
  storeRoles: Record<string, StoreRole>;
}
export type StorePermission = "storefront:read" | "storefront:write" | "media:read" | "media:write";
// Keep a no-argument call valid for membership-only authorization.
export function requireStoreAccess(permission?: StorePermission): RequestHandler;
```

- [ ] Add Firebase Admin using its current compatible package release; record the
  version and lockfile. Use a named app with application-default credentials and
  configured project ID. Isolate SDK calls behind FirebaseTokenVerifier.
- [ ] Verify client ID tokens with verifyIdToken(token, true), including revocation
  checking. Do not accept custom tokens, decoded-but-unverified JWTs, or demo
  tokens. Reject Firebase emulator configuration in production.
- [ ] Map missing/malformed/expired/revoked/disabled-user authentication to
  401 AUTH_INVALID. Map missing/unverified email to 403 EMAIL_VERIFICATION_REQUIRED.
  Network/credential verification failures return 503 AUTH_UNAVAILABLE; database
  errors must not become authentication failures. Never send SDK details/tokens.
- [ ] Normalize verified email by trimming and lowercasing for new accounts; use
  verified name when nonblank and otherwise an empty name. Do not use a name or
  UID supplied in the request body.
- [ ] Build the principal using String(account.id), membership-derived storeIds
  and storeRoles. Give the demo merchant OWNER for its demo store.
- [ ] Allow OWNER/ADMIN/DESIGNER to read/write storefront and media; allow STAFF
  and ORDER_MANAGER read access only. Missing roles deny permission. Preserve
  403 STORE_FORBIDDEN for denied store access. Test each role and operation.
- [ ] Apply write checks to draft PUT, publish POST, media POST/DELETE; apply read
  checks to draft/media GET. Keep published storefront GET public.
- [ ] Test invalid token makes no repository call, valid token resolves the
  correct UID, forged store claims grant nothing, and removed memberships
  disappear on the next request. Update test principals to include storeRoles.

**Boundary:** Membership changes during an already-authorized in-flight request
take effect on the next request in this slice. Future access-management endpoints
must define stronger revocation semantics if required.

## Task 4: Prisma storefront repository and failure semantics

**Files:** src/storefront/prisma-repository.ts,
src/storefront/service.ts, src/storefront/service.test.ts,
test/integration/storefront.test.ts. Preserve repository.ts and types.ts contracts.

**Transaction design:**

```ts
// Both saveDraft and publish lock the same Store row first.
// Use a tagged, parameterized query inside Prisma $transaction:
const rows = await tx.$queryRaw<Array<{ id: string }>>`
  SELECT id FROM "Store"
  WHERE id = ${storeId} AND "archivedAt" IS NULL
  FOR UPDATE
`;
```

- [ ] Write real PostgreSQL cases before implementation: simultaneous first
  saves at revision zero, simultaneous edits at the same revision, save racing
  publish, and publication-pointer failure rolling back the inserted snapshot.
- [ ] Use READ COMMITTED transactions with the shared Store row lock. After
  locking, read the draft and compare current revision (missing means zero).
  Mismatch throws existing DraftConflictError(currentRevision).
- [ ] Missing/archived store throws 404 STORE_NOT_FOUND on repository writes and
  draft reads; public reads return null. Authenticated routes normally reject
  absent memberships first, without exposing another store's existence.
- [ ] A save creates revision one if no draft exists, otherwise increments once.
  Guard PostgreSQL integer overflow and return 409 REVISION_LIMIT_REACHED.
  A publish requires an existing revision >= 1, copies its document, inserts a
  UUID publication, and changes Store.currentPublicationId in the same transaction.
- [ ] Retry only retryable database deadlock/transaction conflicts (P2034), at
  most three total attempts. Re-read the draft on retry; never retry a stale
  revision conflict. Exhaustion returns 503 DATABASE_BUSY.
- [ ] getPublic reads only the current publication pointer of an active store.
  Return ISO timestamp strings and existing record field names.
- [ ] Test two same-revision saves produce exactly one success and one 409.
  Test concurrent publishes each leave an immutable snapshot (existing behavior
  permits repeated publishing of the same revision); live pointer refers to a
  committed snapshot. Test save/publish results reflect a serial ordering.
- [ ] Prohibit changing publication rows in application code; integration tests
  also confirm database triggers reject mutation.
- [ ] Narrow DefaultStorefrontService.saveDraft try/catch to validator.parse.
  Await repository.saveDraft outside that catch. Validator errors stay 422;
  repository errors preserve ApiError codes or become generic 500.
- [ ] Add tests proving an invalid document does not call persistence and a
  database failure never becomes DOCUMENT_INVALID. Bound incoming
  expectedRevision to signed 32-bit integer range in routes.

## Task 5: Merchant onboarding HTTP surface

**Files:** src/tenants/routes.ts, src/tenants/routes.test.ts,
test/integration/merchant-flow.test.ts.

**Endpoints and responses:**

| Endpoint | Authentication | Response |
|---|---|---|
| GET /api/me | Firebase | 200 { merchantId, stores: StoreSummary[] } |
| GET /api/stores | Firebase | 200 { stores: StoreSummary[] } |
| POST /api/stores | Firebase | 201 { store: StoreSummary } |

- [x] Use requireMerchant to provision/resolve the account before these handlers.
  Parse numeric merchantId strictly as a positive safe integer for tenant calls.
- [x] Validate POST with strict Zod object: name trimmed length 1–120; slug
  lowercase, 3–63 characters, letters/digits separated by single hyphens;
  currency uppercase three letters; country uppercase two letters. Currency and
  country validation checks shape only; document that limitation.
- [x] Return 400 REQUEST_INVALID with field issues for malformed input,
  409 STORE_SLUG_TAKEN for collisions. Never accept ownerId, memberships, role,
  firebaseUid or commerceProvider from clients.
- [x] No tenant routes in demo/local mode; existing demo storefront endpoints
  remain functional. Mount tenant routes only when cloud dependencies exist.
- [x] End-to-end integration with a fake token verifier plus real PostgreSQL:
  new merchant -> empty list -> store creation -> owner list -> first draft save
  -> publish -> unauthenticated public read. A second merchant must receive 403
  for the first merchant's private draft/save/publish/media endpoints.
- [x] Verify archived stores are absent from lists and public reads.

## Task 6: Provider selection, shutdown and deployment documentation

**Files:** src/config.ts, src/config.test.ts, src/runtime.ts,
src/runtime.test.ts, src/app.ts, src/app.test.ts, src/server.ts,
docs/phase-one-runtime.md, package.json.

**Interfaces:**

```ts
export interface Runtime {
  app: Express;
  close(): Promise<void>;
}
export async function createRuntime(config: AppConfig): Promise<Runtime>;
```

- [ ] Extend AppConfig with optional firebaseProjectId/databaseUrl and keep
  DIRECT_URL migration-only in prisma.config.ts. Retain strict provider-specific
  validation and avoid secrets in thrown config messages.
- [ ] createRuntime constructs cloud SDK/database resources only in cloud mode.
  Call Prisma $connect before listening so database startup failure is explicit.
  Close already-created resources on partial initialization failure.
- [ ] Keep createApp synchronous and dependency-injectable. Local defaults are
  allowed only when local providers were selected. Missing cloud dependencies
  must throw rather than instantiate DevelopmentAuthProvider or local JSON.
- [ ] Add optional tenantRepository dependency and mount the onboarding router
  only in cloud mode. Reject unimplemented GCS instead of silently using files.
- [ ] Server awaits runtime creation, listens, then shuts down HTTP and database
  on SIGINT/SIGTERM. Guard repeated signals; allow 10 seconds for graceful close,
  then force close connections and exit nonzero. Preserve existing server edits.
- [ ] Test provider matrix, missing configuration, startup cleanup, repeated close
  and production demo/emulator rejection. Confirm local tests need no Firebase
  credentials or database connection.
- [ ] Document Supabase project creation, region selection near the backend,
  migration/runtime roles, session/direct connection strings, TLS, migration
  deploy before provider switch, generated-client/build steps, Firebase ADC,
  role matrix, email linking behavior and HTTP examples.
  Existing JSON drafts need an explicit import process; no automatic import here.
- [ ] Include a staging smoke test using a dedicated Supabase project and a real
  Firebase ID token. Confirm migration history, publication triggers and runtime
  role restrictions. No production provider switch, external account creation or
  credential changes as part of implementation.

## Acceptance and verification

Run unit and integration tests separately so missing integration configuration is
reported as a missing release check, never silently counted as a pass:

```powershell
npm run prisma:generate
npm run typecheck
npm test
npm run test:migration
npm run test:integration
npm run build
```

Implement test:integration using the dedicated Vitest config and the explicitly
configured disposable TEST_DATABASE_URL. Its suite must fail fast if unavailable.

Done means a staged Firebase merchant can create a store, see only their memberships,
save/publish through Prisma, and read the resulting public snapshot. The editor
storefront API is unchanged; local demo mode still passes its existing tests.
Actual Firebase staging verification and production migration remain separately
reported if credentials/environment are unavailable.

## Primary references checked for this plan

- [Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens):
  verify client SDK ID tokens through Admin SDK.
- [Firebase session revocation](https://firebase.google.com/docs/auth/admin/manage-sessions):
  revocation checking requires verification with checkRevoked enabled.
- [Prisma 7 transactions](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions):
  transaction isolation and bounded retries for P2034 conflicts.
- [Supabase Postgres connections](https://supabase.com/docs/guides/database/connecting-to-postgres):
  direct, session-pooler and transaction-pooler connection choices.
- [Supabase with Prisma](https://supabase.com/docs/guides/database/prisma):
  Prisma roles and connection configuration for Supabase Postgres.
