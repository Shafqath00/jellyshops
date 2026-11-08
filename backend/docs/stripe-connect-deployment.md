# Stripe Connect deployment runbook

This runbook describes the frozen Jelly Shops production configuration. It does not create Stripe Dashboard resources automatically.

## Configuration

Jelly Shops uses Accounts v2, Full Stripe Dashboard accounts, and direct charges. The connected merchant is merchant of record. Configure:

```text
dashboard = full
defaults.responsibilities.fees_collector = stripe
defaults.responsibilities.losses_collector = stripe
configuration.merchant.capabilities.card_payments.requested = true
```

Do not create legacy `type: express` accounts, add application fees, or use `charges_enabled`/`payouts_enabled` as readiness sources. Checkout is allowed only when `configuration.merchant.capabilities.card_payments.status` is `active`; payout display reads `configuration.merchant.capabilities.stripe_balance.payouts.status`.

## Secrets and environment

Store these values in the deployment secret manager, separately for staging and production:

- `STRIPE_SECRET_KEY` (restricted server key; never sent to browsers)
- `STRIPE_ACCOUNTS_V2_VERSION=2026-08-26.dahlia`
- `STRIPE_CARD_PAYMENT_METHOD_CONFIGURATION_ID` (card-only `pmc_...` configuration)
- `STRIPE_ACCOUNTS_V2_WEBHOOK_SECRET`
- `STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET`
- `SCHEDULER_SECRET`

The two webhook secrets must be different. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is the only Stripe key permitted in the frontend environment. Set `TRUST_PROXY=true` only when the service is behind a trusted reverse proxy; otherwise leave it `false`.

## Stripe event destinations

Create two destinations with separate signing secrets:

1. **Accounts v2 destination** — events from *Your account*, thin events, endpoint `/webhooks/stripe/accounts-v2`. Subscribe to account update, merchant configuration/capability-status, requirements, future-requirements, and account-closed v2 events listed in the design spec. The handler retrieves current Account state after receipt.
2. **Connected payments destination** — events from *Connected accounts*, snapshot events, endpoint `/webhooks/stripe/connect-payments`. Subscribe to payment-intent success/failure/cancel, refund lifecycle, charge-refunded, and dispute lifecycle events listed in the design spec.

Deploy webhook routes before JSON parsing. Verify the raw request body with the destination's secret, durably deduplicate by Stripe event ID, acknowledge promptly, and process transitions idempotently.

## Database and scheduler

Apply SQL migrations in filename order before serving traffic. Run the reservation sweeper every minute:

```bash
SCHEDULER_SECRET="$SCHEDULER_SECRET" node backend/scripts/run-reservation-sweeper.mjs
```

The sweeper must use the same production PostgreSQL database and only expire orders still in `PENDING_PAYMENT`. Monitor failed runs and Stripe webhook retry volume.

## Verification checklist

Before production traffic:

- Run backend/frontend typechecks, builds, and complete test suites.
- Run Stripe Sandbox onboarding and verify Full Dashboard access, active card capability, and payout status synchronization.
- Send signed test events to both webhook destinations; verify invalid signatures are rejected and duplicate event IDs are no-ops.
- In a real PostgreSQL instance, run two concurrent checkout transactions for one cart key and confirm advisory-lock serialization.
- Compete for the final inventory unit from two sessions and confirm one reservation succeeds without overselling.
- Confirm expiry/cancel racing payment success leaves the webhook-owned paid order and sold inventory authoritative.
- Verify a pre-fulfilment full refund restores inventory exactly once; post-fulfilment refunds do not restock.
- Verify public order tokens are high entropy and rate-limited per store/IP.

## Operational security

Terminate TLS at the edge, restrict CORS to known storefront origins, apply CSP to browser surfaces, and keep webhook endpoints inaccessible to browser clients except for Stripe delivery. Restrict Stripe API keys to server runtime, rotate webhook secrets through the secret manager, and configure the trusted proxy list before enabling `TRUST_PROXY`.
