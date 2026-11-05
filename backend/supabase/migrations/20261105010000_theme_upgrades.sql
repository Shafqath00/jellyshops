-- Theme upgrades: a rollback point for each merchant upgrade of an uploaded theme.
--
-- Upgrading moves the store's draft (theme settings, shared sections, template layouts) from one
-- version of an uploaded theme to a newer one, running the theme's declared migrations. Before it
-- writes anything it keeps the draft as it was here, so the merchant can undo the upgrade. The
-- live store is never touched: it changes only when the merchant publishes, as always.
CREATE TABLE IF NOT EXISTS "ThemeUpgradeBackup" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "fromVersionId" TEXT NOT NULL,
  "toVersionId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "restoredAt" TIMESTAMPTZ,
  CONSTRAINT "ThemeUpgradeBackup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ThemeUpgradeBackup_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ThemeUpgradeBackup_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ThemePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ThemeUpgradeBackup_fromVersionId_fkey" FOREIGN KEY ("fromVersionId") REFERENCES "ThemePackageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ThemeUpgradeBackup_toVersionId_fkey" FOREIGN KEY ("toVersionId") REFERENCES "ThemePackageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ThemeUpgradeBackup_snapshot_check" CHECK (jsonb_typeof("snapshot") = 'object')
);
CREATE INDEX IF NOT EXISTS "ThemeUpgradeBackup_storeId_createdAt_idx" ON "ThemeUpgradeBackup" ("storeId", "createdAt" DESC);

-- Server-only, like the other store tables: row level security on, only the backend role may read or write.
ALTER TABLE public."ThemeUpgradeBackup" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ThemeUpgradeBackup" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."ThemeUpgradeBackup" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."ThemeUpgradeBackup" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."ThemeUpgradeBackup" TO jelly_backend;
    CREATE POLICY backend_access ON public."ThemeUpgradeBackup" TO jelly_backend USING (true) WITH CHECK (true);
  END IF;
END
$isolate$;
