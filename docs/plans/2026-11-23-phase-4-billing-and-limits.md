# Speed and cost, Phase 4: billing and plan limits (plan)

Part of `docs/plans/2026-11-20-speed-and-cost-plan.md` (section 8, phase 4). **Design only: nothing is built or
changed yet.** Items that touch the database or Stripe are marked so you can decide on each.

## Why this phase protects the margin

The cost model assumes one $20 plan with limits (5,000 products, 10 GB of photos, 3 staff, 1 custom domain). Today
there is **no billing at all**: no plan, trial, limit or subscription (`billingStatus` does not exist; the Phase 2
`lifecycleState` column is recorded but nothing reads it). Without limits a single large store can cost more than its
plan; without billing there is no "unpaid" state for the inactive-store rules in Phase 5.

## What I checked (2026-11-23)

| Question | Finding |
| --- | --- |
| Who pays Stripe's card fees on shop sales? | The checkout uses **direct charges** (`createDirectPaymentIntent`, on the merchant's connected account) with **no application fee**, and connected accounts are created with `fees_collector: "stripe"`. Stripe's docs say `fees_collector` sets who pays fees for direct charges and `"stripe"` means Stripe collects them from the connected account, i.e. **the merchant pays**; `"application"` would make the platform pay. So the biggest cost driver in the cost model (the platform paying Stripe fees, ~$130 on a $50k/month store) is already avoided. **Still to confirm in your Stripe dashboard**: that no per-connected-account monthly fee applies to the platform under the Connect pricing agreed with Stripe. |
| Money the platform earns | Subscription only. No per-order fee. (A transaction fee would need `application_fee_amount` on each charge: a later option.) |
| Current usage on staging | 7 stores, 74 products, 97 photos (72 MB), at most 1 staff member per store, 0 custom domains: far below every limit, so enforcing limits breaks nothing today. |
| Where stores belong | A merchant (user) can own several stores ("Add another store" exists). Limits and the subscription are per **store** in this design (see decision 1). |

## Proposed design

### Plans live in code, billing state in one table

- **Plans in code** (`backend/src/billing/plans.ts`), not a table: `trial` and `standard` (the $20 plan), each with
  its limits. Changing a limit is a code change and a deploy, with a test; no per-store overrides except `exempt`.
- **One new table `StoreBilling`** (1 row per store; RLS on, `backend_access` policy for `jelly_backend` only,
  **no browser grants**, per the checks we run on every new table): `storeId`, `plan`, `status`
  (`trialing`, `active`, `past_due`, `paused`, `canceled`, `exempt`), `trialEndsAt`, `currentPeriodEnd`,
  `stripeCustomerId`, `stripeSubscriptionId`, `cancelAtPeriodEnd`, `updatedAt`. **Needs your approval to apply to
  staging** (additive, nothing existing changes).
- **No row = treated as the current default**, so the code works before the migration is applied and every
  existing store keeps working (same "additive and fails open" pattern as the other migrations).
- Existing stores, including yours, get `exempt` (never limited, never charged) until you decide otherwise.

### Limits and how they are enforced

| Limit ($20 plan) | Where it is checked | When over |
| --- | --- | --- |
| Products 5,000 (draft + active, not archived) | product create, duplicate, bulk import (counted before the run) | Refused with `409 PLAN_LIMIT` and a plain message with the usage and the limit; nothing is deleted or hidden |
| Photo storage 10 GB (originals; copies add roughly 40%, so the real bucket cost is already inside the cost model) | media upload, import photos | Same |
| Staff 3 (owner included) | invite / add member | Same |
| Custom domains 1 | domain add (not built yet; the check ships with the feature) | Same |
| Page views 250k / month fair use | **not enforced**: measured (Phase 6 monitoring), a person contacts the merchant | Message from you, never an automatic cut-off |
| Emails: order and account emails only | already the only emails sent | n/a |

One function `checkPlanLimit(storeId, kind, adding)` is called from those few places, so a limit cannot be forgotten
in a new route. Usage numbers come from cheap count queries cached for a minute.

### Trial and what happens when payment stops

- **Trial** 14 days (decision 2). A new store starts `trialing` with trial limits (the same as the $20 plan so a
  merchant can really try it).
