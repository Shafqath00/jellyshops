# Shop subdomains: go-live checklist

Step 13 of [the tenancy plan](../plans/2026-11-22-subdomain-tenancy-plan.md). Everything in steps 1–11 is built and on
`redesign/jelly-shop-ui`, switched off. This list turns it on. Work top to bottom; each part says how to check it before
moving on, and the last part says how to switch back.

Who does what: **you** = the owner, in dashboards; **dev** = whoever has the repo (it can be done in a Claude session).
Nothing here needs a code change.

## Before you start

- [ ] **Vercel plan.** The Hobby (free) plan is for personal, non-commercial use and allows 50 custom domains per
      project. Shops taking real orders need Pro. The wildcard `*.jellyshop.io` counts as one domain.
- [ ] **The branch is merged or deployed.** Vercel builds from the branch you connect (`redesign/jelly-shop-ui`, or
      `main` once it is merged).
- [ ] **No email on the domain.** You said `jellyshop.io` has no MX/email records. If that changes, copy every DNS record
      (MX, SPF/DKIM/DMARC TXT, verification TXT) before moving the nameservers.
- [ ] **A quiet moment.** Shoppers on password-protected shops will be asked for the password once more (the cookie got a
      safer name), and the first visits after the switch fill the page cache.

## 1. Database (dev, with your OK for each)

Apply in this order to staging first, then production. Both folders hold the same files.

| Migration | What it adds |
| --- | --- |
| `20261122030000_reserved_slugs.sql` | `ReservedSlug`: addresses nobody may take |
| `20261122040000_store_slug_history.sql` | `StoreSlugHistory`: retired addresses, which redirect for good |
| `20261122050000_platform_admins.sql` | `PlatformAdmin`, `PlatformAuditEvent`: Jellyshop staff and their log |
| `20261122060000_platform_admin_read_only.sql` | takes back the backend's rights to add or change platform admins and to change their log |

Check after each (read-only):

```sql
-- Row security on, backend policy only, nothing for the browser.
SELECT c.relname, c.relrowsecurity,
       (SELECT string_agg(policyname || ':' || array_to_string(roles, '/'), ', ') FROM pg_policies p WHERE p.tablename = c.relname) AS policies,
       has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('authenticated', c.oid, 'SELECT') AS browser
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname IN ('ReservedSlug', 'StoreSlugHistory', 'PlatformAdmin', 'PlatformAuditEvent');
```

Expected: `relrowsecurity` true, one `backend_access:jelly_backend` policy, `browser` false.
`SELECT count(*) FROM "ReservedSlug"` should be 162. After the fourth:
`SELECT has_table_privilege('jelly_backend', '"PlatformAdmin"', 'INSERT')` should be false.

- [x] Staging: first three applied and checked (2026-11-22). - [ ] Staging: the fourth.
- [ ] Production: all four applied and checked.

Until `StoreSlugHistory` exists, a shop's address can't change once it is published; nothing breaks either way.

## 2. Make yourself a platform admin (you, in SQL)

The app can never add platform admins. In the Supabase SQL editor, once per environment:

```sql
INSERT INTO "PlatformAdmin" ("userId", "role", "createdBy")
SELECT "id", 'OWNER', 'initial setup' FROM "User" WHERE "email" = '<your sign-in email>';
```

- [ ] Staging row added. - [ ] Production row added.

## 3. Supabase (you, in the dashboard)

- [ ] **Authentication > Sign In / Providers > Multi-Factor:** TOTP (authenticator app) enabled. It is on by default;
      the platform admin needs it.
- [ ] **Authentication > URL Configuration:**
      - Site URL: `https://jellyshop.io`
      - Redirect URLs: `https://jellyshop.io/**`, `https://*.jellyshop.io/**`, `http://localhost:3000/**`,
        `http://*.localhost:3000/**` (and your preview pattern if you use previews)

## 4. Vercel (you, in the dashboard)

1. [ ] Project for `jellyshops/`, connected to the repo and the branch above.
2. [ ] **Settings > Domains:** add `jellyshop.io`; add `www.jellyshop.io` set to redirect to `jellyshop.io` (308).
3. [ ] **Nameservers:** at the registrar, point `jellyshop.io` to `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.
       Vercel needs to answer the DNS challenge to issue the wildcard certificate.
4. [ ] Add `*.jellyshop.io`. Then add `admin.jellyshop.io` and `platform.jellyshop.io` explicitly (already covered by
       the wildcard, but they show up in the list and can be locked down later).
5. [ ] Wait until Vercel shows valid certificates for all of them.
6. [ ] **Environment variables** (Production, and Preview where noted):

| Name | Production | Preview |
| --- | --- | --- |
| `NEXT_PUBLIC_STORE_LINKS` | `path` for now (switched in part 6) | `preview` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `jellyshop.io` | `jellyshop.io` |
| `NEXT_PUBLIC_SITE_URL` | `https://jellyshop.io` | the preview URL |
| `NEXT_PUBLIC_STORE_EDITOR_API_URL` | the backend's address | same |
| `STOREFRONT_API_URL` | the backend's address (server side) | same |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | as today | same |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | as today | test key |
| `STOREFRONT_REVALIDATE_SECRET` | a long random value, same as the backend's | same |

