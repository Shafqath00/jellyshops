# Stripe Connect Commerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Jelly Shop's browser-only mock payment authority with production Stripe Connect commerce using Accounts v2, direct charges, durable orders and inventory reservations, and webhook-owned payment state.

**Architecture:** Express owns all money, order, inventory, and webhook state in PostgreSQL. Stripe Accounts v2 creates one Full Dashboard merchant account per store; direct-charge PaymentIntents are created in that connected-account context. Next.js keeps local cart UX temporarily, but obtains a server-authoritative checkout attempt and Payment Element client secret before payment; public and admin order views then read the API rather than localStorage.

**Tech Stack:** Node.js 22 + Express 5 + TypeScript + `pg` + Zod + Stripe Node SDK; Next.js + React + TypeScript + Stripe.js/React Stripe.js; Vitest/Supertest; Playwright; PostgreSQL/Supabase SQL migrations; Firebase Admin or development bearer-token merchant auth.

**Spec:** `docs/superpowers/specs/2026-09-15-stripe-connect-commerce-design.md`

## Global constraints

- Use Accounts v2 only: create merchant accounts through `/v2/core/accounts`; never create legacy `type: "express"`, `type: "standard"`, or `type: "custom"` accounts.
- Create every merchant account with `dashboard: "full"`, `defaults.responsibilities.fees_collector: "stripe"`, `defaults.responsibilities.losses_collector: "stripe"`, and `configuration.merchant.capabilities.card_payments.requested: true`.
- Use direct charges; the connected merchant is merchant of record. Omit `application_fee_amount` everywhere.
- Treat `configuration.merchant.capabilities.card_payments.status === "active"` as the checkout gate and persist payout status from `configuration.merchant.capabilities.stripe_balance.payouts.status`.
- Restrict the first release to the card payment flow through a Stripe payment-method configuration. Do not pass `payment_method_types` to PaymentIntent creation and do not enable delayed/asynchronous payment methods.
- Persist the Stripe idempotency key before a PaymentIntent call; the same key is reused after an ambiguous timeout/crash. Never return a client secret until the PaymentIntent is durably attached.
- Webhooks must verify raw-body signatures, durably deduplicate by event ID before acknowledgement, and use conditional monotonic transitions. Event arrival order is not trusted.
- Use 15-minute transactional reservations. A `payment_intent.payment_failed` event retains the reservation; payment success wins expiry/cancellation races.
- Keep `Refund` as the refund-state authority; only a full refund before fulfilment begins restores stock once. Disputes are independent of fulfilment.
- Do not use `charges_enabled` or `payouts_enabled` as readiness sources. Keep secrets outside source control.

## Current repository facts that govern the implementation

- SQL is committed as timestamped files in `backend/sql/migrations`; no Prisma schema, migration runner, job queue, or scheduler exists.
- `backend/src/app.ts` currently mounts `express.json()` before application routers and uses dependency injection for optional catalog/tenant services. Webhook raw-body routes must be mounted before that JSON middleware.
- `ProductVariant` and `InventoryLevel` already exist in `20260913210000_add_canonical_catalog.sql`; `InventoryLevel` has `quantity` and `reserved`, which supports conditional reservation SQL.
- Merchant authorization is `requireMerchant` + `requireStorePermission` in `backend/src/auth/middleware.ts`; public catalog routes are unauthenticated.
- `jellyshops/src/lib/repository.ts` and `providers.ts` currently create paid mock orders, decrement local stock, and persist to localStorage. They cannot remain payment/order authority after this plan.
- The admin, checkout, and public order pages currently read that repository directly. Store Editor API code already demonstrates a browser API client and development bearer token in `src/features/store-editor/api`.
- Backend tests use Vitest/Supertest; frontend tests use Vitest/Testing Library; browser tests use Playwright. The existing Playwright command starts only Next.js, so real commerce E2E needs an API-aware runner.

## File structure / change map

### Create

