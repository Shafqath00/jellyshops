-- Discounts, second version: the four Shopify-style types, automatic discounts, what a discount applies to,
-- who can use it, how it combines with others, many codes per discount and a record of each discount on an order.
-- Additive: existing codes keep working. Old kinds are rewritten to the new ones:
--   percent       -> order_amount, valueType percent
--   fixed         -> order_amount, valueType fixed
--   free_shipping -> free_shipping
-- Every code a shopper can type (including the discount's main code) lives in "DiscountRedeemCode", so a code is
-- unique across the whole store. "DiscountCode".code keeps the main code for display (NULL for automatic ones).
-- Uses are counted from "OrderDiscount" rows whose order is not cancelled.

ALTER TABLE "DiscountCode" DROP CONSTRAINT IF EXISTS "DiscountCode_kind_check";
ALTER TABLE "DiscountCode" DROP CONSTRAINT IF EXISTS "DiscountCode_value_check";
ALTER TABLE "DiscountCode" ALTER COLUMN "code" DROP NOT NULL;

ALTER TABLE "DiscountCode" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DiscountCode" ADD COLUMN IF NOT EXISTS "method" TEXT NOT NULL DEFAULT 'code';
ALTER TABLE "DiscountCode" ADD COLUMN IF NOT EXISTS "valueType" TEXT;
ALTER TABLE "DiscountCode" ADD COLUMN IF NOT EXISTS "appliesTo" JSONB NOT NULL DEFAULT '{"scope":"all","productIds":[],"collectionIds":[]}';
ALTER TABLE "DiscountCode" ADD COLUMN IF NOT EXISTS "appliesOncePerOrder" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "DiscountCode" ADD COLUMN IF NOT EXISTS "minimumQuantity" INTEGER;
ALTER TABLE "DiscountCode" ADD COLUMN IF NOT EXISTS "eligibility" JSONB NOT NULL DEFAULT '{"scope":"everyone"}';
ALTER TABLE "DiscountCode" ADD COLUMN IF NOT EXISTS "combinesWith" JSONB NOT NULL DEFAULT '{"product":false,"order":false,"shipping":false}';
ALTER TABLE "DiscountCode" ADD COLUMN IF NOT EXISTS "maxShippingMinor" INTEGER;
ALTER TABLE "DiscountCode" ADD COLUMN IF NOT EXISTS "buyXGetY" JSONB;
ALTER TABLE "DiscountCode" ADD COLUMN IF NOT EXISTS "endReminderSentAt" TIMESTAMPTZ;

UPDATE "DiscountCode" SET "valueType" = kind, kind = 'order_amount' WHERE kind IN ('percent', 'fixed');
UPDATE "DiscountCode" SET title = code WHERE title = '' AND code IS NOT NULL;

ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_kind_check" CHECK ("kind" IN ('product_amount', 'order_amount', 'buy_x_get_y', 'free_shipping'));
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_method_check" CHECK ("method" IN ('code', 'automatic'));
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_code_method_check" CHECK (("method" = 'code') = ("code" IS NOT NULL));
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_title_check" CHECK (char_length("title") BETWEEN 1 AND 120);
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_value_check" CHECK (
  ("kind" IN ('product_amount', 'order_amount') AND (("valueType" = 'percent' AND "value" BETWEEN 1 AND 100) OR ("valueType" = 'fixed' AND "value" BETWEEN 1 AND 100000000)))
  OR ("kind" IN ('free_shipping', 'buy_x_get_y') AND "valueType" IS NULL AND "value" = 0)
);
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_minimumQuantity_check" CHECK ("minimumQuantity" IS NULL OR "minimumQuantity" BETWEEN 1 AND 100000);
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_minimum_one_check" CHECK ("minimumQuantity" IS NULL OR "minimumSubtotalMinor" IS NULL);
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_maxShipping_check" CHECK ("maxShippingMinor" IS NULL OR "maxShippingMinor" BETWEEN 1 AND 100000000);
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_bxgy_check" CHECK (("kind" = 'buy_x_get_y') = ("buyXGetY" IS NOT NULL));
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_json_size_check" CHECK (
  pg_column_size("appliesTo") < 65536 AND pg_column_size("eligibility") < 65536 AND pg_column_size(COALESCE("buyXGetY", '{}'::jsonb)) < 65536
);

CREATE INDEX IF NOT EXISTS "DiscountCode_store_automatic_idx" ON "DiscountCode" ("storeId") WHERE "method" = 'automatic' AND "active";

-- Every code a shopper can type. One discount may have thousands (generated in bulk).
CREATE TABLE IF NOT EXISTS "DiscountRedeemCode" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "discountId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "DiscountRedeemCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DiscountRedeemCode_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DiscountRedeemCode_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "DiscountCode"("id") ON DELETE CASCADE,
  CONSTRAINT "DiscountRedeemCode_code_check" CHECK ("code" ~ '^[A-Z0-9_-]{2,40}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS "DiscountRedeemCode_store_code_key" ON "DiscountRedeemCode" ("storeId", "code");
CREATE INDEX IF NOT EXISTS "DiscountRedeemCode_discount_idx" ON "DiscountRedeemCode" ("discountId");

INSERT INTO "DiscountRedeemCode" (id, "storeId", "discountId", code, "createdAt")
SELECT 'redeem-' || d.id, d."storeId", d.id, d.code, d."createdAt" FROM "DiscountCode" d WHERE d.code IS NOT NULL
ON CONFLICT DO NOTHING;

-- Which discounts an order used and what each took off. "discountId" survives as NULL if the discount is deleted;
-- the title and code are kept so reports and receipts still read well.
CREATE TABLE IF NOT EXISTS "OrderDiscount" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "discountId" TEXT,
  "code" TEXT,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL DEFAULT 0,
  "shippingMinor" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "OrderDiscount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderDiscount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderDiscount_order_fkey" FOREIGN KEY ("storeId", "orderId") REFERENCES "Order"("storeId", "id") ON DELETE CASCADE,
  CONSTRAINT "OrderDiscount_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "DiscountCode"("id") ON DELETE SET NULL,
  CONSTRAINT "OrderDiscount_amounts_check" CHECK ("amountMinor" >= 0 AND "shippingMinor" >= 0)
);
CREATE INDEX IF NOT EXISTS "OrderDiscount_order_idx" ON "OrderDiscount" ("storeId", "orderId");
CREATE INDEX IF NOT EXISTS "OrderDiscount_discount_idx" ON "OrderDiscount" ("discountId") WHERE "discountId" IS NOT NULL;

-- Orders placed with a code before this migration.
INSERT INTO "OrderDiscount" (id, "storeId", "orderId", "discountId", code, title, kind, "amountMinor", "shippingMinor", "createdAt")
SELECT 'od-' || o.id, o."storeId", o.id, d.id, o."discountCode", COALESCE(d.title, o."discountCode"), COALESCE(d.kind, 'order_amount'),
       COALESCE(o."discountMinor", 0), 0, o."createdAt"
FROM "Order" o LEFT JOIN "DiscountCode" d ON d."storeId" = o."storeId" AND d.code = o."discountCode"
WHERE o."discountCode" IS NOT NULL
ON CONFLICT DO NOTHING;

DO $isolate$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['DiscountRedeemCode', 'OrderDiscount'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON public.%I FROM anon', t); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO jelly_backend', t);
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'backend_access') THEN
        EXECUTE format('CREATE POLICY backend_access ON public.%I TO jelly_backend USING (true) WITH CHECK (true)', t);
      END IF;
    END IF;
  END LOOP;
END
$isolate$;
