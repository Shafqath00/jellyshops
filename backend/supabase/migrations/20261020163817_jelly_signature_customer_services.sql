-- Additive contracts: existing publications, orders, and customer snapshots remain intact.
ALTER TYPE "StorefrontTemplateType" ADD VALUE IF NOT EXISTS 'CHECKOUT';
ALTER TYPE "StorefrontTemplateType" ADD VALUE IF NOT EXISTS 'WISHLIST';
ALTER TYPE "StorefrontTemplateType" ADD VALUE IF NOT EXISTS 'CUSTOMER_LOGIN';
ALTER TYPE "StorefrontTemplateType" ADD VALUE IF NOT EXISTS 'CUSTOMER_REGISTER';
ALTER TYPE "StorefrontTemplateType" ADD VALUE IF NOT EXISTS 'CUSTOMER_RECOVERY';
ALTER TYPE "StorefrontTemplateType" ADD VALUE IF NOT EXISTS 'CUSTOMER_ACCOUNT';
ALTER TYPE "StorefrontTemplateType" ADD VALUE IF NOT EXISTS 'CUSTOMER_ORDERS';
ALTER TYPE "StorefrontTemplateType" ADD VALUE IF NOT EXISTS 'CUSTOMER_ORDER';
ALTER TYPE "StorefrontTemplateType" ADD VALUE IF NOT EXISTS 'CUSTOMER_ADDRESSES';
ALTER TYPE "StorefrontTemplateType" ADD VALUE IF NOT EXISTS 'ORDER_SUCCESS';

CREATE TABLE "StoreCustomer" (
  "id" TEXT PRIMARY KEY,
  "storeId" TEXT NOT NULL REFERENCES "Store"("id"),
  "authUserId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("storeId", "authUserId"), UNIQUE ("storeId", "id")
);
CREATE TABLE "CustomerAddress" (
  "id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "customerId" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT '', "name" TEXT NOT NULL,
  "line1" TEXT NOT NULL, "line2" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL, "region" TEXT NOT NULL DEFAULT '', "postalCode" TEXT NOT NULL,
  "country" VARCHAR(2) NOT NULL, "phone" TEXT NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("storeId", "customerId") REFERENCES "StoreCustomer"("storeId", "id")
);
CREATE INDEX "CustomerAddress_owner_idx" ON "CustomerAddress"("storeId", "customerId");
CREATE TABLE "CustomerWishlist" (
  "storeId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("storeId", "customerId", "productId"),
  FOREIGN KEY ("storeId", "customerId") REFERENCES "StoreCustomer"("storeId", "id"),
  FOREIGN KEY ("storeId", "productId") REFERENCES "Product"("storeId", "id")
);
CREATE INDEX "CustomerWishlist_product_idx" ON "CustomerWishlist"("storeId", "productId");
ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customer_fkey" FOREIGN KEY ("storeId", "customerId") REFERENCES "StoreCustomer"("storeId", "id");
CREATE INDEX "Order_customer_idx" ON "Order"("storeId", "customerId", "createdAt" DESC, "id");

CREATE TABLE "NewsletterSubscriber" (
  "id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL REFERENCES "Store"("id"),
  "email" TEXT NOT NULL, "consentAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "source" TEXT NOT NULL, "unsubscribedAt" TIMESTAMPTZ,
  UNIQUE ("storeId", "email"), UNIQUE ("storeId", "id")
);
CREATE TABLE "ContactEnquiry" (
  "id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL REFERENCES "Store"("id"),
  "name" TEXT NOT NULL, "email" TEXT NOT NULL, "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW' CHECK ("status" IN ('NEW', 'READ', 'CLOSED')),
  "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "ContactEnquiry_store_idx" ON "ContactEnquiry"("storeId", "createdAt" DESC, "id");
ALTER TABLE "Product" ADD COLUMN "specifications" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "StoreSettings" ADD COLUMN "shippingCopy" TEXT NOT NULL DEFAULT '';

-- New tables stay server-owned; browser identities receive no direct data grants.
DO $isolate$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['StoreCustomer','CustomerAddress','CustomerWishlist','NewsletterSubscriber','ContactEnquiry'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', table_name);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO jelly_backend', table_name);
      EXECUTE format('CREATE POLICY backend_access ON public.%I TO jelly_backend USING (true) WITH CHECK (true)', table_name);
    END IF;
  END LOOP;
END
$isolate$;
