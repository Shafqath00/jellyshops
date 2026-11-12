-- Layout revisions: which starter page layout a store's draft was built from, and a rollback point
-- for each layout upgrade.
--
-- A theme's version never changes (published stores pin it), so the starter layout a store started
-- from needs its own number. NULL means "installed before this was recorded": the backend then
-- recognises the layout from the draft's sections. A layout upgrade rebuilds the draft's default
-- templates in the theme's current layout while keeping everything the merchant changed or added;
-- before writing it keeps the draft here so the merchant can undo it. The live store is never
-- touched: it changes only when the merchant publishes.
ALTER TABLE "StorefrontWorkspace" ADD COLUMN IF NOT EXISTS "layoutRevision" INTEGER;
ALTER TABLE "StorefrontWorkspace" DROP CONSTRAINT IF EXISTS "StorefrontWorkspace_layoutRevision_check";
ALTER TABLE "StorefrontWorkspace" ADD CONSTRAINT "StorefrontWorkspace_layoutRevision_check" CHECK ("layoutRevision" IS NULL OR "layoutRevision" >= 1);

CREATE TABLE IF NOT EXISTS "StorefrontLayoutBackup" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "themeId" TEXT NOT NULL,
  "fromRevision" INTEGER NOT NULL,
  "toRevision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "restoredAt" TIMESTAMPTZ,
  CONSTRAINT "StorefrontLayoutBackup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontLayoutBackup_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StorefrontLayoutBackup_revisions_check" CHECK ("fromRevision" >= 1 AND "toRevision" > "fromRevision"),
  CONSTRAINT "StorefrontLayoutBackup_snapshot_check" CHECK (jsonb_typeof("snapshot") = 'object')
);
CREATE INDEX IF NOT EXISTS "StorefrontLayoutBackup_storeId_createdAt_idx" ON "StorefrontLayoutBackup" ("storeId", "createdAt" DESC);

-- Server-only, like the other store tables: row level security on, only the backend role may read or write.
ALTER TABLE public."StorefrontLayoutBackup" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."StorefrontLayoutBackup" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."StorefrontLayoutBackup" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."StorefrontLayoutBackup" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."StorefrontLayoutBackup" TO jelly_backend;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'StorefrontLayoutBackup' AND policyname = 'backend_access') THEN
      CREATE POLICY backend_access ON public."StorefrontLayoutBackup" TO jelly_backend USING (true) WITH CHECK (true);
    END IF;
  END IF;
END
$isolate$;
