# Supabase Auth Owner Stores Design

## Goal

Replace Jelly Shops' demo identity and fixed starter stores with real Supabase
email/password accounts. A signed-in user can create and own multiple stores.
Only that owner can access each store's administration data. Public storefronts
remain readable by their public slug.

## Decisions

- Authentication: Supabase Auth email/password only.
- A user can own multiple stores.
- A store has one owner in this release; staff invitations and shared access are
  explicitly out of scope.
- Sweet Bakes, Bloom Home, fixed demo tokens, and reset-demo controls are
  removed from normal application behavior.
- The frontend never receives Supabase secret/service keys or Stripe secret
  keys.
- The Express backend remains the authorization and business-operation boundary
  for catalog, storefront, orders, media, and Stripe Connect.

## Architecture

```text
Browser
  -> Supabase Auth (email/password)
  -> access token
  -> Jelly Shops Express API
  -> Supabase token verification
  -> owner membership lookup in PostgreSQL
  -> store-scoped service/repository
  -> PostgreSQL / Stripe
```

The browser uses the Supabase publishable key only to sign up, sign in, restore
its session, sign out, and begin password recovery. For each protected API
request it sends `Authorization: Bearer <access-token>`.

The backend verifies the access token with Supabase Auth, resolves the internal
merchant row and owner memberships from PostgreSQL, and creates the existing
`MerchantPrincipal` / `StoreRequestContext`. Route middleware continues to
enforce store permissions, but the only granted role in this release is
`OWNER`. A forged store ID cannot cross the ownership check.

Public catalog, public storefront, checkout, and public order-token routes do
not require merchant authentication. They must still scope every read and write
to the store selected by a trusted public store ID or slug.

## Authentication Experience

### Sign up

`/signup` contains email, password, and confirmation password fields. It calls
Supabase `signUp`. The UI clearly explains whether email confirmation is
required by the Supabase project. Once a session is active, the user is sent to
`/admin/onboarding` to create a first store.

### Sign in and sign out

`/login` calls Supabase `signInWithPassword`. A route guard sends unauthenticated
visitors from `/admin/**` to `/login?next=...`. The authenticated shell loads
the owner store list from the backend and exposes a store switcher. Signing out
clears the Supabase client session and redirects to `/login`.

### Password recovery

`/forgot-password` starts Supabase's recovery email flow. `/reset-password`
checks the recovered session and lets the user choose a new password. The
Supabase dashboard must allow the local and production redirect URLs and must
have suitable email delivery configured before production launch.

## Ownership Data Model

The current application has an internal numeric `User` table and a
`StoreMembership` table. A new migration adds `supabaseUserId UUID UNIQUE` to
`User`, referencing `auth.users(id)`. The existing numeric primary key stays in
place so store membership foreign keys and existing repository APIs do not need
a broad rewrite.

`StoreMembership` remains the owner-to-store relationship. New users receive
one `OWNER` membership for each store they create. The owner-store listing query
returns only `OWNER` memberships. No endpoint creates non-owner memberships in
this release.

The migration removes the old Firebase identity column only after all code has
stopped reading it. It never adopts or assigns existing Sweet Bakes/Bloom Home
data to a newly registered person. Demo stores and their dependent data are
removed in a separate, explicit cleanup migration after a backup/export check.

## Backend Changes

### Supabase authentication provider

Replace `DevelopmentAuthProvider` and the Firebase provider selection in normal
runtime with `SupabaseAuthProvider`. It receives a server-side Supabase client
or verifier adapter, calls `auth.getUser(accessToken)`, requires a verified
email, and passes the stable Supabase user UUID, email, and display name to the
tenant repository.

Invalid, expired, missing, or revoked tokens return a consistent `401
AUTH_INVALID`. A Supabase availability failure returns `503 AUTH_UNAVAILABLE`.
The provider must never trust unverified JWT payload fields supplied by the
browser.

### Tenant/store APIs

Add protected endpoints for:

- `GET /api/merchant/stores` — stores owned by the authenticated user.
- `POST /api/merchant/stores` — creates a store and its sole `OWNER`
  membership atomically.
