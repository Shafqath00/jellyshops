-- Store preferences (Settings > Store preferences), phase 1.
-- Additive only: two new tables, nothing existing changes. Until this runs, the preferences API answers
-- `available: false` and stores draw exactly as before.
--
-- * StorePreferences: one row per store with the whole preferences document (search listing, social sharing,
--   business details, policies, tracking ids, cookie banner, spam protection). The document is checked by the shared
--   schema in @jelly/storefront-schema on every save; `revision` stops two sessions overwriting each other.
--   "history" keeps the last 50 changes (when, who, which sections). Kept here rather than in "AuditEvent":
--   audit rows can never be deleted and would stop a closed shop from ever being removed.
-- * UrlRedirect: old address on the store -> new address, added by the merchant (by hand or from a CSV). Used only
--   when the old address no longer shows a page, so a redirect never hides a live page.

CREATE TABLE IF NOT EXISTS "StorePreferences" (
  "storeId" TEXT NOT NULL,
  "document" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedBy" TEXT,
  "history" JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT "StorePreferences_pkey" PRIMARY KEY ("storeId"),
  CONSTRAINT "StorePreferences_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StorePreferences_document_check" CHECK (jsonb_typeof("document") = 'object' AND pg_column_size("document") <= 65536),
  CONSTRAINT "StorePreferences_history_check" CHECK (jsonb_typeof("history") = 'array' AND jsonb_array_length("history") <= 50),
  CONSTRAINT "StorePreferences_revision_check" CHECK ("revision" >= 0)
);

CREATE TABLE IF NOT EXISTS "UrlRedirect" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "fromPath" TEXT NOT NULL,
  "toPath" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UrlRedirect_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UrlRedirect_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UrlRedirect_fromPath_check" CHECK (left("fromPath", 1) = '/' AND char_length("fromPath") BETWEEN 2 AND 300),
  CONSTRAINT "UrlRedirect_toPath_check" CHECK ((left("toPath", 1) = '/' OR left("toPath", 8) = 'https://') AND char_length("toPath") BETWEEN 1 AND 500)
);
CREATE UNIQUE INDEX IF NOT EXISTS "UrlRedirect_storeId_fromPath_key" ON "UrlRedirect" ("storeId", "fromPath");
CREATE INDEX IF NOT EXISTS "UrlRedirect_storeId_createdAt_idx" ON "UrlRedirect" ("storeId", "createdAt" DESC);

-- Server-only, like every other store table: row security on, the backend role only, nothing for browser roles.
ALTER TABLE public."StorePreferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UrlRedirect" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."StorePreferences" FROM PUBLIC;
REVOKE ALL ON public."UrlRedirect" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public."StorePreferences" FROM anon;
    REVOKE ALL ON public."UrlRedirect" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public."StorePreferences" FROM authenticated;
    REVOKE ALL ON public."UrlRedirect" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."StorePreferences" TO jelly_backend;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."UrlRedirect" TO jelly_backend;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'StorePreferences' AND policyname = 'backend_access') THEN
      CREATE POLICY backend_access ON public."StorePreferences" TO jelly_backend USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'UrlRedirect' AND policyname = 'backend_access') THEN
      CREATE POLICY backend_access ON public."UrlRedirect" TO jelly_backend USING (true) WITH CHECK (true);
    END IF;
  END IF;
END
$isolate$;