- `backend/sql/migrations/20260915120000_add_stripe_connect_commerce.sql` — tenant-scoped commerce, Stripe account, reservation, webhook, payment, refund, and rate-limit schema.
- `backend/src/stripe/client.ts` and `backend/src/stripe/client.test.ts` — configured Stripe client factory and card-only payment-method configuration lookup.
- `backend/src/stripe/accounts/types.ts`, `repository.ts`, `service.ts`, `routes.ts`, `service.test.ts`, `routes.test.ts` — Accounts v2 creation, Account Links, current-state retrieval, and merchant status API.
- `backend/src/commerce/types.ts`, `repository.ts`, `service.ts`, `routes.ts`, `service.test.ts`, `routes.test.ts` — orders, checkout attempts, deterministic cart hashing, reservation SQL, public order reads, and merchant order actions.
- `backend/src/commerce/payment-intents.ts` and `payment-intents.test.ts` — crash-safe direct-charge PaymentIntent creation/recovery.
- `backend/src/commerce/refunds.ts` and `refunds.test.ts` — merchant-authorized full-refund initiation and state reconciliation.
- `backend/src/commerce/sweeper.ts`, `sweeper-routes.ts`, `sweeper.test.ts` — expiry worker and authenticated scheduler trigger.
- `backend/src/stripe/webhooks/types.ts`, `receipt-repository.ts`, `processor.ts`, `accounts-v2-route.ts`, `connect-payments-route.ts`, and focused tests — durable receipt, retry, Accounts v2 thin-event handling, and connected-account snapshot handling.
- `backend/test/integration/stripe-connect-commerce.test.ts` — PostgreSQL/PGlite transactional race coverage.
- `backend/vitest.integration.config.ts` — includes the otherwise excluded `test/integration/**` suite.
- `jellyshops/src/features/commerce/api/types.ts`, `client.ts`, `client.test.ts`, `merchant-session.ts` — browser API contract, public client, and production/development merchant token adapter.
- `jellyshops/src/features/commerce/components/payment-element-checkout.tsx` and test — connected-account Payment Element mount/confirm state.
- `jellyshops/src/features/commerce/components/merchant-payments-panel.tsx` and test — onboarding/readiness/full-dashboard panel.
- `jellyshops/src/features/commerce/components/order-payment-panel.tsx` and test — payment, refund, and dispute presentation.
- `jellyshops/src/features/commerce/commerce-store-id.ts` and test — one explicit demo-slug-to-backend-store-ID mapping, replacing duplicated demo mapping logic.
- `jellyshops/src/app/admin/payments/page.tsx` and test — merchant payment onboarding/status page.
- `jellyshops/src/app/[storeSlug]/order/[publicToken]/page.tsx` and `page.test.tsx` — API-backed public order route and coverage.
- `backend/scripts/run-reservation-sweeper.mjs` — scheduler-safe CLI invoking the protected sweeper endpoint.
- `jellyshops/e2e/stripe-connect-commerce.spec.ts` — mocked-Stripe full browser flow.

### Modify

- `backend/package.json`, `package-lock.json` — add current Stripe SDK and test helpers only.
- `backend/src/config.ts`, `config.test.ts`, `.env.example` — Stripe, webhook, scheduler, and payment-method configuration validation.
- `backend/src/app.ts`, `app.test.ts` — raw webhook mount order, commerce/account/sweeper routes, and production dependencies.
- `backend/src/catalog/repository.ts`, `service.ts`, `types.ts` — transactional purchasable-variant and inventory operations needed by checkout.
- `backend/src/auth/permissions.ts` — `payments:view`, `payments:manage`, `orders:refund` store permissions.
- `jellyshops/package.json`, `package-lock.json` — add `@stripe/stripe-js` and `@stripe/react-stripe-js`.
- `jellyshops/src/app/[storeSlug]/checkout/page.tsx` — replace `repository.checkout` with server checkout-attempt + Payment Element UX.
- `jellyshops/src/app/[storeSlug]/order/[orderId]/page.tsx` — remove; Next.js cannot register both `[orderId]` and `[publicToken]` at the same route level.
- `jellyshops/src/app/admin/orders/page.tsx`, `jellyshops/src/app/admin/orders/[id]/page.tsx` — API-backed orders, fulfilment, full refund, and dispute state.
- `jellyshops/src/components/admin-nav.tsx` — Payments & payouts navigation.
- `jellyshops/src/lib/providers.ts`, `repository.ts`, `domain.ts`, and their tests — remove mock payment confirmation/order authority while retaining cart-only demo support during migration.
- `jellyshops/playwright.config.ts`, `scripts/run-playwright.mjs` — start isolated frontend/API test services and inject test Stripe behavior.

### Existing files used as contracts/tests

- `backend/src/auth/middleware.ts`, `backend/src/tenants/store-context.ts` — authenticated merchant/store boundaries.
- `backend/src/http/errors.ts` — API error shape.
- `backend/src/catalog/routes.ts` — Zod + router conventions.
- `backend/src/media/routes.test.ts`, `backend/src/storefront/workspace/routes.test.ts` — Supertest route-test conventions.
- `jellyshops/src/features/store-editor/api/client.ts` — browser API-client error and bearer-token conventions.
- `jellyshops/e2e/first-order.spec.ts` — current mock-order flow to replace rather than silently retain.

## Tasks

### Task 1: Add the PostgreSQL commerce schema and transaction repository

**Files:**
- Create: `backend/sql/migrations/20260915120000_add_stripe_connect_commerce.sql`
- Create: `backend/src/commerce/repository.ts`, `backend/src/commerce/repository.test.ts`
- Create: `backend/vitest.integration.config.ts`
- Modify: `backend/src/catalog/repository.ts`, `backend/src/catalog/types.ts`, `backend/package.json`
- Test: `backend/test/integration/stripe-connect-commerce.test.ts`