- **Trial ends without a subscription**: the store moves to `paused`.
- **Payment fails**: Stripe retries for up to 14 days (Smart Retries); the store is `past_due` and the merchant sees
  a banner. After that, `paused`.
- **`paused`** never deletes anything: the storefront shows a plain "This shop is temporarily unavailable" page
  (HTTP 503, noindex), checkout is blocked, the admin stays open and read-only apart from the billing page. Paying
  restores everything at once (the storefront cache is refreshed by the existing refresh call).
- Phase 5 (inactive stores) builds on `status` and the activity columns from Phase 2; it adds the warnings and the
  later archive stage, not new payment logic.

### Stripe Billing (separate from the shops' own Stripe Connect payments)

- A **product + price** for the $20 plan (and optionally an annual price) on the **platform's own** Stripe account.
- **Checkout Session in subscription mode** to start paying, **Customer Portal** to change card, see invoices and
  cancel. No card form of our own, so no new card-handling security scope.
- A **new webhook endpoint** `/webhooks/stripe/billing` with its own signing secret (separate from the two Connect
  ones): `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`,
  `invoice.payment_failed`. Each handler updates `StoreBilling` by `stripeSubscriptionId`, is idempotent (event id
  stored/ignored if seen) and never trusts a client-supplied plan.
- **Test mode first**, then the same steps in live mode. Needs: your Stripe test keys in the backend settings, the
  product/price created (I can do it in test mode through the API or you in the dashboard), the webhook endpoint added
  (Stripe dashboard: yours to do) and, before live, tax settings (VAT) decided (decision 6).

### Admin

- **Billing page** under Settings: plan, status, trial end or next renewal, usage meters (products, photos, staff),
  buttons to subscribe / manage billing (Stripe-hosted), plain wording (no raw codes, per the admin rules).
- **Banners** on every admin page: trial days left, payment failed, shop paused, a limit nearly reached (80%).
- **Platform admin** (`platform.jellyshop.io`) list gains plan and status columns; support can set `exempt` or extend a
  trial (each logged in `PlatformAuditEvent`).

## Build order (each ends with tests, a commit and a report; the first two need no Stripe account)

| Step | What | Database / Stripe |
| --- | --- | --- |
| 4a | `plans.ts`, usage counters, `checkPlanLimit` in the few write paths, `409 PLAN_LIMIT` handling and wording in the admin, tests. Works with no table (default plan, nobody blocked). | None |
| 4b | `StoreBilling` migration, read/write service, trial start on store creation, `exempt` for existing stores, paused-shop behaviour (storefront page, checkout block, admin read-only). | **Migration on staging (your yes)** |
| 4c | Admin Billing page, banners, platform admin columns. | None |
| 4d | Stripe Billing: Checkout, Portal, webhook handlers, idempotency, tests with Stripe's test fixtures; run end to end in test mode. | **Stripe test keys, product/price, webhook endpoint (yours/with your yes)** |
| 4e | Same in live mode, annual price, tax. | **Stripe live settings (yours)** |

## Risks and how they are handled

- **Locking out a paying merchant by mistake**: `paused` is reversible and deletes nothing; a failed Stripe call never
  pauses a store (only a verified webhook does); platform admin can set `exempt`.
- **Counting wrong** (e.g. drafts, archived products): the rules above are written into tests with the exact queries.
- **Race on limits** (two uploads at once): the check and the write run in one transaction with a store-level advisory
  lock for creates; a rare off-by-one over the limit is acceptable and not worth locking every request.
- **Double billing a merchant with several stores**: per-store pricing means each store is its own subscription; the
  Billing page shows each store separately.
- **Vercel Hobby**: unrelated to billing, but while on Hobby the platform is non-commercial: switch to Pro before the
  first real charge (the checklists already say so).

## Decisions for you

