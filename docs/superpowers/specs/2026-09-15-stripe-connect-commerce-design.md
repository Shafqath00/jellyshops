# Stripe Connect commerce design

## Status

Approved design. This document defines the production commerce integration before implementation. It replaces the browser-only mock-payment checkout as the authority for payments, orders, inventory reservations, refunds, and disputes.

## Goals

- Enable each Jelly Shop merchant to sell through its own connected Stripe account.
- Accept one-time card payments through a branded Jelly Shop checkout.
- Make the merchant the merchant of record and pay the merchant directly through Stripe.
- Keep payment confirmation, inventory conversion, refunds, and disputes server-owned and webhook-driven.
- Give merchants a reliable order-management and refund workflow.

## Explicitly out of scope for the first release

- Application fees, subscriptions, tax calculation, discounts, multi-merchant carts, partial refunds, saved cards, and custom Stripe dashboards.
- Non-card and delayed/asynchronous payment methods. Card-network wallets presented through Stripe's card flow are allowed.
- Legacy Stripe Accounts v1, legacy Express account types, `charges_enabled`, and `payouts_enabled` as readiness sources.

## Stripe Connect configuration

The integration uses Stripe Accounts v2 only.

```text
dashboard: "full"
charge pattern: direct charges
merchant of record: connected Jelly Shop merchant
defaults.responsibilities.fees_collector: "stripe"
defaults.responsibilities.losses_collector: "stripe"
configuration.merchant.capabilities.card_payments.requested: true
application_fee_amount: omitted
```

Each merchant uses the Full Stripe Dashboard. Stripe bills that merchant's payment-processing fees and carries connected-account negative-balance liability. Jelly Shop does not take an application fee and must not create an Express-dashboard configuration anywhere in this feature.

Jelly Shop stores the connected Account ID and a read model of its state. The source-of-truth fields are:

```text
card_payments_status
  <- configuration.merchant.capabilities.card_payments.status

payouts_status
  <- configuration.merchant.capabilities.stripe_balance.payouts.status
```

Checkout is blocked unless `card_payments_status` is `active`. The backend rechecks the live Accounts v2 capability before creating a payment.

## Merchant onboarding and account state

1. An authenticated merchant starts onboarding from the admin Payments and payouts area.
2. The backend creates an Accounts v2 connected Account configured above, or reuses the store's existing Account.
3. The backend creates a Stripe-hosted Account Link and redirects the merchant to it.
4. Accounts v2 thin events synchronize current capabilities and requirements into Jelly Shop's database.
5. The merchant can resume onboarding when requirements remain outstanding. The merchant uses the Full Stripe Dashboard for bank details, payouts, and Stripe account operations.

## Checkout, payment, and reservation lifecycle

The browser never supplies trusted totals, product prices, stock state, payment status, or Stripe secret material.

1. The browser sends the cart and customer delivery details to a public checkout endpoint.
2. The backend validates the store, live merchant payment readiness, products, variants, stock, prices, shipping, and currency.
3. It calculates a deterministic cart hash from the server-side purchasable lines and pricing inputs.
4. An attempt is reusable only when it is unexpired, has the same store, currency, cart hash, and total, and its PaymentIntent is still awaiting payment details or confirmation.
5. For a new or changed attempt, one transaction conditionally transitions any old pending attempt to cancelled, releases its reservations, holds the new inventory, creates the new pending order and checkout attempt, and records the Stripe idempotency key. This prevents an availability gap between replacing reservations.
6. The server persists a Stripe idempotency key before calling Stripe. A new checkout attempt begins in `PAYMENT_INTENT_CREATING`; its PaymentIntent ID is nullable until durably attached.
7. The server creates one direct-charge PaymentIntent on the store's connected Account, without application fees, using that persisted idempotency key and metadata containing the stable Jelly Shop order ID and checkout-attempt ID.
8. On recovery or retry, the server uses the same idempotency key to recover the original Stripe result. Only after it durably records the PaymentIntent ID on the checkout attempt and payment does it return the client secret and connected Account ID needed by Stripe.js.
9. If PaymentIntent creation definitively fails, one transaction conditionally cancels the still-creating attempt, releases reservations, and cancels the pending order. Ambiguous network/process failures remain recoverable through the persisted idempotency key.
10. Stripe.js initializes against that connected Account and renders the Payment Element. The client confirms the same PaymentIntent.
11. Payment confirmation is authoritative only after the verified connected-account payment webhook is processed.

Inventory reservations last 15 minutes. Reservation creation uses a row lock or conditional stock update, never a read-then-write operation. A scheduled sweeper expires reservations and cancels uncompleted PaymentIntents. It first conditionally changes the associated order only when its status remains `PENDING_PAYMENT`; a concurrent payment webhook therefore wins safely.

`payment_intent.payment_failed` does not release inventory because customers can retry payment. `payment_intent.canceled`, expiry, and cart replacement release it. A cancel call that reports an already-succeeded PaymentIntent is treated as a normal race: the worker performs no compensating stock action and the webhook-owned paid order remains authoritative.

The first release is card-only. Stripe payment-method configuration must enable the card flow and exclude non-card delayed/asynchronous methods. The server must not rely on an unbounded automatic Payment Element configuration or use the deprecated `payment_method_types` request parameter. The 15-minute reservation is therefore aligned only to the card-payment lifecycle.

