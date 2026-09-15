-- Durable commerce. Composite foreign keys preserve the store boundary even
-- when callers supply an otherwise valid identifier from a different store.
CREATE TABLE "StripeConnectedAccount" (
  "storeId" TEXT PRIMARY KEY REFERENCES "Store"("id") ON DELETE RESTRICT,
  "stripeAccountId" TEXT NOT NULL UNIQUE,
  -- Accounts v2: configuration.merchant.capabilities.card_payments.status
  "cardPaymentsStatus" TEXT NOT NULL DEFAULT 'unrequested',
  -- Accounts v2: configuration.merchant.capabilities.stripe_balance.payouts.status
  "payoutsStatus" TEXT NOT NULL DEFAULT 'unrequested',
  "requirements" JSONB NOT NULL DEFAULT '{}',
  "closedAt" TIMESTAMPTZ,
  UNIQUE ("storeId", "stripeAccountId")
);

CREATE TABLE "Order" (
  "id" TEXT PRIMARY KEY,
  "storeId" TEXT NOT NULL REFERENCES "Store"("id") ON DELETE RESTRICT,
  "number" TEXT NOT NULL,
  "publicToken" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT'
    CHECK ("status" IN ('PENDING_PAYMENT', 'PAID', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED')),
  "fulfilmentStartedAt" TIMESTAMPTZ,
  "customerSnapshot" JSONB NOT NULL,
  "subtotalMinor" INTEGER NOT NULL CHECK ("subtotalMinor" >= 0),
  "shippingMinor" INTEGER NOT NULL CHECK ("shippingMinor" >= 0),
  "totalMinor" INTEGER NOT NULL CHECK ("totalMinor" >= 0),
  "currency" TEXT NOT NULL CHECK ("currency" ~ '^[A-Z]{3}$'),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("totalMinor"::BIGINT = "subtotalMinor"::BIGINT + "shippingMinor"::BIGINT),
  UNIQUE ("storeId", "id"),
  UNIQUE ("storeId", "number")
);
CREATE INDEX "Order_storeId_createdAt_idx" ON "Order" ("storeId", "createdAt");
CREATE INDEX "Order_storeId_status_idx" ON "Order" ("storeId", "status");

CREATE TABLE "OrderItem" (
  "orderId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "titleSnapshot" TEXT NOT NULL,
  "skuSnapshot" TEXT,
  "imageSnapshot" TEXT,
  "unitPriceMinor" INTEGER NOT NULL CHECK ("unitPriceMinor" >= 0),
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  PRIMARY KEY ("orderId", "variantId"),
  FOREIGN KEY ("storeId", "orderId") REFERENCES "Order" ("storeId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("storeId", "variantId") REFERENCES "ProductVariant" ("storeId", "id") ON DELETE RESTRICT
);
CREATE INDEX "OrderItem_storeId_orderId_idx" ON "OrderItem" ("storeId", "orderId");

CREATE TABLE "Payment" (
  "id" TEXT PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL UNIQUE,
  "stripeAccountId" TEXT NOT NULL,
  "paymentIntentId" TEXT UNIQUE,
  "chargeId" TEXT UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'PENDING'
    CHECK ("status" IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED')),
  "amountMinor" INTEGER NOT NULL CHECK ("amountMinor" >= 0),
  "currency" TEXT NOT NULL CHECK ("currency" ~ '^[A-Z]{3}$'),
  UNIQUE ("storeId", "id"),
  UNIQUE ("storeId", "orderId", "id"),
  FOREIGN KEY ("storeId", "orderId") REFERENCES "Order" ("storeId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("storeId", "stripeAccountId") REFERENCES "StripeConnectedAccount" ("storeId", "stripeAccountId") ON DELETE RESTRICT
);

CREATE TABLE "CheckoutAttempt" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL UNIQUE,
  "storeId" TEXT NOT NULL,
  "cartKey" TEXT NOT NULL,
  "cartHash" TEXT NOT NULL,
  "stripeIdempotencyKey" TEXT NOT NULL UNIQUE,
  "paymentIntentId" TEXT UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'PAYMENT_INTENT_CREATING'
    CHECK ("status" IN ('PAYMENT_INTENT_CREATING', 'READY', 'PROCESSING', 'SUCCEEDED', 'CANCELLED', 'EXPIRED', 'FAILED')),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("storeId", "id"),
  FOREIGN KEY ("storeId", "orderId") REFERENCES "Order" ("storeId", "id") ON DELETE RESTRICT
);
CREATE INDEX "CheckoutAttempt_storeId_cartKey_idx" ON "CheckoutAttempt" ("storeId", "cartKey");
CREATE INDEX "CheckoutAttempt_status_expiresAt_idx" ON "CheckoutAttempt" ("status", "expiresAt");

CREATE TABLE "InventoryReservation" (
  "attemptId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  "status" TEXT NOT NULL DEFAULT 'HELD' CHECK ("status" IN ('HELD', 'RELEASED', 'SOLD')),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  PRIMARY KEY ("attemptId", "variantId"),
  FOREIGN KEY ("storeId", "attemptId") REFERENCES "CheckoutAttempt" ("storeId", "id") ON DELETE RESTRICT,
  FOREIGN KEY ("storeId", "variantId") REFERENCES "InventoryLevel" ("storeId", "variantId") ON DELETE RESTRICT
);
CREATE INDEX "InventoryReservation_storeId_variantId_idx" ON "InventoryReservation" ("storeId", "variantId");
CREATE INDEX "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation" ("status", "expiresAt");

CREATE TABLE "Refund" (
  "id" TEXT PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "stripeRefundId" TEXT UNIQUE,
  "amountMinor" INTEGER NOT NULL CHECK ("amountMinor" > 0),
  "status" TEXT NOT NULL DEFAULT 'PENDING'
    CHECK ("status" IN ('PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  "inventoryRestoredAt" TIMESTAMPTZ,
  FOREIGN KEY ("storeId", "orderId", "paymentId") REFERENCES "Payment" ("storeId", "orderId", "id") ON DELETE RESTRICT,
  CHECK ("inventoryRestoredAt" IS NULL OR "status" = 'SUCCEEDED')
);
CREATE INDEX "Refund_storeId_orderId_idx" ON "Refund" ("storeId", "orderId");

CREATE TABLE "PaymentDispute" (
  "storeId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "stripeDisputeId" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL CHECK ("status" IN ('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'won', 'lost', 'prevented')),
  FOREIGN KEY ("storeId", "paymentId") REFERENCES "Payment" ("storeId", "id") ON DELETE RESTRICT
);
CREATE INDEX "PaymentDispute_storeId_paymentId_idx" ON "PaymentDispute" ("storeId", "paymentId");

CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT PRIMARY KEY,
  "endpointFamily" TEXT NOT NULL CHECK ("endpointFamily" IN ('accounts-v2', 'connect-payments')),
  "stripeEventId" TEXT NOT NULL UNIQUE,
  "stripeAccountId" TEXT,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMPTZ
);
CREATE INDEX "StripeWebhookEvent_pending_idx" ON "StripeWebhookEvent" ("receivedAt") WHERE "processedAt" IS NULL;
CREATE INDEX "StripeWebhookEvent_stripeAccountId_idx" ON "StripeWebhookEvent" ("stripeAccountId");

CREATE TABLE "WebhookProcessingAttempt" (
  "eventId" TEXT NOT NULL REFERENCES "StripeWebhookEvent" ("id") ON DELETE RESTRICT,
  "attemptNo" INTEGER NOT NULL CHECK ("attemptNo" > 0),
  "errorMessage" TEXT,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ,
  PRIMARY KEY ("eventId", "attemptNo"),
  CHECK ("finishedAt" IS NULL OR "finishedAt" >= "startedAt")
);

CREATE TABLE "PublicOrderAccessRateLimit" (
  "storeId" TEXT NOT NULL REFERENCES "Store" ("id") ON DELETE RESTRICT,
  "ipHash" TEXT NOT NULL,
  "windowStartedAt" TIMESTAMPTZ NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0 CHECK ("requestCount" >= 0),
  PRIMARY KEY ("storeId", "ipHash", "windowStartedAt")
);
CREATE INDEX "PublicOrderAccessRateLimit_windowStartedAt_idx" ON "PublicOrderAccessRateLimit" ("windowStartedAt");
