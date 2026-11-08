# Database architecture

Postgres (Supabase), accessed with raw `pg` from the backend. Column-level detail, constraints, indexes and which source file touches each table are in the generated [database-schema.md](database-schema.md). This page explains the design.

## Access model

- The backend connects with `SUPABASE_RUNTIME_DATABASE_URL` (falls back to `SUPABASE_DATABASE_URL` outside production; production requires the separate runtime URL so migration credentials stay out of the running service).
- The runtime role is `jelly_backend`, created by `20261020143750_backend_runtime_role`. Server-owned tables have RLS enabled, `REVOKE ALL` from `PUBLIC`, `anon` and `authenticated`, and a `backend_access` policy for `jelly_backend`. Tables created by the order-management and notification migrations follow the same pattern.
- The browser never talks to these tables directly; the frontend uses Supabase only for authentication.

## Multi-store isolation rules

1. `Store` is the tenant root. Nearly every table carries `"storeId"`.
2. Child rows reference parents with composite keys `("storeId", id)` (for example `OrderItem`/`OrderEvent` → `Order("storeId", id)`), so a row cannot point at another store's parent.
3. Repositories always filter by the `storeId` taken from `StoreRequestContext` (merchant routes) or from the URL for public routes after the store is resolved.
4. Public IDs exposed to shoppers (`Order.publicToken`, digital download tokens) are unguessable and store-scoped.

## Domain groups

| Group | Tables | Owning code |
| --- | --- | --- |
| Tenancy | `Store`, `StoreMembership`, `User`, `StoreSettings`, `StoreDomain` | `backend/src/tenants/` |
| Catalog | `Product`, `ProductVariant`, `InventoryLevel`, `Collection`, `CollectionProduct`, `Media`, `ProductMedia` | `backend/src/catalog/`, `backend/src/media/` |
| Theme / storefront | `StorefrontWorkspace`, `StorefrontDraft`, `StorefrontTemplate`, `StorefrontTemplateAssignment`, `GlobalSection`, `SectionPreset`, `ThemeConfiguration`, `NavigationMenu`, `StorefrontPublication` (active one referenced from `Store`) | `backend/src/storefront/` |
| Content and custom data | `StorePage`, `Blog`, `Article`, `MetafieldDefinition`, `MetafieldValue`, `MetaobjectDefinition`, `MetaobjectEntry` | `backend/src/content/`, `backend/src/custom-data/` |
| Checkout and orders | `CheckoutAttempt`, `InventoryReservation`, `Order`, `OrderItem`, `StoreOrderCounter`, `Payment`, `Refund`, `PaymentDispute`, `PublicOrderAccessRateLimit` | `backend/src/commerce/` |
| Order management | `OrderRevision`, `OrderEvent`, `OrderNote`, `OrderTransaction`, `OrderOperation`, `OrderFulfilment`, `OrderReturn`, `OrderEditHold`, `StoreOrderManagementSettings` | `commerce/order-management.ts` |
| Notifications and digital | `OrderNotification`, `StoreNotificationBranding`, `DigitalAsset`, `DigitalEntitlement`, `DigitalDownloadAttempt` | `commerce/notifications.ts`, `commerce/digital.ts` |
| Stripe | `StripeConnectedAccount`, `StripeWebhookEvent`, `WebhookProcessingAttempt` | `backend/src/stripe/` |
| Customers | `StoreCustomer`, `CustomerAddress`, `CustomerWishlist`, `NewsletterSubscriber`, `ContactEnquiry` | `backend/src/customers/` |
| Audit | `AuditEvent` | `backend/src/audit/` |

All 60 tables are listed in [database-schema.md](database-schema.md); whether each is currently read or written by backend code is shown there under “Referenced by”.

## Database triggers

The 20261022 migrations add PL/pgSQL triggers: original-revision capture on `Order` insert, immutability of revision snapshots, notification queueing on order/payment/refund changes, digital entitlement grants on payment or applied revision, and entitlement revocation on cancel/refund. They only queue notifications for stores with `StoreOrderManagementSettings.enabled = true`.

## Migrations

- SQL files: `backend/sql/migrations` (source of truth for new migrations) and `backend/supabase/migrations` (copies used with the Supabase CLI for the earlier ones). The 20261022 migrations exist only in `sql/migrations`.
- Applied versions are recorded in `supabase_migrations.schema_migrations`; the list in the generated schema doc shows what the documented database has.
- There is no migration runner script in the repo: migrations are applied by hand (SQL editor, `psql`, or the MCP/CLI) in filename order. `backend/run-migration.js` and `backend/test-db.js` are ad-hoc helpers.
- Production isolation (RLS) has been applied to staging only; production is not yet contained (see `CLAUDE.md`).

## Diagram

A foreign-key diagram for the live schema is at the top of [database-schema.md](database-schema.md).
