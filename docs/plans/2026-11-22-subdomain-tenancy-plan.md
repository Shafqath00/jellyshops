# Shop subdomains on jellyshop.io: design and implementation plan

Status: **approved with the decisions below; step 1 in progress.**
Date: 2026-11-22. Vercel facts were checked against vercel.com/docs on this date.

## Owner decisions (2026-11-22)

These override the sections further down where they differ.

1. **The shop admin is on its own origin**, not `{shop}.jellyshop.io/admin` (§12 item 1). Merchants use `admin.jellyshop.io` for every shop they belong to; the platform super-admin moves to **`platform.jellyshop.io`** (default chosen while the owner had not named one; easy to change in `src/lib/hosts.ts`). Shop subdomains serve the storefront only. Consequences: no admin rewrite on shop hosts (§2), the `x-jelly-shop` header and the per-shop no-access page become "pick a shop" inside the admin host (§6), the "Manage shop" pill links to `admin.jellyshop.io` (§6), the `/admin` CSP is still wanted but no longer a precondition (§8).
2. **Sign-in hand-off with browser sessions** (§6 option 1). With the admin on one origin, the hand-off is only needed from `jellyshop.io` (sign-up/onboarding) to `admin.jellyshop.io`; no per-shop hand-off.
3. **Database-level tenant scope (§5A) is a later, separate project.** Step 12 is out of scope.
4. **Retired shop addresses are reserved forever** (§10): they keep redirecting and are never given to another shop.
5. **Hosting:** Vercel Hobby (free) plan; the domain's nameservers will point to Vercel; there are no MX/email records to copy. Note: Vercel's Hobby plan is for personal, non-commercial use, so a paid plan will be needed before shops trade for real; Hobby also caps custom domains at 50 per project (fine for the wildcard, a limit for §11).

## 0. What the repo looks like today (this changes the brief)

Several parts of the brief assume a different stack from what this repo has. The plan follows the repo.

| Area | What is there now | What it means for this work |
| --- | --- | --- |
| Next.js | **16.3.3**, React 19.2. In Next 16, Middleware is called **Proxy** (`src/proxy.ts`, Node.js runtime by default, no `runtime` option). There is no proxy file yet. | We write `src/proxy.ts`, not `middleware.ts`. `fetch` caching options do nothing inside Proxy. |
| Store pages | `src/app/[storeSlug]/...` (home, products, collections, cart, checkout, account, order, pages, search, not-found, etc.). The layout loads the store by slug and calls `notFound()` if it is missing. Published data is cached 30 s with tag `storefront:<slug>`. | Unknown shops already 404 cheaply. The store address is read from the path, and about **57 places** build links as `` `/${storeSlug}/...` ``. These must all go through one helper, or links break on a subdomain. |
| Admin | `src/app/admin/...`. It runs in the browser. The store comes from a list the merchant belongs to; the chosen store is remembered in localStorage (`jelly-active-store:<user>`). There is no `"use server"` anywhere. | `/admin` has to take its store from the address instead of a picker. The real access check already happens in the backend on every API call. |
| Marketing | `/`, `/login`, `/signup`, `/onboarding`, `/changelog`, `/auth/*`, `/theme-preview/*`. | These pages stay on the apex domain only. |
| Sign-in | `@supabase/supabase-js` 2.116 in the browser. Merchant and shopper sessions are kept in **localStorage** (PKCE). `@supabase/ssr` is not used, and there are no auth cookies. | localStorage belongs to one origin, so sessions are already per host. The catch: someone who signs in on `jellyshop.io` is **not** signed in on `myshop.jellyshop.io`. See §6. |
| API | Separate **Express 5 backend on Firebase Functions**, using raw `pg`. Every merchant route is `/api/stores/:storeId/...` behind `requireMerchant` + `requireStorePermission`, and every query takes `storeId`. CORS uses an explicit origin list, and production refuses `*`. | Membership checks already run on every admin request. CORS needs to allow `https://<slug>.jellyshop.io` under a strict pattern. |
| Database | Tables `User` (with `firebaseUid` = Supabase user id), `Store` (`slug` unique), `StoreMembership (storeId, userId, role MembershipRole: OWNER/ADMIN/DESIGNER/ORDER_MANAGER/STAFF)`, **`StoreDomain` (hostname, verifiedAt), which exists but no code uses it**. Tenant tables already carry `storeId`. | We do **not** create new `shops` or `memberships` tables. We extend what exists (§4). |
| RLS | Every table has RLS on. The browser has no grants. The backend logs in as role `jelly_backend` with policy `USING (true)`. The browser never queries Postgres directly. | "RLS via `auth.uid()` memberships" would protect nothing today, because no request reaches Postgres as the end user. Isolation is in the backend layer. §5 proposes real database-level enforcement. |
| Slugs | `backend/src/tenants/store-slug.ts`: 3 to 63 chars, `^[a-z0-9]+(?:-[a-z0-9]+)*$`, `RESERVED_STORE_SLUGS` = app path names (admin, api, auth, changelog, login, signup, onboarding, theme-preview, themes). | This is a good base. It needs subdomain names added, plus a lookalike/profanity check (§7). |
| Media | Served by the backend (`/api/public/media/...` on the Functions domain), with `Cache-Control: immutable` and the stored MIME type. No SVG. | Uploads already live on a different site from the shops. We keep it that way and move them to their own domain (§8). |
| Hosting | CLAUDE.md says the frontend is not deployed to Vercel yet. | The Vercel setup in §1 is first-time setup. |

