# Post-purchase order tracking: analysis and design

Status: proposal for review. No code has been changed. Written 2026-10-26 from the code as it is on `local/task3`.

## 1. Current system analysis

### What exists

| Area | Current state | Where |
| --- | --- | --- |
| Checkout and order creation | Server-priced checkout, Stripe PaymentIntent, order created as `PENDING_PAYMENT` and moved to paid by the payment webhook | `backend/src/commerce/service.ts`, `payment-intents.ts`, `checkout-attempts.ts` |
| Order status | One `Order.status` field moved by hand through a fixed sequence `PAID → CONFIRMED → PROCESSING → SHIPPED → DELIVERED` | `backend/src/commerce/fulfilment.ts` |
| Shipments | Table `OrderFulfilment` (items, status `SHIPPED`/`DELIVERED`, `trackingNumber`, `carrier`, `trackingUrl`). Entered by the merchant | `backend/sql/migrations/20261022000000_order_management.sql`, `order-management.ts` |
| Timeline | Append-only `OrderEvent` rows written by the server. The merchant sees them; the shopper does not | `order-management.ts` (`appendOrderEvent`) |
| Returns and refunds | `OrderReturn` (items, reason, status), `OrderTransaction` for payments and refunds, refund webhooks | `order-management.ts`, `stripe/webhooks/refund-events.ts` |
| Merchant admin | Order list with search and filters, detail page with timeline and workflow dialogs, manual tracking form, notes, cancel, edit, refund | `jellyshops/src/app/admin/orders/` |
| Shopper order page | `/[storeSlug]/order/[publicToken]`: status, items, totals, payment; link to pay a balance | `jellyshops/src/app/[storeSlug]/order/[publicToken]/page.tsx` |
| Public API | Explicit projection (`getPublicOrder`): order summary, items, payment status. It deliberately omits staff data and Stripe IDs | `backend/src/commerce/service.ts`, `repository.ts` |
| Customer account | Signed-in order list and order detail (`/orders`, `/orders/:id`) returning the order, items and snapshot | `backend/src/customers/service.ts` |
| Notifications | Outbox table `OrderNotification` filled by database triggers; worker sends through SMTP; branding per store. Types: placed, payment confirmed, digital ready, processing, shipped, delivered, cancelled, refund processed | `docs/features/notifications-and-digital-delivery.md`, `commerce/notifications.ts` |
| Shipped and delivered emails | Include carrier, tracking number and link from `OrderFulfilment` | `commerce/notifications.ts` |
| Background work | `OrderOperation` queue and notification worker, run by `POST /internal/commerce/orders/work` with a scheduler secret | `commerce/order-runtime.ts` |

### What is missing or wrong

1. **Shopper cannot see shipments.** The public projection returns no fulfilment, no tracking data and no timeline, so the order page stops at "Processing" or "Shipped" with no carrier or number. The email has more information than the page.
2. **No shipping provider integration.** Tracking is typed in. Nothing fetches courier updates, and there is no tracking-event table. Delivery progress can only be known if a merchant updates it by hand.
3. **One status field does two jobs.** `Order.status` mixes payment, fulfilment and customer-facing meaning. It can only move forward one step, so it cannot express "shipment in transit", "out for delivery", "delivery failed", "delayed" or "return in progress" without new states.
4. **Missing statuses.** There is no Packed, In transit, Out for delivery, Shipment delayed, Delivery attempt failed, Returned to sender, Return requested, Returned, Refund processing or Payment failed in the customer's view.
5. **No delivery estimate.** Neither the order nor the shipment has an expected delivery date.
6. **Notifications miss important steps.** Packed, out for delivery, delayed, delivery failed, return requested and returned are not sent. Only email is supported; there is no preference or consent model in the notification docs.
7. **Shipment-level status is thin.** `OrderFulfilment.status` only holds `SHIPPED` or `DELIVERED`. Multiple shipments per order are supported by the table, but the order-level status does not roll them up.
8. **Public order link.** Access is by an unguessable `publicToken`, which is good. The link is also the only credential, so any change to what the public page shows must keep the same rule: only fields safe for the holder of the link.

### What can be reused

- `OrderEvent` as the single source for the timeline, with the same append-only guarantee.
- `OrderFulfilment` as the shipment record; extend it rather than replacing it.
- The notification outbox, its triggers and worker, and branding. New types only need new triggers and templates.
- The public projection pattern (explicit allowlist) and the publicToken access model.
- The optimistic-revision and idempotency rules the order routes already use.
- `OrderOperation` queue for provider polling and retries.
- Admin order UI components in `features/commerce/components/order-ui.tsx`.

## 2. Recommended customer flow

