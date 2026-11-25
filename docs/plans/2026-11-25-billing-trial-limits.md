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
