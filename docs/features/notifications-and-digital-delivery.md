# Email notifications and digital delivery

Short operator notes also live in [../../backend/docs/order-notifications-digital.md](../../backend/docs/order-notifications-digital.md). Migration: `backend/sql/migrations/20261022010000_notifications_digital.sql` (apply after the order-management migration). Both features are gated per store by `StoreOrderManagementSettings.enabled`; enabling a store does not send historical emails.

## Notifications

| Piece | Where |
| --- | --- |
| Queue (outbox) | table `OrderNotification` (`QUEUED` → `SENDING` → `ACCEPTED` / `FAILED` / `UNCERTAIN`), unique `dedupeKey` |
| Producers | PL/pgSQL triggers: order insert → `PLACED`; payment paid → `PAYMENT_CONFIRMED` (+ `DIGITAL_READY` when files are granted); order status → `PROCESSING` / `SHIPPED` / `DELIVERED` / `CANCELLED`; refund or refund event → `REFUND_PROCESSED`. Each uses `jelly_queue_notification`, which snapshots the order and its items and records a `NOTIFICATION_QUEUED` event |
| Service and worker | `createNotificationService` in `commerce/notifications.ts` (`runWorker`: one job at a time, row lock, five-minute lease, retry back-off via `notificationRetry`) |
| Templates | `renderOrderNotification(type, data)` |
| Transport | `smtpNotificationTransport` (`commerce/notification-transport.ts`, nodemailer) or `CaptureNotificationTransport` (development only). Chosen in `commerce/order-runtime.ts`: SMTP when `ORDER_SMTP_HOST` is set; capture when not in production; none in production without SMTP |
| Merchant API | `/api/stores/:storeId/order-notifications` (list, `branding`, `preview`) and `POST /api/stores/:storeId/orders/:orderId/notifications/resend` |
| Branding | table `StoreNotificationBranding` (brand name, reply-to, accent colour, logo). Branding changes presentation and reply-to only; the sender is the platform address `ORDER_EMAIL_FROM` |
| Frontend | `app/admin/settings/notifications` |

Delivery guarantees: a rejected recipient or pre-DATA failure is retried; a lost DATA reply or an expired lease becomes `UNCERTAIN` and must be checked in the provider's logs before manual resend. Production SMTP requires credentials and `ORDER_EMAIL_DOMAIN_VERIFIED=true`. The worker runs from `POST /internal/commerce/orders/work` (scheduler secret), intended every minute.

## Digital products

| Piece | Where |
| --- | --- |
| Product flag | `Product.fulfillmentType` and the `OrderItem.fulfillmentType` snapshot (`PHYSICAL` / `DIGITAL`) |
| Files | table `DigitalAsset` (private `storageKey`, `maxDownloads`, `expiresAfterDays`, `archivedAt`); max 50 MB per file; storage `localPrivateDigitalStorage(dir)` (development) or `supabasePrivateDigitalStorage(client, bucket)` (private bucket only) in `commerce/digital.ts` |
| Merchant API | `/api/stores/:storeId/digital-products/:productId` (get, put settings) and `.../assets` (upload `multipart` field `file`, delete) with `catalog:view` / `catalog:edit` |
| Grants | triggers create `DigitalEntitlement` rows when payment is paid (or an order revision is applied); a digital-only order becomes fulfilled |
| Download | `GET /api/public/stores/:storeId/digital/:entitlementId` with a token; the backend rechecks entitlement state and streams bytes (never a public or signed URL). Attempts are logged in `DigitalDownloadAttempt` |
| Tokens | HMAC per entitlement with `DIGITAL_TOKEN_SECRET` (at least 32 chars, stable across instances); only SHA-256 hashes are stored; tokens are never in merchant list responses |
| Revocation | order cancelled or refunded, full refund, or a refund event naming the variants |
| Frontend | `components/digital-product-settings.tsx`, rendered on `app/admin/products/[id]` |

Checkout must only accept a digital product that has an active file; this is enforced at checkout time rather than in the database.
