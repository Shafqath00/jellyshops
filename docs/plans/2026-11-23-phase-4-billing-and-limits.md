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
