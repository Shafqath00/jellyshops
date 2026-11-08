-- Theme library: saved looks of a store (a theme, its version and its settings under a name).
-- Merchants save the current look, switch the store to a saved one, rename and delete them.
-- Looks are not part of drafts or publications; applying one goes through the normal theme save.
CREATE TABLE IF NOT EXISTS "ThemeLibraryEntry" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "themeId" TEXT NOT NULL,
  "themeVersion" TEXT NOT NULL,
  "settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ThemeLibraryEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ThemeLibraryEntry_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ThemeLibraryEntry_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 80),
  CONSTRAINT "ThemeLibraryEntry_settings_check" CHECK (jsonb_typeof("settings") = 'object')
);
CREATE INDEX IF NOT EXISTS "ThemeLibraryEntry_storeId_createdAt_idx" ON "ThemeLibraryEntry" ("storeId", "createdAt");

ALTER TABLE public."ThemeLibraryEntry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ThemeLibraryEntry" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."ThemeLibraryEntry" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."ThemeLibraryEntry" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."ThemeLibraryEntry" TO jelly_backend;
    CREATE POLICY backend_access ON public."ThemeLibraryEntry" TO jelly_backend USING (true) WITH CHECK (true);
  END IF;
END
$isolate$;