## 1. Vercel setup

**Dashboard (once, by you):**
1. Create the Vercel project for `jellyshops/` and connect the Git repo.
2. Settings > Domains: add `jellyshop.io`, then `www.jellyshop.io` set to **redirect to `jellyshop.io`** (308).
3. Add `*.jellyshop.io`. Vercel needs to answer DNS challenges to issue and renew a wildcard certificate. That leaves two options:
   - **Recommended:** point the domain's nameservers to `ns1.vercel-dns.com` / `ns2.vercel-dns.com`. Copy every existing record first (MX for email, SPF/DKIM/DMARC TXT, any verification TXT), because they move to Vercel DNS.
   - **If the nameservers must stay where they are:** at your DNS provider, add NS records for `_acme-challenge.jellyshop.io` pointing to the two Vercel nameservers, plus a CNAME for `*` pointing to the CNAME target Vercel shows. Keep both for renewals. A plain CNAME alone does **not** get you the wildcard certificate.
4. A wildcard covers one label only. `myshop.jellyshop.io` works; `x.myshop.jellyshop.io` does not, and we never want it to.
5. Add `admin.jellyshop.io` explicitly as well (it is covered by the wildcard, but listing it makes it visible and easy to lock down later).
6. Environment variables: `NEXT_PUBLIC_ROOT_DOMAIN=jellyshop.io`, plus the existing Supabase and API URLs.
7. In Supabase Auth > URL configuration: Site URL `https://jellyshop.io`, redirect allow-list `https://jellyshop.io/**`, `https://*.jellyshop.io/**`, `http://localhost:3000/**`, `http://*.localhost:3000/**`.

**In code:** host parsing and rewrites (§2), slug rules (§7), the CORS pattern in the backend, `allowedDevOrigins` for `*.localhost`.

**Plan note:** Hobby allows 50 custom domains per project; Pro is effectively unlimited (soft limit 100,000). Multi-tenant **preview** URLs (`shop---project-git-branch.yourdomain.dev`) are **Enterprise only** (§9).

## 2. Request routing (`src/proxy.ts`)

The proxy only reads the `Host` header. It makes **no network or database calls**, because shop existence is already checked (and cached) by the store layout.