1. **Order placed.** Confirmation page shows the order number, items, totals, delivery address and payment status. Email sent (exists today).
2. **Payment confirmed.** Status "Payment received" (exists in data; add to the page).
3. **Processing.** The merchant has started picking the order. Status and timestamp.
4. **Packed.** New merchant action. Shown only once recorded.
5. **Shipped.** Carrier, tracking number, direct courier link, and the shipment date. Email (exists).
6. **In transit / out for delivery.** From provider events, or from the merchant when there is no provider. Only shown when an event exists.
7. **Delivered.** Date and time from the event. Email (exists).
8. **Exceptions.** Delayed, delivery attempt failed, or returned to sender. Each has a plain sentence explaining the next step and a "Contact the shop" action.
9. **Returns and refunds.** Return requested, returned, refund processing, refunded, each with its date.

The shopper page shows the timeline from `OrderEvent` rows filtered to a customer-safe list of event types. Internal notes and staff names never appear.

Order history stays in the customer account; the order detail page reuses the same component as the public page, so both show the same data.

## 3. Admin workflow

- **Queue.** The order list gets a "to fulfil" view (paid, not yet shipped) and "needs attention" (delayed, delivery failed, return waiting).
- **Process.** Mark packed, then create a shipment: choose items (partial shipments allowed), choose a carrier from a list (or type one), enter the tracking number, and optionally the tracking URL. The carrier's tracking link is built from a template when the carrier is known.
- **Update.** Manual status changes stay possible with a required reason when a provider is connected and the change would contradict its events.
- **Exceptions.** Record delay or failed attempt with a note; the customer message is generated from a template and sent once.
- **Returns and refunds.** Existing return and refund flows stay; their states feed the customer timeline.
- **Audit.** Every change is an `OrderEvent` with timestamp, source (`merchant`, `provider`, `system`), actor and reason. The admin detail page already shows these.

## 4. Shipping integration strategy

### Options

| Option | Advantages | Disadvantages |
| --- | --- | --- |
| A. Manual only (today) | No cost, no contracts, works for any courier | Status is only as current as the merchant's last update; no automatic delivery progress |
| B. One integration per courier | Direct data, often free APIs, rich events | Each courier has a different API, auth, status codes and webhook rules; large maintenance cost; most merchants use two to four couriers |
| C. Aggregator (a multi-carrier tracking service) | One API for many couriers; normalised status; webhooks; less code | Per-shipment cost; coverage varies by country and courier, so it must be checked for the UK, US and India; data passes through a third party, which needs disclosure and a data processing agreement |
| D. Shipping label and rate platform | Also buys labels and rates; tracking included | Larger scope: money moves, labels and returns; a separate product decision |

### Recommendation

Build the provider-agnostic model first (option A with the new data model), so every later source writes the same records. Then add **one aggregator (C)** behind a provider interface, because it covers many couriers with one integration. Add a direct courier integration only where a merchant's main courier is not covered or the aggregator is too expensive.

Do not build D now. It changes the product into logistics software.

Before choosing a vendor, check: coverage for the couriers merchants in UK, US and India actually use, per-shipment price, webhook support, data retention, and whether they can be used on the merchant's behalf under our data terms. These need a check with the vendor; this document does not assume any vendor's prices or coverage.

### Provider interface

```
interface TrackingProvider {
  name: string;
  register(shipment): Promise<{ providerShipmentId: string }>; // optional
  fetch(shipment): Promise<NormalizedTrackingEvent[]>;
  parseWebhook(request): NormalizedTrackingEvent[] | null;    // verifies signature
}
```

`NormalizedTrackingEvent` carries: provider event ID, shipment ID, normalised status, the courier's raw status, location, `occurredAt` (from the provider), and `receivedAt`.

### Sync

- **Webhooks first, polling as a fallback.** Webhooks deliver fast updates. A scheduled job polls shipments that have no event in the last N hours and are not delivered or closed.
- **Idempotency.** Table `ShipmentTrackingEvent` with a unique key on `(provider, providerEventId)`. A duplicate delivery is a no-op.
- **Ordering.** Events can arrive late or out of order. The shipment status is the most advanced known status by rank, not the last one received. A status only moves backwards through a documented exception (for example, "returned to sender" after "out for delivery" is valid; "in transit" after "delivered" is ignored and logged).
- **Failures.** Provider errors go to the existing `OrderOperation` queue with retry and back-off. After a limit, the shipment is flagged "tracking unavailable" for the merchant. The shopper sees "Last updated at …" and the courier link, never a guessed status.
- **Stale data.** If nothing has arrived for a set period, the shopper sees a note with the courier link rather than an assumed status.
- **Secrets.** Provider keys and webhook secrets are server-only, like the existing scheduler secret and Stripe keys.

## 5. Order status logic

Separate three axes instead of one field:

