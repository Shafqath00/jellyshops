# Cart and checkout

Code: `backend/src/commerce/{routes,service,payment-intents,repository,rate-limit,sweeper}.ts`, `jellyshops/src/features/checkout/` (the checkout every theme uses), `jellyshops/src/app/[storeSlug]/checkout/`, `features/storefront/components/cart-panel.tsx`. Tables: `CheckoutAttempt`, `InventoryReservation`, `Order`, `OrderItem`, `Payment`, `StoreOrderCounter` ([schema](../architecture/database-schema.md)).

## Flow

1. **Cart (browser).** Items live in the browser (`lib/repository.ts`, localStorage key `jelly-shop-state-v1`). Prices in the browser are display only.
2. **Begin checkout.** `POST /api/public/stores/:storeId/checkout/attempts` with `cartKey`, items, currency, customer and delivery snapshots. `CheckoutService.begin()`:
   - rejects a currency or delivery country that does not match the store's checkout policy (`CHECKOUT_CURRENCY_MISMATCH`, `CHECKOUT_DELIVERY_COUNTRY_INVALID`, `MARKET_PAYMENTS_UNAVAILABLE`);
   - re-prices every line from the database (`validateCart`: subtotal, shipping from policy, total, `fulfillmentType`), requires the store's Stripe account to be ready for live payments (otherwise `409 MERCHANT_PAYMENTS_UNAVAILABLE`);
   - hashes the cart + customer + delivery; under a per-cart lock (`withCheckoutLock`) it reuses the existing attempt if the hash matches, otherwise cancels it (and its Stripe intent) and creates a new one;
   - `createCheckout` inserts the `Order` (`PENDING_PAYMENT`, unguessable `publicToken`, per-store order number), `OrderItem` snapshots (title, SKU, image, unit price, configuration) and inventory reservations, in one transaction.
   - Digital-only carts do not need a delivery country.
   - Access is rate limited (`assertCheckoutAccess`, `PublicOrderRateLimiter`).