## Order, payment, refund, and dispute states

Orders begin in `PENDING_PAYMENT`. A successful payment webhook atomically transitions the order to paid/confirmed and converts its held reservations to sold inventory. Cancellation or expiry changes a still-pending order to `CANCELLED` and releases reservations. Existing fulfilment transitions continue after confirmation.

The merchant can request one full refund from the order detail page. The backend verifies merchant authority and creates the refund while authenticated as the connected Account. A `Refund` record is authoritative for the refund lifecycle; a Stripe API response may leave it pending and is not permanent success. `refund.created`, `refund.updated`, and `refund.failed` transition that record idempotently.

Inventory rules are explicit: a full refund before fulfilment begins restores the order's inventory exactly once; a full refund after fulfilment has begun or completed does not restock automatically; cancellation or checkout expiry before payment releases the reservation normally. A failed refund never marks the order refunded or restores inventory.

`charge.dispute.created`, optional `charge.dispute.updated`, and `charge.dispute.closed` update an orthogonal dispute state on the payment. A dispute never overwrites the order's fulfilment lifecycle: an order can be fulfilled and disputed simultaneously. The merchant resolves the dispute in the Full Stripe Dashboard.

## Persistence model

New durable records are required in the PostgreSQL backend:

- `StripeConnectedAccount`: `store_id`, connected Account ID, card-payment and payout status, requirements state, timestamps.
- `Order`: immutable item/customer/price snapshots, public order token, order lifecycle, totals, shipping, and timestamps.
- `OrderItem`: order-specific product/variant snapshots and quantities.
- `Payment`: order ID, connected Account ID, PaymentIntent/Charge IDs, amount, currency, state, timestamps.
- `CheckoutAttempt`: required `order_id`, cart hash, persisted Stripe idempotency key, nullable payment intent ID, expiry, and lifecycle state including `PAYMENT_INTENT_CREATING`.
- `InventoryReservation`: checkout attempt ID, variant ID, quantity, expiry, and held/released/converted state. Its order linkage is derived through `CheckoutAttempt.order_id`.
- `Refund`: payment/order relationship, Stripe refund ID, amount, status, and inventory-restored marker.
- `StripeWebhookEvent`: Stripe event ID, endpoint family, connected Account ID, event type, received/processed timestamps, and processing result.

All rows are tenant-scoped through the store and foreign keys. `CheckoutAttempt.order_id` is mandatory. Event IDs and Stripe object IDs have unique constraints appropriate to their scope.

## Webhook architecture

The backend has two separate raw-body routes, each with a distinct signing secret and event-deduplication record. Both use a durable, order-independent pipeline: verify raw-body signature, durably insert the event ID, acknowledge receipt, then process/retry the stored event idempotently. A database-backed worker is preferred; any synchronous path must preserve the same durable receipt and retry semantics. Event delivery order is never trusted, and transitions are conditional and monotonic so late events cannot move terminal entities backwards.

### Accounts v2 lifecycle destination

`POST /webhooks/stripe/accounts-v2` receives Accounts v2 thin events through an Event Destination configured as `Events from: Your account` with thin payloads. It identifies the merchant Account through `related_object.id`, never `event.account`:

- `v2.core.account.updated`
- `v2.core.account[configuration.merchant].updated`
- `v2.core.account[configuration.merchant].capability_status_updated`
- `v2.core.account[requirements].updated`
- `v2.core.account[future_requirements].updated`
- `v2.core.account.closed`

After durable receipt and deduplication, the handler retrieves the current Accounts v2 Account state before synchronizing the local read model. Thin events are notifications, not authoritative embedded account snapshots. For `v2.core.account.closed`, it uses `related_object.id` to mark the local Stripe connection closed/unavailable immediately and block checkout; it does not assume the Account remains retrievable.

### Connected-account payment destination

`POST /webhooks/stripe/connect-payments` receives connected-account payment snapshot events through an Event Destination configured as `Events from: Connected accounts` with snapshot payloads. It uses top-level `event.account` to resolve the merchant:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `refund.created`
- `refund.updated`
- `refund.failed`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`

After durable receipt and deduplication, the handler applies the state-machine transitions transactionally.

## Public API and security

- Public checkout creates or safely reuses a checkout attempt under a short-lived per-cart lock plus Stripe idempotency.
- Public order lookup uses an opaque token generated from at least 128 bits of randomness, never a sequential order ID.
- The order lookup endpoint has route-specific rate limiting.
- Every merchant mutation authenticates the merchant and checks store membership/permissions.
- Webhook routes are registered before JSON parsing, use raw bodies, verify their distinct secrets, reject invalid signatures, and never trust customer-provided status fields.
- Stripe credentials and signing secrets are separate per environment and stored in a secrets manager or restricted environment configuration, never committed.

## Validation and testing

Tests cover Accounts v2 request shape, capability gating, cart-hash attempt reuse, concurrent checkout locks, stock reservation conversion/release, expiry/webhook races, both webhook signature and deduplication paths, full refund authorization and idempotency, dispute state, public token entropy/authorization, rate limits, and migration compatibility. Stripe Sandbox and CLI/event fixtures are used for integration tests; real live credentials are not used in automated tests.
