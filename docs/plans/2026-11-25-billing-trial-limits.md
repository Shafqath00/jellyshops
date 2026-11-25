# Billing: price change, trial limits, grace period, reminders, abuse protection (plan)

Builds on Phase 4 (`docs/plans/2026-11-23-phase-4-billing-and-limits.md`), which already has the billing table,
Stripe Billing (Checkout, portal, signed webhooks that re-read the subscription from Stripe), pausing behind
`BILLING_ENFORCED`, and plan limits for products and photo bytes.

## Decisions (owner, 2026-11-25)

| Question | Decision |
| --- | --- |
| Price | **£15 a month**, yearly **£150** (two months free, as before). Stripe prices cannot be edited: the owner makes two new prices and changes `STRIPE_BILLING_PRICE_ID` / `STRIPE_BILLING_ANNUAL_PRICE_ID`. Existing test subscriptions stay on £19 until moved. |
| Trial | 14 days, no card, from store creation (unchanged). |
| Paused shop | Storefront and checkout close; the admin stays fully open so the owner can pay (unchanged). |
| Grace period | 7 days after a failed payment (`past_due`), then the shop closes even if Stripe is still retrying. |
| Data kept | 90 days after a shop closes. After that the shop is listed for deletion after a warning email; deleting stays a manual step (no automatic deletion of merchant data). |
| Trial limits | 5 MB per file, 500 MB photos, 200 files, 50 products, 10 uploads a minute per store. |
| Paid limits | 10 MB per file, 10 GB photos, 5,000 files, 5,000 products, 30 uploads a minute per store. |
| One trial per | Owner account and normalised email (Gmail dots and `+tags` ignored). Card fingerprint: later (see open points). |
| Plans | One plan; "upgrade/downgrade" = monthly vs yearly in Stripe's portal. |

## States (stored in `StoreBilling.status`, enforced on the server)

- `trialing`: trial limits until `trialEndsAt`.
- `active`: paid limits.
- `past_due`: paid limits; open until `graceEndsAt` (failed payment + 7 days); owner emailed.
- `paused` / `canceled` / trial ended: storefront and checkout closed, admin open, data kept 90 days.
- `exempt`: never limited or charged (shops that existed before billing).

Webhooks stay the source of truth for paid states; a scheduled job only moves time-based states (trial ended,
grace ended) and sends reminders.

## Build order (each step: tests, commit, report)

1. **Limits config and trial limits** (code only): `backend/src/billing/limits-config.ts` holds every number
   above; trial shops get trial limits; per-file size checked from `Content-Length` before the upload is read
   (413) and again on the file; file count limit; per-store upload rate limit (429). Price shown as £15/£150.
2. **Grace period, expiry job and reminders** (migration): `StoreBilling.graceEndsAt`, table
   `BillingReminder` (one row per store + reminder, so each email goes once); job on the existing scheduled
   worker marks ended trials, closes shops past grace, emails day 10, day 13, expiry and failed payment.
3. **One trial per owner and email** (migration): `TrialClaim` (normalised email, user id); a second store
   from the same owner or email starts without a trial (pays at once).
4. **Rate limits per user and store on write endpoints** (in-memory, like the existing limiters).
5. **Retention**: closed-for-90-days shops listed in the platform admin with a warning email; deletion manual.

## Open points

- Card fingerprint check needs a decision on what happens when a reused card is found at Checkout (end the
  trial at once, or refuse); not built until decided.
- Uploads are still held in memory (capped at the per-file limit); streaming or direct-to-R2 uploads would be a
  separate change.
- In-memory rate limits are per server instance (up to 5 instances), so the real ceiling can be higher.

## Step 1 built (2026-11-25, commit 401d68b6)

Limits config, trial plan, file size/count checks, per-store upload limit, £15/£150 shown. See CLAUDE.md.

## Step 2 built (2026-11-25; migration applied to staging 2026-11-25)

Staging check after applying: `graceEndsAt` column, status check includes `expired`, grace index, `BillingReminder`
with RLS on, `backend_access` policy for `jelly_backend` only, no anon/authenticated grants, 0 rows. Staging shops:
7 exempt, 2 with Stripe test subscriptions (`billing-test` trialing, `billing-clock-test` active), so the job
expires or emails none of them.


