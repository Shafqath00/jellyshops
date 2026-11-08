# Payment system (Stripe Connect)

Code: `backend/src/stripe/`, `backend/src/commerce/{payment-intents,refunds}.ts`, `jellyshops/src/features/commerce/components/{payment-element-checkout,merchant-payments-panel}.tsx`, `jellyshops/src/app/admin/payments`. Operational runbook: `backend/docs/stripe-connect-deployment.md`.

Stripe is the only payment provider. It is wired directly (there is no provider interface yet), so adding another gateway means abstracting `StripeGateway` first.

## Model

- **Connected accounts.** Each store has a Stripe connected account (`StripeConnectedAccount`). `StripeAccountService` (`stripe/accounts/service.ts`) creates it (`ensureAccount`), issues onboarding links and syncs status. Merchant endpoints: `POST /api/stores/:storeId/stripe-connect/onboarding-link` and `GET .../stripe-connect/status` (permissions `payments:manage` / `payments:view`).
- **Direct charges.** Checkout creates PaymentIntents on the connected account (`StripeGateway.createDirectPaymentIntent`, `stripeAccount` option), so funds settle to the merchant's account. The browser receives `clientSecret` and `connectedAccountId`.
- **Gateway.** `createStripeGateway` (`stripe/client.ts`) wraps the SDK (pinned `STRIPE_API_VERSION`) and exposes the operations the app uses, so tests can inject a fake.

## Webhooks

| Endpoint | File | Signing secret |
| --- | --- | --- |
| `POST /webhooks/stripe/connect-payments` | `stripe/webhooks/connect-payments-route.ts` | `STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET` |
| `POST /webhooks/stripe/accounts-v2` | `stripe/webhooks/accounts-v2-route.ts` | `STRIPE_ACCOUNTS_V2_WEBHOOK_SECRET` |

In production the two secrets must differ (`config.ts`). Each route requires a `Stripe-Signature` header and verifies it with `gateway.constructEvent` before any processing.

`processConnectPaymentEvent` (`stripe/webhooks/processor.ts`) handles `payment_intent.succeeded`, `.payment_failed`, `.canceled`, `refund.*`, `charge.refunded` and `charge.dispute.*`. Behaviour:

- Events are recorded in `StripeWebhookEvent`; `processedAt` is set only after the changes have been applied, in the same transaction, so a failed event is retried rather than lost. Each try is logged in `WebhookProcessingAttempt`.
- Success: `Payment` → paid, `Order` → paid, inventory reservations are committed. Failure/cancel: payment marked, reservations released.
- Refund events update `Refund`/`OrderTransaction` and, through settlement hooks, order-management revisions awaiting a verified payment or refund result.
- A duplicate event is ignored.

## Refunds

`RefundService.fullRefund` (`commerce/refunds.ts`) is the legacy full-refund path; the order-management workspace adds partial refunds and edit settlements (`commerce/order-management.ts`, see [order-management](order-management.md)). Refund state only changes when Stripe confirms through a webhook.

## Merchant payments screen

`app/admin/payments` renders `merchant-payments-panel.tsx`: onboarding status, ready-for-payments state and the onboarding link.

## Configuration

`STRIPE_SECRET_KEY`, `STRIPE_ACCOUNTS_V2_VERSION`, `STRIPE_CARD_PAYMENT_METHOD_CONFIGURATION_ID` (required in production), the two webhook secrets, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` on the frontend. See [environment-variables](../development/environment-variables.md).
