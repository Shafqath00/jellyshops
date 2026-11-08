-- Theme packages: themes built outside the platform (data, CSS and images only; nothing executable).
--
--   ThemePackage         one theme: who owns it and the theme id it declares
--   ThemePackageVersion  one immutable, validated upload of it (manifest, starter, CSS, asset list)
--   ThemeInstall         which version of which package a store uses
--
-- Versions never change after upload except their status (yanked versions stay readable so stores
-- that already pinned them keep working). Asset files live in object storage; this table keeps their
-- paths, sizes and hashes. Existing "themeArtifactId" / "draftArtifactId" columns will hold a
-- ThemePackageVersion id.
CREATE TABLE IF NOT EXISTS "ThemePackage" (
  "id" TEXT NOT NULL,
  "ownerStoreId" TEXT NOT NULL,
  "themeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ThemePackage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ThemePackage_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ThemePackage_themeId_check" CHECK ("themeId" ~ '^[a-z][a-z0-9-]{1,62}$'),
  CONSTRAINT "ThemePackage_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 80),
  CONSTRAINT "ThemePackage_visibility_check" CHECK ("visibility" IN ('private', 'listed'))
);
-- A theme id is claimed by one owner, platform-wide, so two packages can never answer to the same id.
CREATE UNIQUE INDEX IF NOT EXISTS "ThemePackage_themeId_key" ON "ThemePackage" ("themeId");
CREATE INDEX IF NOT EXISTS "ThemePackage_ownerStoreId_idx" ON "ThemePackage" ("ownerStoreId");

CREATE TABLE IF NOT EXISTS "ThemePackageVersion" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "manifest" JSONB NOT NULL,
  "starter" JSONB,
  "css" TEXT NOT NULL DEFAULT '',
  "assets" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ThemePackageVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ThemePackageVersion_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ThemePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ThemePackageVersion_version_check" CHECK ("version" ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  CONSTRAINT "ThemePackageVersion_status_check" CHECK ("status" IN ('active', 'yanked')),
  CONSTRAINT "ThemePackageVersion_manifest_check" CHECK (jsonb_typeof("manifest") = 'object'),
  CONSTRAINT "ThemePackageVersion_assets_check" CHECK (jsonb_typeof("assets") = 'array'),
  CONSTRAINT "ThemePackageVersion_css_size_check" CHECK (char_length("css") <= 200000)
);
CREATE UNIQUE INDEX IF NOT EXISTS "ThemePackageVersion_packageId_version_key" ON "ThemePackageVersion" ("packageId", "version");

CREATE TABLE IF NOT EXISTS "ThemeInstall" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "installedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "installedBy" TEXT,
  CONSTRAINT "ThemeInstall_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ThemeInstall_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ThemeInstall_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ThemePackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ThemeInstall_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ThemePackageVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- One installed version per package per store; upgrading replaces the row.
CREATE UNIQUE INDEX IF NOT EXISTS "ThemeInstall_storeId_packageId_key" ON "ThemeInstall" ("storeId", "packageId");

-- Server-only, like the other store tables: row level security on, only the backend role may read or write.
DO $isolate$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['ThemePackage', 'ThemePackageVersion', 'ThemeInstall'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', table_name);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON public.%I FROM anon', table_name); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', table_name); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO jelly_backend', table_name);
      EXECUTE format('CREATE POLICY backend_access ON public.%I TO jelly_backend USING (true) WITH CHECK (true)', table_name);
    END IF;
  END LOOP;
END
$isolate$;