- Migration `20261125000000_billing_grace_reminders.sql` (both folders, PGlite list): `StoreBilling.graceEndsAt`,
  status `expired` added to the check, table `BillingReminder` (store + kind primary key; RLS + `backend_access`).
  The code works the old way until it runs (missing column or table detected, then remembered).
- Grace: the webhook's first `past_due` sets `graceEndsAt` = now + 7 days; later retries keep it; any other status
  clears it. A `past_due` shop counts as closed after `graceEndsAt` (only when `BILLING_ENFORCED` is on).
- Job `backend/src/billing/billing-jobs.ts`, run on every tick of the scheduled worker after the order work:
  moves ended trials without a subscription to `expired` (shown and enforced as "trial ended", trial limits kept);
  emails the owner on trial day 10 and 13, trial ended (only for trials ended in the last 3 days), payment failed
  (with the closing date), and shop closed (only when enforced). Each email is claimed before sending, so several
  instances never send it twice; a failed send gives the claim back.
- Emails use the order email sender (`ORDER_SMTP_*`); without it no email is claimed or sent, but trials still expire.
  Links go to `<STOREFRONT_PUBLIC_URL>/admin/s/<shop>/settings/billing`.
- Admin: the warning shows the closing date; the closed banner explains a failed payment; the Billing page explains
  `past_due` and `expired`.
- Note: a local backend pointed at staging runs the same job every minute (it expires staging trials; emails are
  captured, not sent, without SMTP).

## Step 3 built (2026-11-25; migration applied to staging 2026-11-25)

Staging check after applying: RLS on, `backend_access` for `jelly_backend` only, backend may only read and add rows,
no anon/authenticated grants; backfill wrote 2 user + 2 email claims (owners of `billing-test` and
`billing-clock-test`).


- Migration `20261125010000_trial_claims.sql` (both folders, PGlite list): table `TrialClaim` (kind `user` | `email`,
  value, storeId as a note only, claimedAt; primary key kind + value; RLS + `backend_access`; the backend may only read
  and add rows). Backfill: owners of every non-exempt billed shop get a user and an email claim. Rows are never
  deleted, also not with the shop, so deleting a shop gives no new trial. Listed in `GLOBAL_TABLES` of the
  tenant-schema test.
- `backend/src/billing/trial-claims.ts`: `normaliseEmail` (lower case, `+tag` dropped for every provider, Gmail dots
  dropped, googlemail.com = gmail.com), `emailClaimKey` (SHA-256 hex; the email itself is never stored),
  `claimTrial` (inside the store's transaction; email claim first so a lost race does not use up the account's claim).
- `createOwnedStore` (onboarding and "Add another store") calls it: no claim available = `StoreBilling` status
  `expired` with no trial end. Pause reason `no-trial`: the storefront closes once `BILLING_ENFORCED` is on, the admin
  stays open, trial limits apply until it subscribes, Stripe Checkout charges at once (no trial days), the job sends
  no trial emails for it.
- Admin wording: "You've already had a free trial, so this shop starts on a paid plan."
- Until the migration runs every new shop gets a trial, as before. Card fingerprint still open.

## Step 4 built (2026-11-25, code only)

- `WRITE_LIMITS` in `limits-config.ts`: 300 changes a minute per person (across their shops) and 600 per shop (across
  its staff). A change = POST/PUT/PATCH/DELETE on `/api/stores/:storeId/...`; reads are never counted.
- `backend/src/http/write-limits.ts` (`WriteLimiter`, fixed one-minute windows, a refused change is not counted),
  checked inside `requireStorePermission` after access is confirmed, so strangers and non-members never use up a
  shop's allowance. Over the limit: 429 `WRITE_RATE_LIMIT` with `Retry-After` and "You're making changes very quickly.
  Wait N seconds and try again."
- Same for every plan and for exempt shops (abuse protection, not billing). In memory per server instance.
- Bulk edit (saves one product at a time) waits 5 seconds and tries again on 429, for up to about a minute per
  product (`saveWithPatience` in `bulk-edit-dialog.tsx`), so a large bulk edit slows down instead of failing.
- Existing per-IP limiters (uploads, onboarding, public forms) are unchanged.
