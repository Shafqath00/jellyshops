# Order management implementation ledger

Approved plan: user message, 21 October 2026.

## Work streams

- Core: schema, merchant queries/commands, revisions, financial operations, fulfilments, returns, invoices and permissions.
- UI: order dashboard/detail, settlement page, polling and workflow dialogs.
- Delivery: notification outbox/worker/templates, private digital files and entitlements.
- Integration: checkout snapshots, Stripe webhook transaction/retry fixes, runtime wiring and verification.

## Decisions

- Work in the existing `local/task3` checkout to preserve the user's uncommitted admin styling changes and installed runtime. Do not reset or replace unrelated edits.
- Keep legacy checkout/status APIs operational; introduce additive interfaces and per-store feature gating.
- Production credentials, deployment, live payments and real customer mail are not invoked during development verification.
- Dependencies between core and UI use the order query envelope and capability flags; notifications consume durable order events.

## Verification

Run 2026-10-22 on `local/task3`:

- Backend: `tsc --noEmit` clean; vitest 97 files / 427 tests pass.
- Frontend: `tsc --noEmit` clean; vitest 461/462 on the full run, the one miss (checkout page test, 5s timeout under load) passes alone; production build passes including `/admin/orders`, `/admin/orders/[id]`, `/admin/settings/notifications`.
- ESLint: no errors in order-management files; the repo's 144 existing lint errors are elsewhere (not touched here).
- Not run: staging database migrations, live Stripe sandbox journey, real SMTP, Playwright.
- Staging (ayvpxqwleurhkfyujzlu), 2026-10-22: applied `20261022000000_order_management` and `20261022010000_notifications_digital` (each in a transaction, recorded in supabase_migrations.schema_migrations). Verified: new tables exist, RLS on, 8 jelly_ triggers, both existing orders backfilled with an original revision. Production not touched.