**Interfaces:**
- Consumes: `InventoryLevel(storeId, variantId, quantity, reserved)` and `CatalogRepository`.
- Produces: `CommerceRepository.withCheckoutLock(storeId, cartKey, work)`, `reserveVariants(input)`, `releaseAttempt(attemptId)`, `convertAttemptToSold(attemptId)`, and typed rows used by Tasks 4–12.

- [ ] Write failing PGlite tests for `UPDATE "InventoryLevel" SET "reserved" = "reserved" + $3 WHERE "storeId" = $1 AND "variantId" = $2 AND "quantity" - "reserved" >= $3 RETURNING *`, asserting only one of two simultaneous final-unit reservations succeeds.
- [ ] Run: `npx --prefix backend vitest run --config vitest.integration.config.ts test/integration/stripe-connect-commerce.test.ts` — expect failure because commerce tables and repository do not exist.
- [ ] Create tables with these minimum columns: `StripeConnectedAccount(storeId PK, stripeAccountId UNIQUE, cardPaymentsStatus, payoutsStatus, requirements JSONB, closedAt)`; `Order(id PK, storeId, number, publicToken UNIQUE, status, fulfilmentStartedAt, customerSnapshot JSONB, subtotalMinor, shippingMinor, totalMinor, currency)`; `OrderItem(orderId, variantId, titleSnapshot, skuSnapshot, imageSnapshot, unitPriceMinor, quantity)`; `Payment(id PK, orderId UNIQUE, stripeAccountId, paymentIntentId UNIQUE NULL, chargeId UNIQUE NULL, status, amountMinor, currency)`; `CheckoutAttempt(id PK, orderId NOT NULL UNIQUE, storeId, cartKey, cartHash, stripeIdempotencyKey UNIQUE, paymentIntentId UNIQUE NULL, status, expiresAt)`; `InventoryReservation(attemptId, variantId, quantity, status, expiresAt)`; `Refund(id PK, orderId, paymentId, stripeRefundId UNIQUE NULL, amountMinor, status, inventoryRestoredAt NULL)`; `PaymentDispute(paymentId, stripeDisputeId UNIQUE, status)`; `StripeWebhookEvent(id PK, endpointFamily, stripeEventId UNIQUE, stripeAccountId NULL, type, payload JSONB, receivedAt, processedAt NULL)`; `WebhookProcessingAttempt(eventId, attemptNo, errorMessage NULL, startedAt, finishedAt NULL)`; and `PublicOrderAccessRateLimit(storeId, ipHash, windowStartedAt, requestCount)`. Add store/variant foreign keys, tenant indexes, `CheckoutAttempt.orderId NOT NULL`, and lifecycle/amount check constraints.
- [ ] Add `vitest.integration.config.ts` with `include: ["test/integration/**/*.test.ts"]` and a `test:integration` package script using that config.
- [ ] Implement `CommerceRepository` with `SELECT pg_advisory_xact_lock(hashtext($1))` for a store/cart lock and the conditional inventory update above; never compute availability in TypeScript before writing.
- [ ] Run focused tests and `npm --prefix backend test` — expect pass.
- [ ] Commit: `git add backend/sql/migrations/20260915120000_add_stripe_connect_commerce.sql backend/src/commerce/repository.ts backend/src/commerce/repository.test.ts backend/test/integration/stripe-connect-commerce.test.ts backend/vitest.integration.config.ts backend/package.json backend/src/catalog && git commit -m "feat: add durable commerce schema"`.

### Task 2: Add Stripe configuration and server client boundaries

**Files:**
- Create: `backend/src/stripe/client.ts`, `backend/src/stripe/client.test.ts`
- Modify: `backend/src/config.ts`, `backend/src/config.test.ts`, `backend/.env.example`, `backend/package.json`, `backend/package-lock.json`
- Test: `backend/src/stripe/client.test.ts`, `backend/src/config.test.ts`

**Interfaces:**
- Consumes: `AppConfig`.
- Produces: `StripeGateway` with `createAccountV2`, `createAccountLink`, `retrieveAccountV2`, `createDirectPaymentIntent`, `cancelPaymentIntent`, `createFullRefund`, and `constructEvent`.

