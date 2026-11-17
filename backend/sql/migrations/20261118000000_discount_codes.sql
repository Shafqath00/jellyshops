-- Discount codes a merchant creates and shoppers type at checkout.
-- kind: 'percent' (value 1-100, off the products), 'fixed' (value in minor units, off the products,
-- never more than the products cost) or 'free_shipping' (value 0, delivery becomes free).
-- A code is used once an order holds it and that order is not cancelled; nothing is counted
-- separately, so cancelled or expired checkouts give their use back.
-- Server-only: the browser Data API roles get no access to this table.
CREATE TABLE IF NOT EXISTS "DiscountCode" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  "minimumSubtotalMinor" INTEGER,
  "usageLimit" INTEGER,
  "oncePerCustomer" BOOLEAN NOT NULL DEFAULT FALSE,
  "startsAt" TIMESTAMPTZ,
  "endsAt" TIMESTAMPTZ,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DiscountCode_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DiscountCode_code_check" CHECK ("code" ~ '^[A-Z0-9_-]{2,40}$'),
  CONSTRAINT "DiscountCode_kind_check" CHECK ("kind" IN ('percent', 'fixed', 'free_shipping')),
  CONSTRAINT "DiscountCode_value_check" CHECK (
    ("kind" = 'percent' AND "value" BETWEEN 1 AND 100)
    OR ("kind" = 'fixed' AND "value" BETWEEN 1 AND 100000000)
    OR ("kind" = 'free_shipping' AND "value" = 0)
  ),
  CONSTRAINT "DiscountCode_minimum_check" CHECK ("minimumSubtotalMinor" IS NULL OR "minimumSubtotalMinor" BETWEEN 1 AND 100000000),
  CONSTRAINT "DiscountCode_usageLimit_check" CHECK ("usageLimit" IS NULL OR "usageLimit" BETWEEN 1 AND 1000000),
  CONSTRAINT "DiscountCode_dates_check" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DiscountCode_store_code_key" ON "DiscountCode" ("storeId", "code");

-- The code an order was placed with (uppercase), next to the existing "discountMinor".
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountCode" TEXT;
CREATE INDEX IF NOT EXISTS "Order_store_discountCode_idx" ON "Order" ("storeId", "discountCode") WHERE "discountCode" IS NOT NULL;

ALTER TABLE public."DiscountCode" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."DiscountCode" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."DiscountCode" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."DiscountCode" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."DiscountCode" TO jelly_backend;
    CREATE POLICY backend_access ON public."DiscountCode" TO jelly_backend USING (true) WITH CHECK (true);
  END IF;
END
$isolate$;
