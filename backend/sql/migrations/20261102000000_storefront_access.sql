-- Optional password in front of a storefront ("Password protection" in store settings).
-- Server-only: the hash is never part of a Store row or any public response, and the
-- browser Data API roles get no access to this table.
CREATE TABLE IF NOT EXISTS "StorefrontAccess" (
  "storeId" TEXT NOT NULL,
  "passwordHash" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "message" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "StorefrontAccess_pkey" PRIMARY KEY ("storeId"),
  CONSTRAINT "StorefrontAccess_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StorefrontAccess_enabled_check" CHECK (NOT "enabled" OR "passwordHash" IS NOT NULL),
  CONSTRAINT "StorefrontAccess_message_check" CHECK (char_length("message") <= 500)
);

ALTER TABLE public."StorefrontAccess" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."StorefrontAccess" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."StorefrontAccess" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."StorefrontAccess" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE ON public."StorefrontAccess" TO jelly_backend;
    CREATE POLICY backend_access ON public."StorefrontAccess" TO jelly_backend USING (true) WITH CHECK (true);
  END IF;
END
$isolate$;