| Axis | Values | Set by |
| --- | --- | --- |
| Payment | `PENDING_PAYMENT`, `PAID`, `FAILED`, `PARTIALLY_REFUNDED`, `REFUNDED` | Stripe webhooks (exists, extend `FAILED` display) |
| Fulfilment (per order) | `UNFULFILLED`, `PARTIALLY_FULFILLED`, `FULFILLED`, `DELIVERED`, `PARTIALLY_DELIVERED` | Rolled up from shipments |
| Shipment (per shipment) | `PENDING`, `PACKED`, `SHIPPED`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `DELAYED`, `DELIVERY_FAILED`, `RETURNED_TO_SENDER`, `EXCEPTION` | Merchant or provider event |
| Return | `REQUESTED`, `APPROVED`, `RECEIVED`, `REFUND_PENDING`, `REFUNDED`, `REJECTED` | Merchant or refund webhook |
| Lifecycle | `OPEN`, `CLOSED`, `CANCELLED` (exists) | Derived |

The customer-facing headline is derived from these, using the most advanced applicable state. A state is shown only when its `OrderEvent` or `ShipmentTrackingEvent` exists. `DELAYED` and `DELIVERY_FAILED` are flags on a shipment, so they can be cleared when delivery succeeds.

Transitions are enforced in one place (a table like `fulfilmentTransitions`, extended), and every change writes an event in the same transaction.

Payment failed or abandoned checkouts do not create a visible order status for the shopper beyond "Payment not completed"; they are not shown as orders.

## 6. UI and UX structure

### Pages

- **Confirmation** (`/[storeSlug]/order/[publicToken]`): headline, order number, items, totals, delivery address, payment status, estimated delivery when set.
- **Tracking section** on the same page: progress steps (Placed, Paid, Packed, Shipped, Out for delivery, Delivered), with the current step highlighted and dates on completed steps. Exception banner when a shipment is delayed or failed.
- **Shipments**: one card per shipment with carrier, tracking number, the courier link ("Track on [carrier]") and the event history with timestamps, most recent first.
- **Support**: a "Contact the shop" link using the store's contact details, and a short reason field that opens a prefilled contact message.
- **Customer account**: the same order detail component, plus the order list.
- **Admin**: order list views (to fulfil, needs attention), shipment dialog with item selection and carrier, exception dialog, and the existing timeline.

### Design

Reuse the theme's tokens and shared components so each theme styles the tracker through its own CSS (Jelly Minimal and Jelly Avenue both). The timeline is a list with markers, not a chart; it reads on phones and needs no JavaScript. Keep colour for state only (delay and failure), using the same text-contrast rules as the theme checklists.

## 7. Backend architecture

### Data model changes (additive migrations)

- `OrderFulfilment` → rename conceptually to shipment (keep the table; add columns): `status` (full shipment set), `carrierCode`, `providerShipmentId`, `estimatedDeliveryAt`, `deliveredAt` (exists), `lastEventAt`, `trackingUrl`, `delayed`, `deliveryFailed` (booleans), `trackingState` (`OK`, `UNAVAILABLE`).
- `ShipmentItem` (optional; the existing `items` JSON can stay until needed) for partial shipments with quantity constraints.
- `ShipmentTrackingEvent`: `id`, `storeId`, `shipmentId`, `provider`, `providerEventId`, `rawStatus`, `status`, `location`, `occurredAt`, `receivedAt`; unique `(provider, providerEventId)`; append-only like `OrderEvent`.
- `TrackingProviderConnection`: per store, provider name, encrypted credentials reference, enabled flag, webhook secret reference.
- `OrderEvent`: add `source` (`MERCHANT`, `PROVIDER`, `SYSTEM`, `CUSTOMER`) and `visibility` (`PUBLIC`, `INTERNAL`) if not already present; the public timeline filters on `visibility`.
- `OrderNotification`: new types with a `dedupeKey` built from order, shipment and status, so a repeated provider event sends nothing twice.

Existing RLS and "server-only" grants from the order-management migration apply to every new table.

### APIs

| Route | Purpose |
| --- | --- |
| `POST /api/stores/:storeId/orders/:orderId/shipments` | Create shipment (exists; extend fields) |
| `PATCH /api/stores/:storeId/shipments/:shipmentId` | Update status, carrier, tracking, ETA, with revision |
| `POST /api/stores/:storeId/shipments/:shipmentId/events` | Manual exception or event |
| `GET/PUT /api/stores/:storeId/tracking-provider` | Connect or disable a provider (permission `settings:manage`) |
| `POST /api/webhooks/tracking/:provider/:storeId` | Provider webhook; verifies signature; idempotent |
| `GET /api/public/stores/:storeId/orders/:publicToken` | Existing; add `shipments` and `timeline` with the public projection |
| `POST /internal/commerce/tracking/sync` | Scheduled polling (scheduler secret) |

