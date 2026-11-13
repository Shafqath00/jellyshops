-- Product imports: one record per uploaded spreadsheet. It holds the file's rows until the merchant has
-- checked and confirmed them, the progress of the import (it runs in small steps, so it can be resumed),
-- the outcome for every product, and what is needed to undo it. It is also the audit trail of imports.
-- Server-only: the browser Data API roles get no access to this table.
CREATE TABLE IF NOT EXISTS "ProductImport" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "createdBy" TEXT,
  "fileName" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'uploaded',
  "mode" TEXT NOT NULL DEFAULT 'upsert',
  "headers" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "rows" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "mapping" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "summary" JSONB,
  "cursor" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "results" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "undo" JSONB NOT NULL DEFAULT '{"created":[],"updated":[],"added":[]}'::jsonb,
  "counts" JSONB NOT NULL DEFAULT '{"created":0,"updated":0,"skipped":0,"failed":0}'::jsonb,
  "lockedUntil" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "finishedAt" TIMESTAMPTZ,
  "undoneAt" TIMESTAMPTZ,
  CONSTRAINT "ProductImport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductImport_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductImport_status_check" CHECK ("status" IN ('uploaded', 'checked', 'running', 'finished', 'undone')),
  CONSTRAINT "ProductImport_mode_check" CHECK ("mode" IN ('create', 'update', 'upsert')),
  CONSTRAINT "ProductImport_format_check" CHECK ("format" IN ('csv', 'xlsx')),
  CONSTRAINT "ProductImport_rowCount_check" CHECK ("rowCount" BETWEEN 0 AND 5000),
  CONSTRAINT "ProductImport_fileName_check" CHECK (char_length("fileName") BETWEEN 1 AND 255)
);

CREATE INDEX IF NOT EXISTS "ProductImport_store_idx" ON "ProductImport" ("storeId", "createdAt" DESC);

ALTER TABLE public."ProductImport" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ProductImport" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."ProductImport" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."ProductImport" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."ProductImport" TO jelly_backend;
    CREATE POLICY backend_access ON public."ProductImport" TO jelly_backend USING (true) WITH CHECK (true);
  END IF;
END
$isolate$;