- [ ] Write failing config tests requiring `STRIPE_SECRET_KEY`, `STRIPE_ACCOUNTS_V2_VERSION`, `STRIPE_CARD_PAYMENT_METHOD_CONFIGURATION_ID`, `STRIPE_ACCOUNTS_V2_WEBHOOK_SECRET`, `STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET`, and `SCHEDULER_SECRET` in production.
- [ ] Run: `npm --prefix backend test -- src/config.test.ts src/stripe/client.test.ts` — expect missing module/config failures.
- [ ] Add the Stripe SDK and a `StripeClient` factory. Read secrets only from `AppConfig`; expose no secret to a response, log, frontend bundle, or test snapshot. Construct direct-charge calls with `{ stripeAccount: connectedAccountId, idempotencyKey }`, metadata `{ jelly_order_id, jelly_checkout_attempt_id }`, and no `application_fee_amount`.
- [ ] Configure card-only behavior by passing the configured payment-method configuration ID, not `payment_method_types`.
- [ ] Run focused tests and `npm --prefix backend run typecheck` — expect pass.
- [ ] Commit: `git add backend/package.json backend/package-lock.json backend/src/config.ts backend/src/config.test.ts backend/src/stripe backend/.env.example && git commit -m "feat: add Stripe server configuration"`.

### Task 3: Create Accounts v2 merchant onboarding and synchronization APIs

**Files:**
- Create: `backend/src/stripe/accounts/types.ts`, `repository.ts`, `service.ts`, `routes.ts`, `service.test.ts`, `routes.test.ts`
- Modify: `backend/src/auth/permissions.ts`, `backend/src/app.ts`
- Test: `backend/src/stripe/accounts/service.test.ts`, `backend/src/stripe/accounts/routes.test.ts`

**Interfaces:**
- Consumes: `StripeGateway`, `CommerceRepository`, `requireMerchant`, `requireStorePermission`.
- Produces: `POST /api/stores/:storeId/stripe-connect/onboarding-link`, `GET /api/stores/:storeId/stripe-connect/status`, `StripeAccountService.syncAccount(accountId)`.

- [ ] Write failing tests asserting the Accounts v2 create request is exactly `dashboard: "full"`, `fees_collector: "stripe"`, `losses_collector: "stripe"`, and merchant card payments requested; assert legacy account type fields are absent.
- [ ] Run: `npm --prefix backend test -- src/stripe/accounts/service.test.ts src/stripe/accounts/routes.test.ts` — expect failure.
- [ ] Implement account creation/reuse, hosted Account Link creation, and state synchronization from `configuration.merchant.capabilities.card_payments.status` and `configuration.merchant.capabilities.stripe_balance.payouts.status` into `StripeConnectedAccount`.
- [ ] Require `payments:manage` for link creation and `payments:view` for status; return a redacted status DTO without Stripe secrets.
- [ ] Run focused tests and `npm --prefix backend test` — expect pass.
- [ ] Commit: `git add backend/src/stripe/accounts backend/src/auth/permissions.ts backend/src/app.ts && git commit -m "feat: add Accounts v2 merchant onboarding"`.

### Task 4: Define checkout commands, deterministic hashing, and durable reservation state

**Files:**
- Create: `backend/src/commerce/types.ts`, `service.ts`, `service.test.ts`, `routes.ts`, `routes.test.ts`
- Modify: `backend/src/app.ts`, `backend/src/http/errors.ts`
- Test: `backend/src/commerce/service.test.ts`, `backend/src/commerce/routes.test.ts`

**Interfaces:**
- Consumes: `CommerceRepository`, `CatalogRepository`, `StripeAccountService.getLivePaymentReadiness(storeId)`.
- Produces: `CheckoutService.begin(input): Promise<CheckoutAttemptResult>` and `POST /api/public/stores/:storeId/checkout/attempts`.

- [ ] Write failing unit tests for a canonical SHA-256 cart hash over sorted `{variantId, quantity, unitPriceMinor, shippingMinor, currency}` lines; test that a changed quantity or server price makes a new hash.
- [ ] Run: `npm --prefix backend test -- src/commerce/service.test.ts src/commerce/routes.test.ts` — expect failure.
- [ ] Implement public request validation for cart key, variant quantities, contact/address, and no client price/total. Re-read active products/variants and calculate totals server-side.
- [ ] In one checkout-lock transaction, reuse only unexpired matching attempts in `PAYMENT_INTENT_CREATING`/payment-awaiting state; otherwise conditionally cancel the old pending order, release old reservations, reserve the new lines, insert `Order(PENDING_PAYMENT)`, `Payment(CREATING)`, and `CheckoutAttempt(PAYMENT_INTENT_CREATING)` with a persisted random idempotency key.
- [ ] Return `409 OUT_OF_STOCK`, `409 MERCHANT_PAYMENTS_UNAVAILABLE`, or `422 CHECKOUT_INPUT_INVALID` with no partial reservation; recheck the live Accounts v2 card-payment capability inside this command.
- [ ] Run focused tests and `npm --prefix backend test` — expect pass.
- [ ] Commit: `git add backend/src/commerce backend/src/app.ts backend/src/http/errors.ts && git commit -m "feat: add durable checkout attempts"`.

### Task 5: Make direct-charge PaymentIntent creation crash-safe