3. **Prepare payment.** `POST .../checkout/payment-intent` with `attemptId`. `PaymentIntentService.preparePayment()` creates or retrieves the Stripe PaymentIntent on the connected account and returns `clientSecret` + `connectedAccountId` for Stripe Elements, plus `totals` (subtotal, shipping, total and the PaymentIntent's `amountMinor`) so the page shows what will really be charged. It never creates orders.
4. **Pay (browser).** Stripe Payment Element confirms the intent using the publishable key `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and the connected account id.
5. **Settle (webhook).** Stripe calls `/webhooks/stripe/connect-payments`; `processConnectPaymentEvent` marks the `Payment` and `Order` and converts or releases reservations. The browser result is never trusted. See [payment-system](payment-system.md).
6. **Confirmation.** After a card payment the page empties the bag and goes to `/[storeSlug]/order/[publicToken]?paid=1`; bank or wallet methods come back there through Stripe's `return_url` (same site only, https only, http allowed on localhost). The page polls `GET /api/public/stores/:storeId/orders/:publicToken`. A balance-due page exists at `.../order/[publicToken]/balance` for order edits that increase the total.
7. **Expiry.** `ReservationSweeper` (called by `POST /internal/commerce/reservations/sweep`) releases reservations of abandoned attempts.

## Rules that must stay true

- The server, not the browser, decides prices, shipping and totals.
- Reservations and order insertion happen in the same transaction as the attempt.
- Any change to buyer/delivery data invalidates attempt reuse (hash).
- Every query is filtered by `storeId`.

## Checkout template (one for every theme)

Every store and theme draws the same checkout from `jellyshops/src/features/checkout/`. Themes never ship their own checkout; a theme shell only wraps it in the page frame (header, footer).

| File | What it does |
| --- | --- |
| `use-checkout.ts` | All the logic: bag lines, the shopper's details, the step (details or payment), asking the server to price the order and create the PaymentIntent, emptying the bag after payment. |
| `checkout-model.ts` | Pure rules: bag lines, address wording per country (Postcode / ZIP code / PIN code), field checks, the attempt request body (no prices), the safe return address. |
| `checkout-errors.ts` | Plain messages for every API error code; shoppers never see codes. |
| `checkout-tokens.ts` | The list of `--checkout-*` tokens and `stripeAppearance()`, which builds the Stripe card form's look from them. |
| `checkout.css` | The only checkout stylesheet. Part 1 defines the tokens; the rest reads only tokens. |
| `use-clear-bag.ts` | Empties the bag when a shopper comes back from a Stripe redirect. |
| `components/checkout-view.tsx` | Puts the parts together and picks the state: loading, empty bag, details, payment. |
| `components/checkout-layout.tsx` | Page frame: title, steps (Bag › Details › Payment), form on the left and summary on the right from 1024px; one column below, with the summary folded at the top. |
| `components/contact-delivery-form.tsx` | Contact and delivery fields with labels, inline errors and autocomplete. |
| `components/details-recap.tsx` | The details folded to two lines with Change, once payment is ready. |
| `components/payment-step.tsx` | Stripe Payment Element and the Pay button. |
| `components/order-summary.tsx` | Lines, subtotal, delivery and total (an estimate first, then the server's figures). |
| `components/checkout-states.tsx` | Loading skeleton, empty bag, error banner. |
| `components/checkout-confirmation.tsx` | Paid, waiting, failed, cancelled and refunded states, used by the order page. |

### Changing the look (theme tokens)

`checkout.css` sets each token on `.jelly-checkout` from the theme's contract tokens, with a neutral fallback:

| Token | Reads | Used for |
| --- | --- | --- |
| `--checkout-bg`, `--checkout-surface`, `--checkout-wash` | `--j-color-bg`, `--j-color-surface`, `--j-color-wash` | Page, fields, summary panel |
| `--checkout-text`, `--checkout-muted` | `--j-color-text`, `--j-color-muted` | Text, labels, hints |
| `--checkout-border`, `--checkout-divider` | 58% of the text colour on the field colour (so field edges keep 3:1 contrast), `--j-color-divider` | Field borders, lines |
| `--checkout-primary`, `--checkout-on-primary` | `--j-color-primary`, `--j-color-on-primary` | Continue and Pay buttons, focus ring |
| `--checkout-danger`, `--checkout-success` | fixed | Errors, the paid tick |
| `--checkout-font-body`, `--checkout-font-heading` | `--j-font-body`, `--j-font-heading` | Text and headings |
| `--checkout-radius`, `--checkout-radius-field`, `--checkout-radius-button` | `--j-radius-card`, `--j-radius-field`, `--j-radius-button` | Corners |
| `--checkout-field-height`, `--checkout-button-height`, `--checkout-space`, `--checkout-max-width`, `--checkout-summary-width` | `--j-field-height`, `--j-button-height` | Sizes and the 8px spacing step |

So a theme changes checkout through its normal colour, font and corner settings. To give one store its own checkout look later, set `--checkout-*` values on an ancestor of `.jelly-checkout` (for example from a store setting written as an inline style on the checkout page); no layout or logic changes. The store logo and name come from the theme's header around the page.

The Stripe card form runs in Stripe's own frame, so `stripeAppearance()` copies the token values into Stripe's appearance options. Only plain colours are copied, and theme web fonts fall back to the system font there. Never put fixed colours in `checkout.css` outside part 1, and don't style `.jelly-checkout` from a theme file.

## Checkout and Stripe: setup and testing

Payments go to each store owner's own Stripe account (Stripe Connect, direct charges on the connected account). Card details are typed only into Stripe's Payment Element; they never reach our servers.

1. **Keys (test mode first).** In the Stripe Dashboard (test mode), copy the secret key into `backend/.env` as `STRIPE_SECRET_KEY=sk_test_…` and the publishable key of the *same* platform account into `jellyshops/.env.local` as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…`. Set `STRIPE_ACCOUNTS_V2_VERSION` as described in `backend/.env.example`. Secret keys only ever live in the backend environment (a secret manager in production); nothing with a `NEXT_PUBLIC_` prefix may hold a secret.
2. **Connect.** Turn on Connect in the Dashboard. Each merchant connects from Admin > Payments (`/api/stores/:storeId/stripe-connect`). Checkout refuses (`MERCHANT_PAYMENTS_UNAVAILABLE`, shown as "This shop isn't taking payments yet") until that account can take payments. In test mode, onboarding can be finished with Stripe's test data.
3. **Webhooks.** Two endpoints, each with its own signing secret:
   - `/webhooks/stripe/connect-payments` (`STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET`): events from connected accounts: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `refund.*`, `charge.dispute.*`.
   - `/webhooks/stripe/accounts-v2` (`STRIPE_ACCOUNTS_V2_WEBHOOK_SECRET`): connected-account status.

   Every request's `Stripe-Signature` is checked against the raw body before anything is read, and each event id is stored once (`receipt-repository.ts`), so Stripe's retries never change anything twice. An order only becomes paid through the webhook, never because the browser says so.

   Locally, with the Stripe CLI: `stripe listen --forward-connect-to localhost:3001/webhooks/stripe/connect-payments`, then put the `whsec_…` it prints into `STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET`.
4. **Test cards** (any future expiry date, any CVC, any postcode):
   - `4242 4242 4242 4242`: pays straight away.
   - `4000 0025 0000 3155`: asks for 3D Secure; approve or fail it in the pop-up.
   - `4000 0000 0000 9995`: declined (insufficient funds); the page says nothing was charged.
   - `4000 0000 0000 0002`: generic decline.

   After a successful payment the order page shows "We're confirming your payment" until the webhook arrives, then "Thank you for your order". If it keeps waiting, the webhook isn't reaching the backend.
5. **Going live.** Switch both keys and both webhook secrets to live values, set `STRIPE_CARD_PAYMENT_METHOD_CONFIGURATION_ID` (required in production), and serve stores over https (the return address refuses plain http except on localhost).

### Security notes

- Prices, shipping and totals come from the database (`validateCart`). The browser sends only variant ids, quantities, option ids and personalisation text. The PaymentIntent amount is the server's total.
- Buyer details are checked on the server: a valid email, name up to 120 characters, phone up to 40, and each snapshot up to 8 KB.
- Checkout calls are rate limited per store and IP and per cart (`assertCheckoutAccess`).
- CSRF: the public checkout API uses no cookies (the optional customer sign-in is a Bearer token) and takes JSON only from the allowed origins (`CORS_ORIGINS`), so another site can't submit it on a shopper's behalf.