`NEXT_PUBLIC_*` values are built into the app: redeploy after changing them.

- [ ] Deployed with `NEXT_PUBLIC_STORE_LINKS=path`: everything still works at `https://jellyshop.io/<shop>` (today's
      addresses). This is the safe starting point.

## 5. Backend (dev or you, where the backend runs)

| Name | Value |
| --- | --- |
| `CORS_ORIGINS` | `https://jellyshop.io,https://*.jellyshop.io` (one shop-shaped label is allowed in place of `*.`) |
| `STOREFRONT_PUBLIC_URL` | `https://jellyshop.io` (order and back-in-stock emails; old-style links redirect to the shop) |
| `STOREFRONT_REVALIDATE_URL` | `https://jellyshop.io/api/revalidate` |
| `STOREFRONT_REVALIDATE_SECRET` | the same value as on Vercel |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | as today; the sign-in hand-off needs the secret key |

- [ ] Backend redeployed with these.

## 6. Switch on subdomains

- [ ] On Vercel set `NEXT_PUBLIC_STORE_LINKS=subdomain` (Production) and redeploy.

From now on: shops at `https://<shop>.jellyshop.io`, the merchant admin at `https://admin.jellyshop.io` (each shop under
`/s/<shop>`), staff at `https://platform.jellyshop.io`, and old `jellyshop.io/<shop>/…` and `jellyshop.io/admin/…`
links redirect there.

## 7. Checks after the switch (you, signed in; or dev with you signing in)

Shops and addresses:
- [ ] `https://<a real shop>.jellyshop.io` shows the shop; product, collection, bag and search work; links stay on the
      shop's own address.
- [ ] `https://jellyshop.io/<shop>/products/<product>` redirects to the same product on the shop's address.
- [ ] `https://no-such-shop-xyz.jellyshop.io` and `https://api.jellyshop.io` show "There's no shop here" (404).
- [ ] A password-protected shop asks for its password, and the password works.
- [ ] Checkout with a Stripe test card reaches the confirmation page (watch for blocked-content errors in the browser
      console: the new Content Security Policy is strict).

Merchant admin and sign-in:
- [ ] Sign in at `https://jellyshop.io/login`: you land on `https://admin.jellyshop.io/s/<your shop>` already signed in
      (the one-time hand-off). Opening the same `/auth/continue#…` link again is refused.
- [ ] The store switcher moves between your shops' admins; a shop you don't belong to shows "You don't have access to
      this shop".
- [ ] Settings > General: change a test shop's address. The old address then redirects to the new one (allow up to a
      minute), and another shop can't take the old address. (At most 3 changes in 30 days.)
- [ ] A new sign-up finishes onboarding and opens the new shop's own admin.

Platform admin:
- [ ] `https://platform.jellyshop.io`: sign in, set up the authenticator (QR code), see the shop list; the search works.
- [ ] Someone who isn't a platform admin gets "Not available".

## 8. After a few quiet days

- [ ] Submit `jellyshop.io` to the [Public Suffix List](https://github.com/publicsuffix/list) (private section). It makes
      browsers treat each shop as its own site. Review takes months and changes cookie behaviour, so only after the
      above has run cleanly.
- [ ] Buy a separate domain for uploaded photos (for example `jellyshopusercontent.com`) and move media there (plan §8).
- [ ] Move to Vercel Pro before shops trade for real.

## Switching back

If something is wrong after part 6: set `NEXT_PUBLIC_STORE_LINKS=path` on Vercel and redeploy. Shops go back to
`jellyshop.io/<shop>`, the admin to `jellyshop.io/admin`. Links shoppers already followed to `<shop>.jellyshop.io` keep
working as long as the wildcard domain stays on Vercel. The migrations can stay: nothing depends on them being empty.

## Known limits

- Sessions are per site: someone signed in on the admin is not signed in on a shop or the platform, by design.
- Right after an address change the old address can show "no shop here" for up to a minute.
- Order emails link through `jellyshop.io/<shop>/order/…` and redirect; that's intended.
- Database-level shop separation (plan §5A) is a separate, later project.