```
host (lowercased, port stripped, trailing dot removed)
├─ jellyshop.io                → marketing site (/, /login, /signup, /onboarding, /changelog, /auth/*)
│    /admin*                   → redirect to the merchant's shop: /admin/go (picks the shop, then hands off; §6)
│    /<slug>/...  (old links)  → 308 to https://<slug>.jellyshop.io/...
├─ www.jellyshop.io            → 308 to jellyshop.io (Vercel does this too; belt and braces)
├─ admin.jellyshop.io          → rewrite to /platform-admin/...   (everything else there → 404)
├─ <reserved>.jellyshop.io     → "shop not found" page (api, app, mail, status, …)
├─ <label>.jellyshop.io        → valid slug shape?
│     /admin*                  → serve /admin/... with header x-jelly-shop=<label>
│     /api/*, /_next/*         → leave alone
│     everything else          → rewrite to /sites/<label>/<path>
├─ localhost / 127.0.0.1       → marketing (dev)
├─ <label>.localhost           → same as <label>.jellyshop.io (dev)
├─ *.vercel.app (previews)     → marketing; shops in path mode: /_shop/<slug>/... → /sites/<slug>/...
└─ anything else               → custom domain lookup (later; §11). Until then: not-found page.
```

Changes to the route tree:
- Move `src/app/[storeSlug]` to `src/app/sites/[storeSlug]`. The root path space is then free, and shop slugs no longer clash with app page names. The proxy refuses direct requests to `/sites/*` and `/platform-admin/*` on every host, so they can only be reached through a rewrite.
- New `src/app/platform-admin/` (only reachable on `admin.jellyshop.io`).
- New `src/app/shop-not-found/` page. It is served for unknown or reserved subdomains, with status 404 and `noindex`.
- Link helper `storePath(slug, path)` plus a `StoreBase` context: it yields `''` on a shop subdomain and `/_shop/<slug>` in path mode. All ~57 `` `/${storeSlug}…` `` call sites move to it, and a test fails if the old pattern comes back.
- `admin/*` stays where it is. On a shop host it is bound to that shop (§6). On the apex it only redirects.

Edge cases: uppercase hosts are lowercased before matching. Hosts with a port are fine. IP hosts go to marketing. `x-forwarded-host` is trusted only on Vercel (Vercel sets `host` correctly anyway). Labels starting with `xn--` (punycode) are refused.

## 3. Shop lookup and caching

- **Storefront:** no lookup in the proxy. The store layout already calls `getServerStorefront(slug)`, which is cached 30 s with tag `storefront:<slug>`. Unknown shop: `notFound()`, which goes to the new friendly shop-not-found page (§2). The empty answer is cached too (negative cache), so random subdomains don't hammer the backend.
- **Old slugs:** when a shop is not found, the not-found path asks the backend `GET /api/public/slugs/<slug>` (cached 5 min) and issues a 308 to the new subdomain if the slug used to belong to a shop (§10).
- **Custom domains (later):** the proxy must map host to shop before rewriting, and Proxy cannot use the Next fetch cache. So we use a per-instance LRU (about 60 s, negative entries 30 s) in front of a backend `GET /api/public/hosts/<hostname>`. If we outgrow that, mirror verified domains into **Vercel Global Config** (Edge Config was renamed): 1 MB per store, writes take up to about 10 s to spread, so it suits data that changes rarely, such as domains. 1 MB holds roughly 15 to 20 thousand hostnames before sharding.

## 4. Database changes (migrations in `backend/sql/migrations` and `backend/supabase/migrations`, listed in `test/integration/pglite.ts`)

How the brief's names map onto existing tables:

| Brief | Repo |
| --- | --- |
| `shops` | existing `Store` (slug unique; add `slugChangedAt`) |
| `memberships (user_id, shop_id, role)` | existing `StoreMembership (storeId, userId, role)` |
| `shop_id` on tenant tables | already `storeId` everywhere. Instead of a migration, a **schema test** lists every public table and fails if a tenant table lacks a NOT NULL `storeId` with a foreign key to `Store`, unless it is on a short allow-list of global tables (`User`, `PlatformAdmin`, `ReservedSlug`, taxonomy, …). |

