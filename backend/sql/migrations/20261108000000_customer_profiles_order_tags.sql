-- Customers the merchant manages in the admin: name, phone, address, a private note and tags,
-- keyed by email so they join the customers already known from orders. Email marketing consent
-- stays in "NewsletterSubscriber" (one place for consent). Orders gain tags for the order list.
CREATE TABLE IF NOT EXISTS "CustomerProfile" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "firstName" TEXT NOT NULL DEFAULT '',
  "lastName" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "note" TEXT NOT NULL DEFAULT '',
  "tags" TEXT[] NOT NULL DEFAULT '{}',
  "address" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerProfile_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerProfile_email_check" CHECK ("email" = lower(btrim("email")) AND "email" LIKE '%_@_%'),
  CONSTRAINT "CustomerProfile_note_check" CHECK (char_length("note") <= 5000),
  CONSTRAINT "CustomerProfile_tags_check" CHECK (cardinality("tags") <= 50),
  CONSTRAINT "CustomerProfile_address_check" CHECK ("address" IS NULL OR jsonb_typeof("address") = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerProfile_storeId_email_key" ON "CustomerProfile" ("storeId", "email");

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_tags_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_tags_check" CHECK (cardinality("tags") <= 50);
CREATE INDEX IF NOT EXISTS "Order_tags_idx" ON "Order" USING GIN ("tags");

ALTER TABLE public."CustomerProfile" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."CustomerProfile" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."CustomerProfile" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."CustomerProfile" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."CustomerProfile" TO jelly_backend;
    CREATE POLICY backend_access ON public."CustomerProfile" TO jelly_backend USING (true) WITH CHECK (true);
  END IF;
END
$isolate$;