### Business rules

- Only shipments for paid orders can be created; digital-only orders skip shipments.
- Stock is not touched by shipment status changes; it is already reserved at checkout.
- Cancelling or refunding an order after shipping needs the return flow; the system warns rather than cancelling a shipped order silently.
- Every write takes the order and shipment revision lock, as the current order routes do.

### Public projection

Keep the explicit allowlist. Add only: shipment status, carrier name, tracking number, tracking URL, estimated and delivered dates, and public timeline entries. Never add merchant notes, internal event details, provider credentials, raw courier payloads or Stripe IDs.

## 8. Notification system

### Events

| Event | Channel | Status |
| --- | --- | --- |
| Placed, payment confirmed, processing | Email | Exists |
| Packed | Email | New |
| Shipped (with tracking) | Email | Exists; add carrier link from template |
| Out for delivery | Email | New; only from a provider or merchant event |
| Delivered | Email | Exists |
| Delayed, delivery failed | Email | New; one message per exception, with next step |
| Return received, refund processed | Email | Refund exists; return received is new |

### Rules

- Triggered by recorded events only; the outbox dedupe key uses shipment ID and status, so a duplicate webhook sends nothing new.
- Each message names the store, the order number and the current state, and links to the public order page.
- Order updates are transactional messages. Marketing needs a separate opt-in and is out of scope.
- SMS and WhatsApp: add later as separate channels. They need per-channel opt-in and sender registration, which differ by country (UK, US, India). This needs a legal and provider check before building; it is not part of the first release.
- Preferences: a customer can turn off non-essential updates, but not delivery-critical ones (delivered, delivery failed). Exact rules need a product decision.

## 9. Edge cases

| Case | Handling |
| --- | --- |
| Duplicate webhook | Unique key on `(provider, providerEventId)`; no second event or email |
| Out-of-order events | Status by rank; late events are stored and shown in history, but do not move the headline backwards |
| Missing events | Show "last updated" and the courier link; never an assumed status |
| Provider outage | Retry through the operation queue; shopper sees last known state and the courier link |
| Wrong tracking number | Merchant edits the shipment (revision-checked); the old number stays in history |
| Partial shipments | One shipment per dispatch; order fulfilment rolls up; each shipment has its own tracking |
| Multiple packages in one order | Supported by the shipment model; the shopper sees a card per shipment |
| Delayed delivery | `delayed` flag and "Delayed" banner; cleared on delivery |
| Failed delivery | `DELIVERY_FAILED`; courier retry or return to sender follows; email sent once |
| Returned to sender | Shipment `RETURNED_TO_SENDER`; the merchant starts a return or cancellation |
| Cancelled after shipping | Blocked by default; a return is required |
| Return and refund | Existing return and refund flows; statuses feed the timeline |
| Manual update contradicting provider | Allowed with a reason; the provider's later event is recorded and flagged for review |
| Shopper opens an old link after refund | Public page shows refund state; no tracking changes |

## 10. Implementation roadmap

Each phase ends with a commit, a report and a decision before the next.

1. **Public shipments and timeline (no provider).** Shopper page shows carrier, tracking number, link and the public timeline from existing data. Smallest change, biggest gap closed. Migration: public timeline visibility. Tests: public projection allowlist, shopper page rendering.
2. **Shipment model and manual progress.** Full shipment status set, packed and exception actions in admin, delayed and failed flags, estimated delivery date, rollup to order fulfilment. Notifications for packed, delayed, delivery failed. Tests: transition table, rollup, notification dedupe.
3. **Tracking provider foundation.** Provider interface, `ShipmentTrackingEvent`, webhook endpoint with signature check and idempotency, polling job, "tracking unavailable" handling. Provider stub for tests. Tests: duplicate, out-of-order and missing-event cases.
4. **First aggregator integration.** Vendor chosen after the checks in section 4. Connection settings in admin, live status on shipments, "Out for delivery" from events. Staging test with real tracking numbers.
5. **Customer account and polish.** Order history and detail use the same component; mobile and accessibility passes for the tracker in both themes; launch checklist update.
6. **Later, separately decided.** SMS or WhatsApp notifications, preference centre, label purchasing, direct courier APIs.

Phases 1 and 2 need no third party and no new vendor decision, so they can start as soon as this design is agreed.

## Decisions needed from you

1. Phase 1 scope: shopper sees shipments and timeline from existing data. Approve, or change?
2. Notification channels for the first release: email only (current), or email plus SMS?
3. Tracking provider: approve starting with the provider-agnostic model and choosing an aggregator in phase 4, or name a courier that must be supported first?
4. Estimated delivery: merchant-entered date per order or per shipment, or no estimate for now?
5. Do you want shopper cancellation requests (a request the merchant approves) in the first release?