New tables (RLS on, `jelly_backend_access` policy, no browser grants, as the repo's convention requires):
- `PlatformAdmin (userId PK → User, role 'OWNER'|'SUPPORT', createdAt, createdBy)`. Rows are added only by migration or by hand in SQL, never through the app.
- `ReservedSlug (slug PK, reason 'system'|'brand'|'profanity'|'lookalike', createdAt)`. It is seeded from the list in §7. The code list remains the source; a test keeps the two equal.
- `StoreSlugHistory (slug PK, storeId → Store, retiredAt, redirectUntil)`. A retired slug stays redirecting and **cannot be claimed by another shop**.
- Extend `StoreDomain` for later (§11): `status ('pending'|'verified'|'misconfigured'|'removed')`, `isPrimary`, `verification JSONB`, `lastCheckedAt`, a unique index on `lower(hostname)`, and a check that the hostname is not under `jellyshop.io`.
- A trigger or function `jelly_claim_slug(storeId, newSlug)` that, inside one transaction, checks `ReservedSlug` and `StoreSlugHistory`, writes the history row and updates `Store.slug`.

## 5. Tenant isolation in the database (RLS) and tests

Today's policies are `USING (true)` for the backend role, so any backend bug that forgets `WHERE "storeId" = $1` can leak data across shops. Two layers are proposed:

**A. Database-enforced tenant scope for the backend (recommended, staged):**
- Every merchant or public request opens a transaction and runs `SELECT set_config('jelly.store_id', $1, true), set_config('jelly.user_id', $2, true)` (transaction-local, so it is safe with the pooler).
- Replace `USING (true)` on tenant tables with `USING ("storeId" = current_setting('jelly.store_id', true))`.
- A separate role `jelly_backend_system` keeps the open policy for workers, webhooks, onboarding and cross-store jobs (store creation, Stripe webhooks, the order worker).
- This is the biggest piece of work. Every repository function has to run inside the scoped transaction. We would do it one domain at a time (catalogue, then orders, customers, storefront, …) behind a test that runs the whole backend test suite against the scoped role.

**B. Membership-based policies for direct Supabase access (`authenticated` role):** `USING (EXISTS (SELECT 1 FROM "StoreMembership" m JOIN "User" u ON u.id = m."userId" WHERE m."storeId" = t."storeId" AND u."firebaseUid" = auth.uid()::text))`. We only need these if the browser will ever query Supabase directly. It doesn't today, and adding grants would *widen* exposure. **Recommendation: skip B unless you plan direct access.**

**Tests:**
- Integration tests on PGlite: two stores, two merchants. Every merchant route is called with merchant A's token against store B and must return 403 with the same body as an unknown store. This is generated from the route table, so new routes get covered automatically.
- With A in place, SQL tests: set `jelly.store_id` to store A, select/update/delete store B rows in each tenant table, and expect 0 rows or an error.
- The schema test from §4 (every tenant table has `storeId`, RLS on, the expected policy).

## 6. Sign-in, sessions and access checks

**Cookie and session scope.** Sessions stay **host-only**: never `Domain=.jellyshop.io`. With today's localStorage sessions this is automatic. If we move to cookies (option 2 below), they are written without `Domain`, with `Secure; HttpOnly where possible; SameSite=Lax; Path=/`.

**The cross-host problem.** An owner who signs up on `jellyshop.io` has a session only there, but their admin lives on `myshop.jellyshop.io`. The proposed fix is a **sign-in hand-off**:
1. On the apex, a signed-in user opens `/admin` (or finishes onboarding). The browser calls backend `POST /api/auth/handoff { slug }` with its token.
2. The backend checks membership. If the user is a member, it uses the Supabase admin API (`generateLink type=magiclink`) to get a one-time `token_hash` for that user's email, and returns `https://<slug>.jellyshop.io/auth/continue#token_hash=…&next=/admin`. If the user is not a member, the backend still returns the same kind of address, but the subdomain will show "no access". That way the reply never reveals whether the shop exists.
3. The subdomain page calls `verifyOtp({ token_hash, type: 'magiclink' })`. It gets its own fresh session, independent of the apex one, so no refresh token is shared or copied. The page then clears the hash.

Token lifetime is Supabase's (single use). The hand-off endpoint is rate-limited, and `next` is only accepted as a path on the same host.

**Option 1 (smaller, recommended first):** keep supabase-js with localStorage. `/admin` on a shop host:
- reads the shop from `x-jelly-shop` (set by the proxy), not from the old store picker;
- calls `GET /api/me/stores/by-slug/<slug>` → `{ storeId, role }` or **403 `NO_ACCESS`**. Unknown and not-a-member give the identical answer;
- shows the **"You don't have access to this shop"** page: who you're signed in as, "Switch account" (sign out, then sign in on this host), "Go to my shop" (one link per membership, each going through the hand-off). It never says whether the shop exists;
- the store switcher in the admin becomes "go to other shop" via the hand-off.

Every backend merchant route already runs `requireStorePermission`. Nothing in the admin trusts the address alone.

**Option 2 (move to `@supabase/ssr` cookies):** this lets server components check membership before any admin HTML is sent and lets the proxy refresh sessions. It adds a dependency, means touching every place that reads the session, and the browser client still needs JS-readable cookies (so this does not make the token HttpOnly). It's worth doing once there is server-rendered admin code or server actions; today there are none. **Recommendation: Option 1 now, Option 2 later if needed.**

**Platform admin (`admin.jellyshop.io`):** separate pages under `/platform-admin`, and backend routes `/api/platform/*` behind `requirePlatformAdmin`, which checks:
- a `PlatformAdmin` row;
- the JWT `aal` claim is `aal2` (Supabase MFA, TOTP). The page sends users without it to enrol or verify;
- a fresh sign-in (`auth_time` within 12 h);
- an audit log entry for every action (the repo has `backend/src/audit/`).

Optionally, Vercel Firewall can restrict `admin.jellyshop.io` to known IPs. Merchant sessions on shop hosts never reach this host, because sessions are host-only.

**Shoppers' accounts** (`jelly-customer-auth`) become per shop automatically. That is the right behaviour.

**"Easy path to /admin" on the storefront:** when the merchant client finds a merchant session *on this host* that belongs to this shop (a cheap check: localStorage key present, then one cached `by-slug` call), it shows a small fixed **"Manage shop"** pill (bottom corner, outside the theme, `noindex`), with a link to `/admin` and "Edit this page" deep links. It never loads for shoppers: the sign-in library is only fetched when the key exists, the same rule `CustomerProvider` already follows, so no speed cost.

## 7. Slug rules and reserved names

- 3 to 40 characters (not 63: this leaves room for preview prefixes and keeps addresses readable). `^[a-z0-9]+(?:-[a-z0-9]+)*$`. No leading or trailing hyphen, no double hyphen, no `xn--`, not all digits.
- Input is normalised (trim, lowercase, spaces to hyphens) and the result is shown live in onboarding.
- **Reserved (system):** admin, www, api, app, apps, auth, login, signup, sign-in, account, accounts, dashboard, mail, email, smtp, imap, pop, mx, webmail, support, help, docs, status, static, assets, cdn, media, img, images, files, uploads, blog, news, shop, shops, store, stores, checkout, pay, payments, billing, invoice, secure, ssl, dev, staging, test, qa, preview, demo, sandbox, beta, internal, ns, ns1, ns2, dns, ftp, localhost, root, system, jelly, jellyshop, jellylinks, platform, partners, developer, developers, changelog, careers, legal, terms, privacy, cookies, security, abuse, postmaster, hostmaster, webmaster, about, contact, pricing, themes, theme-preview, onboarding, sites, _shop. Plus every current top-level app route (a test keeps them in sync, like today's `RESERVED_STORE_SLUGS` test).
- **Brand and phishing protection:** the names of big payment providers and marketplaces (paypal, stripe, klarna, amazon, ebay, shopify, apple, google, microsoft, facebook, instagram, hmrc, gov, bank, …), also matched after a **lookalike fold** (0→o, 1→l/i, 3→e, 5→s, rn→m, vv→w, hyphens removed) and as a prefix or suffix (`paypal-secure`).
- **Profanity:** a small curated word list matched on the folded slug (whole word or obvious joins). Words like "scunthorpe" are not blocked: we match tokens, not substrings.
- A blocked name gets one plain message ("This address isn't available. Try another."). It never says why, so people can't probe the list.
- The same validator (`storefront-schema` or a shared file) runs in onboarding, in "Add another store" and in the backend. The backend is the authority.

## 8. Security risks of shop subdomains

| Risk | Detail | Mitigation |
| --- | --- | --- |
| **Shops share one "site"** | Browsers treat `a.jellyshop.io` and `b.jellyshop.io` as the same site unless `jellyshop.io` is on the **Public Suffix List**. `SameSite` cookies then do not protect one shop from another, and a subdomain can set a cookie with `Domain=jellyshop.io` ("cookie tossing"). | Host-only cookies; `__Host-` prefix on our own cookies (`jelly-access-*` password cookie, any future session cookie); check `Origin` on every state-changing request (backend and Next route handlers). **Submit `jellyshop.io` to the PSL** (private section) once the routing is live. PSL review takes months with no fixed timing, and it changes cookie behaviour, so test first. |
| **Storefront and admin share an origin** (`myshop.jellyshop.io` and `myshop.jellyshop.io/admin`) | Any script injection on the storefront could read the admin's session in localStorage. Merchants can put custom CSS, rich text, theme-package CSS and app-block iframes on their storefront. A staff member with design rights could try to attack the owner. | No merchant-written HTML or JS anywhere (true today: rich text is structured data, CSS is scoped and refuses `url()`/`@import`/`expression`, app blocks are sandboxed iframes from an allow-list). A strict **CSP on `/admin`** (`script-src 'self'` with nonces, no inline, `frame-ancestors 'none'`). A CSP on storefronts that forbids inline scripts. Keep the custom-CSS sanitiser under fuzz tests. **See the simpler alternative in §12:** keep the admin on its own origin. |
| **User uploads** | If served from a shop host, an uploaded HTML/SVG file could run as that shop. | Uploads stay off `*.jellyshop.io`. Move them to a **separate registrable domain** (e.g. `jellyshopusercontent.com` or `jellycdn.net`), served with `X-Content-Type-Options: nosniff`, a fixed `Content-Type` from our allow-list, `Content-Disposition: inline` only for images, a CSP of `default-src 'none'`, and no SVG (none allowed today). |
| **Subdomain takeover** | Wildcard DNS means every label resolves to us, which is good: no dangling CNAMEs. Risk only from records we add by hand for third parties (e.g. `status`, `mail`). | Reserve those names; check DNS records yearly. |
| **Shop enumeration** | Subdomains are public by nature (shoppers must find them). | Fine for storefronts. The admin and the API never confirm existence to non-members (§6). Rate-limit the slug availability check in onboarding. |
| **Phishing shops** | `paypal-login.jellyshop.io`. | Lookalike filter (§7), abuse report link in the footer, platform-admin takedown (suspend = shop-not-found page). |
| **Open redirects** | `next=` on sign-in and hand-off. | Only same-host paths are accepted. |
| **CORS** | The backend must accept every shop origin. | Allow exactly `^https://[a-z0-9-]{3,40}\.jellyshop\.io$` (plus verified custom domains later). Never reflect any origin; keep credentials off (bearer tokens are used). |

## 9. Local development and previews

- **Local:** `http://localhost:3000` is marketing. `http://myshop.localhost:3000` is a shop and `http://myshop.localhost:3000/admin` its admin. `http://admin.localhost:3000` is the platform admin. Chrome, Edge and Firefox resolve `*.localhost` to your machine with no setup. Other browsers may need a hosts-file line. Add `*.localhost` to `allowedDevOrigins` and to the backend's dev CORS pattern, and the Supabase redirect list (§1).
- **Previews (`*.vercel.app`):** subdomains on previews need Vercel **Enterprise** plus a custom preview suffix. On Pro/Hobby we use **path mode**: `https://<preview>.vercel.app/_shop/myshop/...` and `/_shop/myshop/admin`. The proxy rewrites them the same way, and `storePath` adds the prefix. Sessions on a preview are per preview URL, so you sign in once per preview.
- Playwright: add a `shopHost` fixture that runs specs against `myshop.localhost:<port>`, and one spec per host type (marketing, shop, shop admin, no access, unknown shop, platform admin).

## 10. Changing a shop's address

- Settings > General > Web address. It shows the new address, warns that old links will redirect, and asks for confirmation.
- `jelly_claim_slug` (§4) moves the old slug into `StoreSlugHistory`. The old subdomain then **308-redirects** to the new one with the path and query kept (`/products/x?variant=1`). The redirect is cached; a 301 is cached forever by browsers, so we use 308 for the first 30 days and 301 after.
- Old slugs are never given to another shop (or, if you prefer, freed after 12 months; see questions).
- Limit: 3 changes per 30 days per shop.
- Afterwards: `revalidateTag("storefront:<old>")` and `"storefront:<new>"`; the shopper's bag (localStorage, per origin) does not move across. That's acceptable but worth a line in the warning.
- Old `jellyshop.io/<slug>/...` links (today's address format) redirect permanently to the subdomain.

## 11. Custom domains later

- `StoreDomain` (extended in §4) is the table. Flow: merchant enters `shop.example.com`. Backend calls Vercel `POST /v10/projects/{id}/domains`. If `verified: false`, we show the `_vercel` TXT record to add plus the CNAME/A target. A background check calls verify and then config. Vercel issues the certificate automatically once DNS is right.
- Vercel limits: adding domains 100/hour/team, verifying 50/hour/team, so we queue and back off. Errors to handle: `domain_already_in_use`, `invalid_domain`, `rate_limited`.
- Apex vs www: advise `www.example.com` (CNAME) as primary, with the apex redirecting. Apex needs an A record.
- Proxy: an unknown host is looked up via the cache in §3 and rewritten to `/sites/<slug>`. A shop with a primary custom domain 308s its subdomain to the custom domain (setting).
- The admin stays on `<slug>.jellyshop.io/admin` (never on the custom domain), so sign-in and Supabase redirect URLs never need per-merchant entries.
- Removal: `DELETE` from the project, keep the history row.

## 12. Recommendations, risks and simpler alternatives

1. **Strongest suggestion: put the shop admin on its own origin**, e.g. `admin.jellyshop.io/s/<slug>` for merchants, with the super-admin at `platform.jellyshop.io` or `ops.jellyshop.io`. A storefront bug can then never reach an admin session, one sign-in covers all of a merchant's shops (no hand-off), and Supabase/CORS stay simple. It goes against your stated layout (`{shop}.jellyshop.io/admin`, `admin.` for the platform), so it's your call. If you keep your layout, the CSP and hand-off work above are required, not optional.
2. **Do the routing first, the database hardening second.** Routing (§2, §6 option 1, §7, §10) is visible and self-contained. Database-enforced tenant scope (§5A) is a long refactor across the whole backend. It protects against backend bugs, not against routing.
3. **No proxy lookups** for normal shops. The layout's cached lookup is enough, and it keeps every request free of extra calls.
4. **PSL submission** is cheap and makes shops properly separate sites. Do it after launch testing.
5. **Risk: the 57 hard-coded store links.** Missing one gives a broken `myshop.jellyshop.io/myshop/...` link. A test and a temporary proxy rule (`/<own-slug>/x` on a shop host → 308 to `/x`) cover stragglers.
6. **Risk: emails and published snapshots** hold old `jellyshop.io/<slug>` links. The permanent redirect covers them.
7. **Risk: Firebase backend and Vercel frontend on different domains.** Consider `api.jellyshop.io` (reserved) pointed at the Functions URL later, for cleaner CORS and CSP.

## Implementation steps (each its own commit, with tests)

1. **Host parsing library** (`src/lib/hosts.ts`): pure `classifyHost(host, path)`, with unit tests for every row in §2. No behaviour change yet.
2. **Slug rules**: shared validator, reserved/brand/profanity lists, and a `ReservedSlug` migration plus seed. Backend and onboarding use it. Tests for each rule and the sync test.
3. **Link helper**: `storePath` + `StoreBase`, all ~57 call sites converted, and a guard test against `` `/${storeSlug}` ``. No behaviour change on today's paths. *Built (2026-11-22) without a React context:* `storeBase`/`storePath`/`isInStore` live in `storefront-schema/src/store-links.ts` and the link format will be a deployment-wide setting (subdomain in production, `/_shop/<slug>` on previews), read in `storeBase` in step 4. That works in server components, cached pages, plain functions and the renderer alike, and reads nothing from the request.
4. **Route move + proxy**: `[storeSlug]` → `sites/[storeSlug]`, `src/proxy.ts`, shop-not-found page, old-path redirects, path mode for previews, `*.localhost` dev, backend CORS pattern. Playwright host specs. *Built (2026-11-22):* switchable by `NEXT_PUBLIC_STORE_LINKS` (`path` default keeps today's addresses, `subdomain` turns the new layout on, `preview` for Vercel previews), so it can land before DNS is ready. Checked with a scripted Chrome in both modes; a committed Playwright host spec is still to do.
5. **Host-bound admin**: shop from host, `by-slug` endpoint, no-access page, store switcher via hand-off, apex `/admin` redirect. *Built (2026-11-22) for the admin on its own host:* the shop is in the path (`admin.jellyshop.io/s/<shop>/…`, `/admin/s/<shop>/…` until the switch), pages in `app/admin/s/[shop]/`, membership checked against the merchant's own store list (no `by-slug` endpoint needed; the backend still checks every call), no-access page, switcher navigates between shops (no hand-off: one host), `/admin` and old addresses open the last used shop.
6. **Sign-in hand-off**: backend endpoint, `/auth/continue`, rate limit, tests (member, non-member gives the same reply, replayed token fails). *Built (2026-11-22):* one target only (the admin host), so no membership question; the backend returns just the one-time token and the frontend builds the admin address. The replayed-token case is Supabase's (single use); not tested against real Supabase yet.
7. **"Manage shop" pill** on storefronts for members. *Dropped (owner, 2026-11-22):* with the admin on its own host the storefront can't see the merchant's sign-in, and every way to show the pill only to staff would share sign-in details across sites. The admin's "View store" and the theme editor cover the need.
8. **Slug change + history**: migration, `jelly_claim_slug`, settings UI, redirects, tests. *Built (2026-11-22):* history table and checks in the backend's own transaction (no database function), 308 redirects from the proxy (no 308→301 switch: 308 is permanent too), migration written but not applied.
9. **Platform admin shell**: `PlatformAdmin` migration, `requirePlatformAdmin` (aal2 + fresh sign-in), MFA enrol/verify pages, audit log, minimal shop list.
10. **Security headers**: CSP for `/admin` and storefronts, `__Host-` cookies, `Origin` checks; uploads domain move (needs the new domain bought).
11. **Tenant isolation tests**: cross-tenant route test generated from the route table, plus the schema test.
12. **Database tenant scope (§5A)**, domain by domain, *only if approved separately*.
13. **Vercel + DNS go-live** (you, with a checklist), then the PSL submission.
14. **Custom domains** (later project).

Migrations are applied to staging only with your approval, one at a time, as before.