**Files:**
- Create: `backend/src/commerce/payment-intents.ts`, `backend/src/commerce/payment-intents.test.ts`
- Modify: `backend/src/commerce/service.ts`, `backend/src/commerce/routes.ts`
- Test: `backend/src/commerce/payment-intents.test.ts`, `backend/src/commerce/routes.test.ts`

**Interfaces:**
- Consumes: `CheckoutAttemptResult`, `StripeGateway.createDirectPaymentIntent`, `CommerceRepository.attachPaymentIntent`.
- Produces: `CheckoutService.preparePayment(attemptId): Promise<{ orderId; publicToken; clientSecret; connectedAccountId }>`.

- [ ] Write a failing test where Stripe returns a PaymentIntent but `attachPaymentIntent` throws; a second call must use the identical persisted idempotency key and return the same intent rather than reserve stock again.
- [ ] Run: `npm --prefix backend test -- src/commerce/payment-intents.test.ts` — expect failure.
- [ ] Implement `preparePayment`: lock attempt, reject expired/cancelled attempts, recover an attached intent, call Stripe with persisted key and direct-account context when unattached, then transactionally attach PaymentIntent/Charge references before revealing `clientSecret`.
- [ ] On a definitive Stripe error, conditionally set attempt/order to cancelled and release reservations in one transaction. On timeout/unknown result, retain `PAYMENT_INTENT_CREATING` for retry recovery.
- [ ] Run focused tests and `npm --prefix backend test` — expect pass.
- [ ] Commit: `git add backend/src/commerce/payment-intents.ts backend/src/commerce/payment-intents.test.ts backend/src/commerce/service.ts backend/src/commerce/routes.ts && git commit -m "feat: recover Stripe payment intent creation"`.

### Task 6: Add customer Stripe checkout and public order API

**Files:**
- Create: `jellyshops/src/features/commerce/api/types.ts`, `client.ts`, `client.test.ts`, `commerce-store-id.ts`, `commerce-store-id.test.ts`, `components/payment-element-checkout.tsx`, `components/payment-element-checkout.test.tsx`
- Modify: `jellyshops/package.json`, `package-lock.json`, `jellyshops/src/app/[storeSlug]/checkout/page.tsx`
- Create: `jellyshops/src/app/[storeSlug]/order/[publicToken]/page.tsx`, `jellyshops/src/app/[storeSlug]/order/[publicToken]/page.test.tsx`
- Remove: `jellyshops/src/app/[storeSlug]/order/[orderId]/page.tsx`
- Test: the created frontend tests

**Interfaces:**
- Consumes: Task 4 public attempt endpoint and Task 5 payment preparation result.
- Produces: `CommerceApi.createAttempt`, `CommerceApi.preparePayment`, `CommerceApi.getPublicOrder`, and `PaymentElementCheckout`.

- [ ] Write failing component tests proving the checkout button creates an attempt, mounts `Elements` with the returned connected account and client secret, and never displays “Place mock order”.
- [ ] Run: `npm --prefix jellyshops test -- src/features/commerce/components/payment-element-checkout.test.tsx` — expect module/test failure.
- [ ] Add Stripe.js dependencies and implement an API client patterned after `features/store-editor/api/client.ts`; centralize the demo `sweet-bakes -> store-demo` mapping instead of duplicating it.
- [ ] Replace `repository.checkout` with server submission, Payment Element confirmation, polling/public-token navigation until webhook-confirmed state is visible. Do not mark an order paid from the browser confirmation result.
- [ ] Move the public route to `[publicToken]` and make it call `GET /api/public/stores/:storeId/orders/:publicToken`; remove the old `[orderId]` route because two dynamic segment names at this directory level are unsupported by Next.js.
- [ ] Run focused tests, `npm --prefix jellyshops test`, and `npm --prefix jellyshops run typecheck` — expect pass.
- [ ] Commit: `git add jellyshops/package.json jellyshops/package-lock.json jellyshops/src/features/commerce jellyshops/src/app/[storeSlug]/checkout jellyshops/src/app/[storeSlug]/order && git commit -m "feat: add Stripe customer checkout"`.

### Task 7: Ingest Accounts v2 thin events durably

**Files:**
- Create: `backend/src/stripe/webhooks/types.ts`, `receipt-repository.ts`, `accounts-v2-route.ts`, `accounts-v2-route.test.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/stripe/webhooks/accounts-v2-route.test.ts`

**Interfaces:**
- Consumes: `StripeGateway.constructEvent`, `StripeAccountService.syncAccount`, `StripeWebhookEvent` schema.
- Produces: `POST /webhooks/stripe/accounts-v2` durable receipt endpoint and `processAccountsV2Event(eventId)`.