1. **One subscription per store, or per merchant account** (covers all that merchant's stores)? Recommended: **per
   store** (matches the cost model and the limits above, simplest, fair).
2. **Trial**: 14 days with **no card** needed (more sign-ups, more abandoned trials) or card required up front?
   Recommended: **14 days, no card**; the inactive-store rules clean up the rest.
3. **Price and currency**: $20 per month in USD, GBP (£) or both? Annual price (e.g. two months free)?
4. **Free tier**: none (recommended), or a small permanent free plan?
5. **Limits**: keep 5,000 products / 10 GB / 3 staff / 1 domain, or change any?
6. **Tax**: collect VAT on the subscription with Stripe Tax, or handle it later? (Needed before live.)
7. **Existing stores**: all `exempt` (recommended), or start a trial on them?
8. **Go ahead with 4a** (code only, nothing outside the repo) now?

Sources: Stripe, [fee behaviour on connected accounts](https://docs.stripe.com/connect/direct-charges-fee-payer-behavior.md),
[connected account configuration](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration),
[Billing with Connect](https://docs.stripe.com/connect/integrate-billing-connect).

## Step 4a built (2026-11-23, code only)

- `backend/src/billing/plans.ts`: the plan list (one plan, `standard`: 5,000 products, 10 GB photos, 3 people,
  1 own domain). `plan-limits.ts`: `PlanLimitChecker.check(storeId, kind, adding)` throws `409 PLAN_LIMIT` with a plain
  message (numbers, what to do); `usage()` for the Billing page later; `sqlUsageReader` counts products not archived,
  photo bytes and memberships per store. Every store is on `standard` until `StoreBilling` exists (4b); `exempt` is
  already supported by the checker.
- Checked in `CatalogService.createProduct` (editor, duplicate, bulk import, which reports the message on the row)
  and `MediaService.upload` (every upload, bulk photos included; refused before any file is written). Creating an
  archived product needs no room. Staff and domain limits are defined but have no write path yet (no staff invites or
  custom domains exist).
- The admin already shows the server's message on product saves, duplicates, imports and uploads, so no frontend
  change was needed.
- Tests: `backend/src/billing/plan-limits.test.ts` (7). Staging usage is far below every limit, so nobody is blocked.

## Step 4b built (2026-11-23; both migrations applied to staging the same day)

- Migration `20261123000000_store_billing.sql` (both folders, PGlite list): table `StoreBilling` as designed, every
  existing shop inserted as `exempt`, RLS + `backend_access` for `jelly_backend` only. Migration
  `20261123010000_reserved_slugs_more.sql` reserves `img-staging` and `shop-paused` (also added to the shared list).
- `backend/src/billing/store-billing.ts`: `pauseReason` / `billingState` rules (trial ended, cancelled plan run out,
  payment stopped; `past_due` is not paused while Stripe retries), `startTrial` (called by `createOwnedStore`, skipped
  before the migration), `StoreBillingService` (`state`, `isPaused`, `planFor` feeding the plan limits: exempt shops
  are never limited; a missing table means "no billing yet").
- **Pausing is off** until shops can pay: new setting `BILLING_ENFORCED` (default `false`). While off, trials are
  recorded but no shop is closed.
- A paused shop (once enforced): the public checkout refuses new orders (`403 SHOP_PAUSED`, "This shop isn't taking
  orders right now."); the storefront access check returns `paused`, and the proxy shows `/shop-paused` ("Back soon.",
  status 503 with `Retry-After`) on every page. **Design change:** the admin stays fully open (not read-only), so the
  merchant can keep working and pay; this also avoids touching every admin route's permission check. A failed billing
  lookup never closes a shop.
- Tests: `billing/store-billing.test.ts` (10), `test/integration/store-billing.test.ts` (4, PGlite: backfill,
  trial on create, constraints, service), gate and proxy cases. The PGlite onboarding test
  (`merchant-onboarding`, "expected 2 to be 4") fails with and without this work.

Staging check after applying (2026-11-23): 7 shops, 7 `StoreBilling` rows, all `exempt`; row security on; only
`backend_access` for `jelly_backend` (select/insert/update/delete), no browser-role grants; 4 indexes; `img`,
`img-staging`, `shop-paused` reserved. Supabase security advisor: no new findings (the existing ones are 10 order
functions without a fixed `search_path` and leaked-password protection being off).

## Step 4c built (2026-11-23)

- Backend `GET /api/stores/:storeId/billing` (`billing/routes.ts`, `settings:manage`, `no-store`): billing state,
  plan name, `exempt`, `enforced` and usage (products, photo storage) against the limits.
- Admin: Settings > **Plan and billing** (`features/billing/billing-settings.tsx`, page
  `admin/s/[shop]/settings/billing`): plan with its status ("Free trial", "No charge", ...), trial end or renewal,
  usage with progress bars; a "Try again" banner when billing can't be shown (staff without settings access).
  `features/billing/billing-notices.tsx` above every shop page (in `ShopAdminGate`): shop closed, payment failed and
  "N days left in your free trial" (last 7 days) only once billing is enforced; "nearly full" (80%) and "full" for
  plan limits always. Data from `billing-summary.ts`, cached for a minute. Status words in `components/admin/status.ts`
  (`billing`).
- Platform admin shop list gains a **Plan** column (`planText`, `features/platform/plan-text.ts`), from a LEFT JOIN on
  `StoreBilling`.
- Checked in the built-in browser, signed in, on staging data through the local frontend and backend: Express Bed
  shows "No charge", 18 products and 3 MB of photos with no limit, at 1280px and 375px (no sideways scroll). The
  trial and limit notices were not seen live (every staging shop is exempt); unit tests cover them.

## Step 4d built (2026-11-23; code only, not switched on)

- Settings `STRIPE_BILLING_PRICE_ID` (price_…) and `STRIPE_BILLING_WEBHOOK_SECRET` (whsec_…, must differ from the Connect
  secrets), with the existing `STRIPE_SECRET_KEY`; leave both empty and paying stays off (`billingStripe` in config).
- `backend/src/billing/stripe-billing.ts` (`StripeBillingService`): `startCheckout` (Stripe Checkout, subscription mode,
  one price, `jelly_store_id` in the session and subscription metadata, the shop's Stripe customer reused, the free trial
  carried over while more than ~2 days are left, otherwise paid at once; refuses exempt shops and shops that already have
  a plan), `openPortal` (Stripe's customer portal), `handleEvent` (checkout completed and subscription
  created/updated/deleted/paused/resumed: reads the subscription from Stripe again and saves its current state, so no
  event table and no migration were needed). Return addresses must be our own admin (an allowed CORS origin and an
  admin path). Status mapping: trialing, active, past_due as is; unpaid and paused → paused; canceled → canceled (with
  when it ended); not-started subscriptions change nothing. Saving never touches an exempt shop and an old
  subscription's late event never replaces a newer one.
- Routes: `POST /api/stores/:id/billing/checkout` and `/billing/portal` (`settings:manage`), webhook
  `POST /webhooks/stripe/billing` (raw body, own signing secret; 400 unsigned, 500 on a failed save so Stripe retries).
  `GET /billing` now says `checkoutAvailable` and `hasSubscription`.
- Admin: **Choose a plan** (to Stripe Checkout) and **Manage billing** (to the portal) on Settings > Plan and billing,
  "Thank you… it can take a minute to show here" on the way back (`?billing=done`, read fresh).
- Tests: `billing/stripe-billing.test.ts` (16, incl. real Stripe signatures for the webhook), PGlite save rules,
  frontend button tests.

### To switch it on in test mode (owner's steps in Stripe; never paste keys into chat)

1. Price decided 2026-11-23: **£19 a month (GBP)**, matching the marketing site. Create a product "Jellyshop" with a monthly recurring price in
   **test mode** (Product catalogue > Add product). Copy the price id (`price_…`) into `backend/.env` as
   `STRIPE_BILLING_PRICE_ID`.
2. Webhook: locally, `stripe listen --forward-to localhost:3001/webhooks/stripe/billing --events
   checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed`
   and put the `whsec_…` it prints into `STRIPE_BILLING_WEBHOOK_SECRET`. For the deployed API, add the same endpoint
   and events in Developers > Webhooks.
3. Customer portal: Settings > Billing > Customer portal, turn on cancelling and updating the card, save once (test mode).
4. Restart the backend, then on a shop that is on its trial (not an exempt one): Settings > Plan and billing > Choose a
   plan, pay with the test card 4242 4242 4242 4242, check the plan shows as paid, open Manage billing.
5. Only after that works, consider `BILLING_ENFORCED=true`.

**Decision 3 taken (2026-11-23):** the plan is **£19 a month in GBP**, the same price the marketing site shows. No annual price yet.