- `GET /api/merchant/me` — minimal identity and current owner-store list for
  the admin shell.

Store creation validates name, unique slug, ISO currency, and country. It also
creates the required store settings/workspace records in one transaction.

All existing `/api/stores/:storeId/**` administrative routes retain
`requireMerchant` and `requireStorePermission`; they will use the Supabase
provider instead of a demo token. The route parameter is authorization input,
not proof of ownership.

### Stripe Connect

Stripe Connect routes continue to require `payments:view` or `payments:manage`.
The onboarding account's display name and country must come from the authorized
store record, not hard-coded demo defaults. A disconnected store can create one
Accounts v2 test/live account under the configured Jelly Shops platform.

## Frontend Changes

Create an isolated `features/auth` module containing the browser-safe Supabase
client, session provider, API token helper, authentication forms, and route
guard. It uses only:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Replace `getDemoSession`, `getMerchantSession`, hard-coded `store-demo`, and
local admin ownership state with the authenticated session plus backend owner
store list. The active store is selected from owned stores and persisted only as
an ID preference; it is revalidated against the backend list on each session.

The local repository may remain temporarily for browser cart state, but it may
not provide admin products, orders, customers, store ownership, or published
store identity. Those views must load the active owner store from the backend.

Remove demo links, demo marketing copy, and reset-demo functionality from the
authenticated user experience. Public routes resolve actual database-backed
store slugs and show a not-found page for removed demo slugs.

## Database and Supabase Security

The Express backend continues using a server-only database connection and
server-only Supabase secret key. Browser clients do not query private commerce
tables directly. Nonetheless, all newly exposed public-schema tables must have
RLS enabled with no permissive `anon` or `authenticated` policies unless a
specific direct-client feature needs one. The backend's database role must be
reviewed separately to ensure it has the intended server access.

Supabase Auth email confirmation, password requirements, and redirect URLs are
configured in the Supabase dashboard. Production uses a custom SMTP provider;
the default provider is acceptable only for development testing.

## Migration Sequence

1. Back up/export the current development data and record existing migration
   history.
2. Add `User.supabaseUserId`, owner-store indexes, and any missing RLS settings.
3. Deploy backend Supabase token verification and owner-store APIs with demo
   authentication disabled outside explicitly isolated tests.
4. Deploy frontend auth screens, session provider, admin guard, onboarding, and
   owner store switcher.
5. Create a fresh user, first store, second store, and verify strict isolation.
6. Remove demo store data and obsolete demo-token/frontend seed code through a
   separate reviewed migration and code change.
7. Configure production Supabase Auth email delivery, redirect URLs, CORS, and
   Stripe production credentials before a live launch.

## Failure Handling

- Missing/expired token: redirect to login on the frontend; `401` from API.
- Auth service unavailable: retryable `503`, no fallback to a demo identity.
- No owned stores: send the authenticated user to create their first store.
- Unknown or unowned store ID: `403 STORE_FORBIDDEN`; do not disclose other
  owners' store data.
- Duplicate slug: `409 STORE_SLUG_TAKEN` with a clear form error.
- Supabase email confirmation pending: show a confirmation message and block
  admin access until email verification succeeds.

## Tests

- Backend provider tests: valid Supabase token, invalid/expired token,
  unverified email, and unavailable verifier.
- Tenant repository and route tests: first-store creation, multiple stores for
  one owner, duplicate slug, and atomic owner membership creation.
- Authorization tests: an owner can access their stores and receives `403` for
  another owner's store across catalog, storefront editor, media, orders, and
  Stripe Connect routes.
- Frontend tests: sign-up/sign-in error handling, protected-route redirect,
  sign-out, no-store onboarding, active-store switch, and no demo controls.
- End-to-end test: user A creates two stores; user B cannot see or mutate
  either; each public storefront remains accessible by its own slug.

## Out of Scope

- Staff invitations, roles beyond owner, teams, and organization accounts.
- Social login, magic links, phone authentication, MFA, and SSO.
- Direct browser access to private PostgreSQL commerce data.
- Migrating old demo orders or assigning demo data to a new user.