- [ ] Write failing Supertest tests that invalid signatures return 400 without inserting a receipt, duplicate event IDs insert once, and a thin `v2.core.account[requirements].updated` uses `related_object.id`.
- [ ] Run: `npm --prefix backend test -- src/stripe/webhooks/accounts-v2-route.test.ts` — expect failure.
- [ ] Mount `express.raw({ type: "application/json" })` for this route before `express.json()`. Verify `STRIPE_ACCOUNTS_V2_WEBHOOK_SECRET`, insert the receipt with a unique event ID, return 200 after durable receipt, and process/retry separately.
- [ ] Subscribe only to the frozen thin event list. Retrieve current Accounts v2 state after non-closed events; for `v2.core.account.closed`, mark the account closed/unavailable by `related_object.id` without retrieval.
- [ ] Run focused tests and `npm --prefix backend test` — expect pass.
- [ ] Commit: `git add backend/src/stripe/webhooks backend/src/app.ts && git commit -m "feat: ingest Accounts v2 thin events"`.

### Task 8: Ingest connected-account payment, refund, and dispute events durably

**Files:**
- Create: `backend/src/stripe/webhooks/connect-payments-route.ts`, `processor.ts`, `processor.test.ts`, `connect-payments-route.test.ts`
- Modify: `backend/src/commerce/repository.ts`, `backend/src/commerce/service.ts`
- Test: `backend/src/stripe/webhooks/connect-payments-route.test.ts`, `processor.test.ts`

**Interfaces:**
- Consumes: durable receipt records, `event.account`, payment/order/reservation repository methods.
- Produces: `POST /webhooks/stripe/connect-payments` and `processConnectPaymentEvent(eventId)`.

