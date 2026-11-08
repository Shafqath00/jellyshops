-- Add child-side indexes for store-scoped lookups and FK maintenance. These
-- match the predicates used by checkout, order history, refund, and account flows.
CREATE INDEX IF NOT EXISTS "CheckoutAttempt_storeId_orderId_idx"
  ON "CheckoutAttempt" ("storeId", "orderId");
CREATE INDEX IF NOT EXISTS "InventoryReservation_storeId_attemptId_idx"
  ON "InventoryReservation" ("storeId", "attemptId");
CREATE INDEX IF NOT EXISTS "OrderItem_storeId_variantId_idx"
  ON "OrderItem" ("storeId", "variantId");
CREATE INDEX IF NOT EXISTS "Payment_storeId_stripeAccountId_idx"
  ON "Payment" ("storeId", "stripeAccountId");
CREATE INDEX IF NOT EXISTS "Refund_storeId_orderId_paymentId_idx"
  ON "Refund" ("storeId", "orderId", "paymentId");
CREATE INDEX IF NOT EXISTS "Store_id_currentPublicationId_idx"
  ON "Store" ("id", "currentPublicationId");

-- Reconnect history remains keyed by the Stripe account/store unique rules.
-- This independent identity supports durable joins and future references.
ALTER TABLE "StripeConnectedAccount"
  ADD COLUMN IF NOT EXISTS "id" UUID;
UPDATE "StripeConnectedAccount" SET "id" = gen_random_uuid() WHERE "id" IS NULL;
ALTER TABLE "StripeConnectedAccount"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "StripeConnectedAccount"
  ADD CONSTRAINT "StripeConnectedAccount_pkey" PRIMARY KEY ("id");
