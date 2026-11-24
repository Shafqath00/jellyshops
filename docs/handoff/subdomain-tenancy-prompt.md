# Prompt for the developer's Claude: shop subdomains on jellyshop.io

Copy everything below the line into the other developer's Claude session, from the repo root, on branch `redesign/jelly-shop-ui`.

---

You are joining the Jellyshop repo (multi-tenant shop platform). Your task is to implement shop subdomains: `{shop}.jellyshop.io` for each public storefront, `{shop}.jellyshop.io/admin` for that shop's owner dashboard, `admin.jellyshop.io` for the platform super-admin only, and `jellyshop.io` / `www` for marketing and sign-up.

## Read first, in this order
1. `CLAUDE.md` at the repo root (project memory, gotchas, working agreements).
2. `docs/plans/2026-11-22-subdomain-tenancy-plan.md`: the full design and 14 implementation steps. This is the spec. It has been inspected against the real repo, so follow it rather than the generic multi-tenant advice you may know.
3. `jellyshops/node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`. This is Next.js 16, where middleware is called **Proxy** (`src/proxy.ts`, Node runtime, no `runtime` option). Another change already added a `src/proxy.ts` (password gate for storefronts), so extend it rather than creating a second file.

## Rules of engagement
- **Do not change code until the owner has answered the open questions** (listed below). If they are not answered, ask the owner and wait.
- Work in small, reviewable steps, one commit each (`feat:` / `fix:` / `test:` / `chore:`), in the order of the plan's "Implementation steps". Finish a step, run tests, commit, report, then ask before the next.
- **Ask before writing to the staging database** (Supabase project `ayvpxqwleurhkfyujzlu`), before applying any migration, and before pushing or merging. Migrations go in both `backend/sql/migrations` and `backend/supabase/migrations`, and are listed in `backend/test/integration/pglite.ts`. Every new table needs RLS on plus a `jelly_backend_access` policy, and no browser grants.
- Never type real passwords into forms; the owner signs in themselves. Never put secrets in docs or commits. `.env` files are git-ignored.
- The Vercel and DNS steps (plan section 1, step 13) are done by the owner in the dashboard. Give them a checklist; do not try to do them.
- Commit only your own files with explicit `git add` paths. Leave `jellyshops/.env.local`, `next-env.d.ts`, `tsconfig.json`, `.playwright-mcp/` and `*.stackdump` alone (Next rewrites two of them on start; `git checkout` them before committing).
- Backend uses packed copies of the shared packages. After changing `storefront-schema`, `-registry` or `-themes`: `node scripts/prepare-shared-packages.mjs`, then `cd backend && rm -rf node_modules/@jelly && npm install`.
- Repo is LF; do not introduce CRLF.

## Facts you must not get wrong
- Tables already exist: `Store` (unique `slug`), `StoreMembership (storeId, userId, role)`, `StoreDomain` (unused so far). Do not create `shops` or `memberships`. Tenant tables already carry `storeId`.
- Sign-in is `@supabase/supabase-js` in the browser with localStorage sessions (no cookies). Sessions are therefore per host. The plan's sign-in hand-off (one-time `token_hash` through `/auth/continue`) bridges `jellyshop.io` to `{shop}.jellyshop.io`.
- The backend (Express on Firebase Functions, raw `pg`) already checks membership on every `/api/stores/:storeId/...` route. "RLS by `auth.uid()`" would protect nothing today because the browser never queries Postgres. Database-level scope (plan section 5A) is a separate project, only if the owner approves it.
- Store pages live in `jellyshops/src/app/[storeSlug]/` and links are built by hand in about 57 places as `` `/${storeSlug}/…` ``. They must all move to one `storePath()` helper, with a test that fails if the old pattern returns.
- Store pages are ISR-cached (see `CLAUDE.md`, "Storefront speed and cost"). **Never read headers, cookies or searchParams in the store layout or in a cached store page.** Host handling belongs in the proxy, which rewrites to `/sites/<slug>`.
- `RESERVED_STORE_SLUGS` (backend `tenants/store-slug.ts`) is kept in sync with top-level app routes by a test; extend that list and keep the test green.

## Open questions for the owner (ask them, do not guess)
1. Keep the shop admin at `{shop}.jellyshop.io/admin`, or put it on its own origin (plan section 12, item 1; safer, but differs from the brief)? If kept, a strict CSP on `/admin` is mandatory.
2. Sign-in hand-off with browser sessions first (recommended), or move to `@supabase/ssr` cookies now?
3. Is database-level tenant scope (plan 5A) part of this project or a later one?
4. After a shop renames its address, reserve the old address forever, or free it after 12 months?
5. Vercel plan (Hobby / Pro / Enterprise)? Can `jellyshop.io` nameservers move to Vercel, and does the domain have MX/email records to copy over first?

## Start by
Reading the three files above, confirming the open questions with the owner, then reporting back a short summary of what you understood and which step you will start with (step 1: host parsing library `src/lib/hosts.ts` with unit tests, no behaviour change). Do not start step 4 (the route move and proxy) until steps 1 to 3 are merged, because it changes every store URL.

When a step is done, state plainly what was verified and what was not, and update the "State of the work" section of `CLAUDE.md` with a short paragraph for that step.
