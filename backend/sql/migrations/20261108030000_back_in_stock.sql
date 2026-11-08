-- Back-in-stock requests: a shopper leaves an email on a sold-out product (one variant) and gets one email when it
-- can be bought again. The email is used for nothing else and never shown to other shoppers.
-- Server-only: the browser Data API roles get no access to this table.
CREATE TABLE IF NOT EXISTS "BackInStockRequest" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'waiting',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "notifiedAt" TIMESTAMPTZ,
  CONSTRAINT "BackInStockRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BackInStockRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BackInStockRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BackInStockRequest_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BackInStockRequest_status_check" CHECK ("status" IN ('waiting', 'notified', 'failed')),
  CONSTRAINT "BackInStockRequest_email_check" CHECK (char_length("email") BETWEEN 3 AND 254)
);

-- One waiting request per shopper and variant; asking again is harmless.
CREATE UNIQUE INDEX IF NOT EXISTS "BackInStockRequest_waiting_unique" ON "BackInStockRequest" ("storeId", "variantId", lower("email")) WHERE "status" = 'waiting';
CREATE INDEX IF NOT EXISTS "BackInStockRequest_waiting_idx" ON "BackInStockRequest" ("status", "variantId") WHERE "status" = 'waiting';
CREATE INDEX IF NOT EXISTS "BackInStockRequest_store_idx" ON "BackInStockRequest" ("storeId", "productId", "status");

ALTER TABLE public."BackInStockRequest" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."BackInStockRequest" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."BackInStockRequest" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."BackInStockRequest" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."BackInStockRequest" TO jelly_backend;
    CREATE POLICY backend_access ON public."BackInStockRequest" TO jelly_backend USING (true) WITH CHECK (true);
  END IF;
END
$isolate$;
