# Order management

Code: `backend/src/commerce/{order-management,merchant-orders,merchant-order-routes,fulfilment,refunds,order-management-invoice,order-runtime}.ts`, `jellyshops/src/app/admin/orders/**`, `jellyshops/src/features/commerce/`, `jellyshops/src/app/[storeSlug]/order/[publicToken]/**`. Migration: `backend/sql/migrations/20261022000000_order_management.sql`. Build log: [../order-management-progress.md](../order-management-progress.md).

## Gating

The new workspace is off for every store until enabled: `StoreOrderManagementSettings.enabled` (`GET/PATCH /api/stores/:storeId/orders/settings`, permission `settings:manage`). Mutating routes return `409 ORDER_MANAGEMENT_DISABLED` while it is off, except the legacy fulfilment and full-refund calls, which keep working so existing stores are unaffected.

## Data model

`Order` gained `revision`, `taxMinor`, `discountMinor`, `deliverySnapshot`, `billingAddress`, `customerNote`, `isTest`, `balanceDueMinor`, `lifecycle` (OPEN / CLOSED / CANCELLED) and `fulfilmentStatus`. New tables: `OrderRevision` (immutable purchase snapshots; first row `original-<orderId>`), `OrderEvent` (append-only timeline), `OrderNote`, `OrderTransaction` (payments and refunds), `OrderOperation` (queued work with leases), `OrderFulfilment` (shipments), `OrderReturn`, `OrderEditHold` (inventory held for a pending edit). Details: [database-schema](../architecture/database-schema.md).

## Merchant API (`/api/stores/:storeId/orders`)

| Action | Route | Permission |
| --- | --- | --- |
| List / search | `GET /` | `orders:view` |
| Detail | `GET /:orderId` | `orders:view` |
| Notes, contact info, tracking | `POST /:orderId/notes`, `PATCH /:orderId/contact`, `PATCH /:orderId/tracking` | `orders:manage` |
| Cancel | `POST /:orderId/cancel` | `orders:manage` |
| Edit (preview, then apply) | `POST /:orderId/edits/preview`, `POST /:orderId/edits` | `orders:refund` (edits can move money) |
| Fulfil / mark delivered | `POST /:orderId/fulfilments`, `.../fulfilments/:fulfilmentId/deliver` (legacy `POST /:orderId/fulfilment`) | `orders:manage` |
| Returns | `POST /:orderId/returns`, `.../returns/:returnId/receive` | `orders:manage` |
| Refund | `POST /:orderId/refunds` (empty body = legacy full refund) | `orders:refund` |
| Invoice | `GET /:orderId/invoice` (HTML/PDF via `order-management-invoice.ts`) | `orders:view` |
| Resend email | `POST /:orderId/notifications/resend` | `orders:manage` |

Exact permissions per route are in [endpoints](../api/endpoints.md). Mutations carry a `revision` and an idempotency key; a stale revision is rejected, and a repeated key returns the earlier result.

## Rules that matter

- **Edits settle on verified results.** An edit creates a `PENDING` revision with inventory holds; only one pending revision per order (unique index). Money moves (balance payment or refund) and the revision is `APPLIED` only after Stripe confirms through the webhook settlement hooks ([payment-system](payment-system.md)).
- **Totals invariant.** `totalMinor = subtotalMinor + shippingMinor + taxMinor − discountMinor` (`Order_total_breakdown_check`).
- **Immutable history.** `OrderRevision` snapshots cannot be updated (trigger), `OrderEvent` is not updatable or deletable by the backend role, orders and payments are not deletable.
- **Customer balance page.** When an edit raises the total, the shopper pays the difference at `/[storeSlug]/order/[publicToken]/balance` (`GET /api/public/stores/:storeId/orders/:publicToken/balance`).
- **Digital-only carts** skip shipping; fulfilment is automatic once access is granted.

## Frontend

`app/admin/orders/page.tsx` (list with filters, polling), `app/admin/orders/[id]/page.tsx` (detail, timeline and workflow dialogs), shared pieces in `features/commerce/components/order-ui.tsx`, API client in `features/commerce/api/client.ts` and `types.ts`. The shopper's order page is `app/[storeSlug]/order/[publicToken]/page.tsx`.

## Background work

`createOrderRuntime` (`commerce/order-runtime.ts`) runs `runWorkers`: queued `OrderOperation`s and the notification outbox. It is triggered by `POST /internal/commerce/orders/work` with `x-scheduler-secret` (also reports pending webhooks, pending settlements and failed notifications).
