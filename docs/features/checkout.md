# Cart and checkout

Code: `backend/src/commerce/{routes,service,payment-intents,repository,rate-limit,sweeper}.ts`, `jellyshops/src/app/[storeSlug]/checkout/page.tsx`, `components/cart-panel.tsx`, `features/commerce/components/payment-element-checkout.tsx`. Tables: `CheckoutAttempt`, `InventoryReservation`, `Order`, `OrderItem`, `Payment`, `StoreOrderCounter` ([schema](../architecture/database-schema.md)).

## Flow

1. **Cart (browser).** Items live in the browser (`lib/repository.ts`, localStorage key `jelly-shop-state-v1`). Prices in the browser are display only.
2. **Begin checkout.** `POST /api/public/stores/:storeId/checkout/attempts` with `cartKey`, items, currency, customer and delivery snapshots. `CheckoutService.begin()`:
   - rejects a currency or delivery country that does not match the store's checkout policy (`CHECKOUT_CURRENCY_MISMATCH`, `CHECKOUT_DELIVERY_COUNTRY_INVALID`, `MARKET_PAYMENTS_UNAVAILABLE`);
   - re-prices every line from the database (`validateCart`: subtotal, shipping from policy, total, `fulfillmentType`), requires the store's Stripe account to be ready for live payments (otherwise `409 MERCHANT_PAYMENTS_UNAVAILABLE`);
   - hashes the cart + customer + delivery; under a per-cart lock (`withCheckoutLock`) it reuses the existing attempt if the hash matches, otherwise cancels it (and its Stripe intent) and creates a new one;
   - `createCheckout` inserts the `Order` (`PENDING_PAYMENT`, unguessable `publicToken`, per-store order number), `OrderItem` snapshots (title, SKU, image, unit price, configuration) and inventory reservations, in one transaction.
   - Digital-only carts do not need a delivery country.
   - Access is rate limited (`assertCheckoutAccess`, `PublicOrderRateLimiter`).
3. **Prepare payment.** `POST .../checkout/payment-intent` with `attemptId`. `PaymentIntentService.preparePayment()` creates or retrieves the Stripe PaymentIntent on the connected account and returns `clientSecret` + `connectedAccountId` for Stripe Elements. It never creates orders.
4. **Pay (browser).** Stripe Payment Element confirms the intent using the publishable key `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and the connected account id.
5. **Settle (webhook).** Stripe calls `/webhooks/stripe/connect-payments`; `processConnectPaymentEvent` marks the `Payment` and `Order` and converts or releases reservations. The browser result is never trusted. See [payment-system](payment-system.md).
6. **Confirmation.** `/[storeSlug]/order/[publicToken]` polls `GET /api/public/stores/:storeId/orders/:publicToken`. A balance-due page exists at `.../order/[publicToken]/balance` for order edits that increase the total.
7. **Expiry.** `ReservationSweeper` (called by `POST /internal/commerce/reservations/sweep`) releases reservations of abandoned attempts.

## Rules that must stay true

- The server, not the browser, decides prices, shipping and totals.
- Reservations and order insertion happen in the same transaction as the attempt.
- Any change to buyer/delivery data invalidates attempt reuse (hash).
- Every query is filtered by `storeId`.