- [ ] Write failing tests for `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `refund.created`, `refund.updated`, `refund.failed`, `charge.refunded`, `charge.dispute.created`, and `charge.dispute.closed`; assert the store is resolved only from top-level `event.account`.
- [ ] Run: `npm --prefix backend test -- src/stripe/webhooks/connect-payments-route.test.ts src/stripe/webhooks/processor.test.ts` — expect failure.
- [ ] Verify `STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET`, persist receipt before acknowledgement, and process all event types idempotently. Persist processing attempts/errors so a worker can retry after a crash.
- [ ] Use conditional transitions: payment success converts held reservation to sold; cancellation only releases a still-pending attempt; payment failure only records failure; older events cannot revert paid/refunded/cancelled terminal states.
- [ ] Run focused tests and `npm --prefix backend test` — expect pass.
- [ ] Commit: `git add backend/src/stripe/webhooks backend/src/commerce && git commit -m "feat: process direct charge webhooks"`.

### Task 9: Implement refund, dispute, fulfilment, and reservation-expiry state machines

**Files:**
- Create: `backend/src/commerce/refunds.ts`, `refunds.test.ts`, `sweeper.ts`, `sweeper-routes.ts`, `sweeper.test.ts`, `backend/scripts/run-reservation-sweeper.mjs`
- Modify: `backend/src/commerce/service.ts`, `routes.ts`, `backend/src/app.ts`
- Test: `backend/src/commerce/refunds.test.ts`, `sweeper.test.ts`

**Interfaces:**
- Consumes: Task 8 processor and `Payment`/`Refund`/`InventoryReservation` rows.
- Produces: `POST /api/stores/:storeId/orders/:orderId/refunds`, `POST /internal/commerce/reservations/sweep`, `sweepExpiredReservations(now)`.

- [ ] Write failing tests for duplicate refund clicks, Stripe pending refund, failed refund, full refund before `PROCESSING`, full refund after `PROCESSING`, and a sweep racing `payment_intent.succeeded`.
- [ ] Run: `npm --prefix backend test -- src/commerce/refunds.test.ts src/commerce/sweeper.test.ts` — expect failure.
- [ ] Permit one full refund only for a paid non-refunded order and create a `Refund(PENDING)` before Stripe call. Update refund state only from durable webhook processing; restore inventory once only when fulfilment has not started (`PENDING` or `CONFIRMED`).
- [ ] Implement the every-minute sweeper with `UPDATE ... WHERE order.status = 'PENDING_PAYMENT' AND attempt.expiresAt <= now() RETURNING ...`; cancel the linked intent after winning the conditional transition, release held stock, and treat already-succeeded cancellation as a no-op race.
- [ ] Protect the sweep route with constant-time `SCHEDULER_SECRET` comparison and make the script send that header; do not expose it to browsers.
- [ ] Run focused tests and `npm --prefix backend test` — expect pass.
- [ ] Commit: `git add backend/src/commerce backend/scripts/run-reservation-sweeper.mjs backend/src/app.ts && git commit -m "feat: add refund and reservation workers"`.

### Task 10: Add merchant payments, order management, refund, and dispute UI

**Files:**
- Create: `jellyshops/src/features/commerce/merchant-session.ts`, `components/merchant-payments-panel.tsx`, `components/merchant-payments-panel.test.tsx`, `components/order-payment-panel.tsx`, `components/order-payment-panel.test.tsx`, `jellyshops/src/app/admin/payments/page.tsx`, `jellyshops/src/app/admin/payments/page.test.tsx`
- Modify: `jellyshops/src/app/admin/orders/page.tsx`, `jellyshops/src/app/admin/orders/[id]/page.tsx`, `jellyshops/src/components/admin-nav.tsx`
- Test: the created component/page tests

**Interfaces:**
- Consumes: merchant account status, order DTO, refund endpoint, existing store permission model.
- Produces: Payments & payouts admin route and API-backed order payment controls.

- [ ] Write failing tests for inactive-card capability copy, onboarding-link launch, closed-account warning, full-refund confirmation, pending/failed refund display, and disputed-payment badge without changing fulfilment badge.
- [ ] Run: `npm --prefix jellyshops test -- src/features/commerce/components/merchant-payments-panel.test.tsx src/features/commerce/components/order-payment-panel.test.tsx` — expect failure.
- [ ] Implement the merchant token adapter with a development `jelly-demo-merchant` path and a Firebase-ID-token provider boundary; never source authorization from the local repository.
- [ ] Add Payments & payouts navigation/page with account readiness, payout status, requirements summary, onboarding/resume action, and Full Stripe Dashboard link supplied only by the server.
- [ ] Replace local order list/detail reads and transitions with merchant order API calls. Add a confirmation dialog for the full refund endpoint and display refund/dispute states separately from fulfilment.
- [ ] Run focused tests, `npm --prefix jellyshops test`, and typecheck — expect pass.
- [ ] Commit: `git add jellyshops/src/features/commerce jellyshops/src/app/admin jellyshops/src/components/admin-nav.tsx && git commit -m "feat: add merchant Stripe commerce controls"`.

### Task 11: Add public security, authorization, and rate-limit enforcement

**Files:**
- Create: `backend/src/commerce/rate-limit.ts`, `rate-limit.test.ts`
- Modify: `backend/src/commerce/routes.ts`, `backend/src/stripe/accounts/routes.ts`, `backend/src/auth/permissions.ts`
- Test: `backend/src/commerce/routes.test.ts`, `backend/src/commerce/rate-limit.test.ts`

**Interfaces:**
- Consumes: `PublicOrderAccessRateLimit`, `requireStorePermission`, public token lookup.
- Produces: bounded public order access and explicit store payment/refund permissions.

- [ ] Write failing Supertest tests for an invalid/expired 128-bit token, six rapid public lookups from one IP/store, cross-tenant refund access, and checkout when capability becomes inactive after the client loaded.
- [ ] Run: `npm --prefix backend test -- src/commerce/routes.test.ts src/commerce/rate-limit.test.ts` — expect failure.
- [ ] Generate public tokens with `randomBytes(32).toString("base64url")`; compare via indexed lookup, return the same 404 response for unknown/foreign tokens, and enforce a database-backed per-store/IP window.
- [ ] Add and enforce `payments:view`, `payments:manage`, and `orders:refund`; run `requireStorePermission` before looking up merchant order IDs.
- [ ] Run focused tests and `npm --prefix backend test` — expect pass.
- [ ] Commit: `git add backend/src/commerce backend/src/stripe/accounts backend/src/auth/permissions.ts && git commit -m "feat: secure commerce APIs"`.

### Task 12: Remove mock payment authority and migrate existing flows safely

**Files:**
- Modify: `jellyshops/src/lib/providers.ts`, `repository.ts`, `domain.ts`, and their tests; `jellyshops/e2e/first-order.spec.ts`; `jellyshops/src/app/[storeSlug]/checkout/page.tsx`; `jellyshops/src/app/[storeSlug]/order/[publicToken]/page.tsx`
- Test: `jellyshops/src/lib/repository.test.ts`, `jellyshops/e2e/first-order.spec.ts`

**Interfaces:**
- Consumes: Tasks 6, 8, and 10 APIs.
- Produces: cart-only local repository with no method that can create a paid order or mutate paid-order inventory.

- [ ] Write failing repository tests asserting `mockPayments.confirm` and `ShopRepository.checkout` are absent and a local cart mutation cannot mark an order paid.
- [ ] Run: `npm --prefix jellyshops test -- src/lib/repository.test.ts` — expect failure against current mock checkout authority.
- [ ] Remove `PaymentProvider`, `mockPayments`, local checkout order creation, and local payment stock decrement. Preserve local cart CRUD only until a server cart is introduced in a later project.
- [ ] Replace the current mock first-order E2E with an API-backed Stripe fixture flow and explicit webhook completion; remove mock-payment wording from UI.
- [ ] Run frontend tests, `npm --prefix jellyshops run test:e2e`, and typecheck — expect pass.
- [ ] Commit: `git add jellyshops/src/lib jellyshops/src/app/[storeSlug]/checkout jellyshops/src/app/[storeSlug]/order jellyshops/e2e/first-order.spec.ts && git commit -m "refactor: remove mock payment authority"`.

### Task 13: Add race/recovery integration and browser end-to-end coverage

**Files:**
- Create: `jellyshops/e2e/stripe-connect-commerce.spec.ts`
- Modify: `backend/test/integration/stripe-connect-commerce.test.ts`, `jellyshops/playwright.config.ts`, `jellyshops/scripts/run-playwright.mjs`
- Test: the listed integration/E2E files

**Interfaces:**
- Consumes: all prior backend routes and frontend API contracts.
- Produces: executable evidence for frozen concurrency, recovery, tenant, and security invariants.

- [ ] Write failing integration tests for duplicate checkout requests, simultaneous final-unit reservations, cart replacement atomically swapping holds, crash after Stripe intent creation before attachment, duplicate/out-of-order webhooks, success racing expiry/cancel, duplicate refund, failed/pending refund, duplicate restock, capability deactivation, account closure, forged signatures, cross-tenant access, and public-token replay/guess rate limits.
- [ ] Run: `npm --prefix backend run test:integration -- test/integration/stripe-connect-commerce.test.ts` — expect failures until services/routes are complete.
- [ ] Add fake Stripe gateway fixtures that return deterministic Accounts v2 records, PaymentIntents, refunds, and signed raw event payloads; use PGlite transactions for lock/race tests.
- [ ] Write Playwright coverage for onboarding status, card checkout into pending state, webhook-confirmed public order, merchant fulfilment, pre-fulfilment full refund, and dispute badge.
- [ ] Update Playwright orchestration to start backend and frontend with isolated test database/data directories and test-only Stripe gateway configuration.
- [ ] Run: `npm --prefix backend test`, `npm --prefix jellyshops test`, and `npm --prefix jellyshops run test:e2e` — expect pass.
- [ ] Commit: `git add backend/test/integration jellyshops/e2e jellyshops/playwright.config.ts jellyshops/scripts/run-playwright.mjs && git commit -m "test: cover Stripe commerce recovery flows"`.

### Task 14: Configure deployment, event destinations, scheduler, and production verification

**Files:**
- Modify: `backend/.env.example`, `jellyshops/.env.example`, `backend/README.md`, `jellyshops/README.md`, `docs/superpowers/specs/2026-09-15-stripe-connect-commerce-design.md`
- Create: `backend/docs/stripe-connect-deployment.md`
- Test: `backend/src/config.test.ts`, build/typecheck scripts

**Interfaces:**
- Consumes: all runtime configuration and endpoint contracts from Tasks 2–13.
- Produces: repeatable staging/production setup and operational verification checklist.

- [ ] Write failing production-config tests for missing Stripe secrets, missing card payment-method configuration, missing scheduler secret, and development auth enabled in production.
- [ ] Run: `npm --prefix backend test -- src/config.test.ts` — expect failure until required environment validation exists.
- [ ] Document exact Stripe Dashboard setup: enable Accounts v2; create Full Dashboard merchant configuration; create thin `Your account` destination for the frozen Accounts v2 event types; create snapshot `Connected accounts` destination for the frozen payment/refund/dispute types; copy separate endpoint secrets into the secrets manager.
- [ ] Document deployment scheduler calling `node backend/scripts/run-reservation-sweeper.mjs` every minute with `SCHEDULER_SECRET`, database migration application order, restricted Stripe API-key permissions, webhook IP/CSP protections, and Stripe Sandbox staging tests.
- [ ] Run: `npm --prefix backend run typecheck`, `npm --prefix backend run build`, `npm --prefix jellyshops run typecheck`, `npm --prefix jellyshops run build`, and the complete test suites — expect pass.
- [ ] Commit: `git add backend/.env.example jellyshops/.env.example backend/README.md jellyshops/README.md backend/docs/stripe-connect-deployment.md backend/src/config.test.ts && git commit -m "docs: document Stripe Connect deployment"`.

## Plan self-review

- Spec coverage: Tasks 1–14 cover every frozen requirement: Accounts v2 Configuration B, direct charges, full dashboard, no application fees, capability gating, durable checkout/recovery, reservations, two distinct webhook destinations, refunds, disputes, security, and production verification.
- Placeholder scan: this plan contains no deferred work markers and every task identifies files, interfaces, test command, expected initial failure, implementation behavior, verification, and commit command.
- Interface consistency: `CheckoutAttempt.orderId`, `PAYMENT_INTENT_CREATING`, `StripeGateway`, `CommerceRepository`, `StripeAccountService`, `processAccountsV2Event`, and `processConnectPaymentEvent` are introduced before their consumers.
- Dependency order: persistence precedes Stripe/account services; checkout precedes client UI; durable webhooks precede refund/sweeper/admin UI; authority removal follows the new end-to-end path; deployment is last.
- Legacy audit: no task uses Accounts v1 creation, legacy Express fields, `charges_enabled`, `payouts_enabled`, or application fees.
