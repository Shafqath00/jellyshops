-- Retired shop web addresses. When a shop changes its address, the old one is kept here: it keeps redirecting to the
-- shop's current address and can never be taken by another shop (owner decision, 2026-11-22). A shop may take its own
-- old address back. Also used to limit address changes to 3 per 30 days.
-- See docs/plans/2026-11-22-subdomain-tenancy-plan.md section 10. Additive only.
CREATE TABLE IF NOT EXISTS "StoreSlugHistory" (
  "slug" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "retiredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "StoreSlugHistory_pkey" PRIMARY KEY ("slug"),
  CONSTRAINT "StoreSlugHistory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StoreSlugHistory_slug_check" CHECK ("slug" = lower("slug") AND char_length("slug") BETWEEN 1 AND 63)
);
CREATE INDEX IF NOT EXISTS "StoreSlugHistory_store_idx" ON "StoreSlugHistory" ("storeId", "retiredAt" DESC);

ALTER TABLE public."StoreSlugHistory" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."StoreSlugHistory" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."StoreSlugHistory" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."StoreSlugHistory" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."StoreSlugHistory" TO jelly_backend;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'StoreSlugHistory' AND policyname = 'backend_access') THEN
      CREATE POLICY backend_access ON public."StoreSlugHistory" TO jelly_backend USING (true) WITH CHECK (true);
    END IF;
  END IF;
END
$isolate$;
