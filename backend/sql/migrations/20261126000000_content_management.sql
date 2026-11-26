-- Content section redesign, phase 1 (pages and blog posts managed from the admin).
-- Additive only: every new column has a default or is nullable, so existing rows and older backend code keep working.
--
-- * scheduledAt: a draft with a time set here is published by the scheduled job once that time has passed.
-- * archivedAt: "Delete" in the admin archives first (hidden from shoppers, restorable); a permanent delete removes
--   the row and is only allowed from the archive.
-- * authorUserId / authorName: who wrote it, shown in lists and (for posts) on the storefront. The name is copied
--   so it survives the person leaving the shop.
-- * showInNavigation (pages): whether the page is offered first when building menus.
-- * tags (posts): up to 50 short labels.
-- * ContentRedirect: when a page, blog or post changes its web address, the old address keeps working by pointing at
--   the item (not at a fixed path), so a second rename never breaks the first old link.

ALTER TABLE "StorePage"
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "authorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "authorName" TEXT,
  ADD COLUMN IF NOT EXISTS "showInNavigation" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Article"
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "authorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "authorName" TEXT,
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';

DO $checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Article_tags_check') THEN
    ALTER TABLE "Article" ADD CONSTRAINT "Article_tags_check" CHECK (cardinality("tags") <= 50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StorePage_authorName_check') THEN
    ALTER TABLE "StorePage" ADD CONSTRAINT "StorePage_authorName_check" CHECK ("authorName" IS NULL OR char_length("authorName") <= 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Article_authorName_check') THEN
    ALTER TABLE "Article" ADD CONSTRAINT "Article_authorName_check" CHECK ("authorName" IS NULL OR char_length("authorName") <= 120);
  END IF;
END
$checks$;

-- The scheduled job looks for due drafts across all stores.
CREATE INDEX IF NOT EXISTS "StorePage_scheduledAt_idx" ON "StorePage" ("scheduledAt") WHERE "scheduledAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Article_scheduledAt_idx" ON "Article" ("scheduledAt") WHERE "scheduledAt" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "ContentRedirect" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "fromPath" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ContentRedirect_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContentRedirect_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContentRedirect_resourceType_check" CHECK ("resourceType" IN ('page', 'blog', 'article')),
  CONSTRAINT "ContentRedirect_fromPath_check" CHECK (left("fromPath", 1) = '/' AND char_length("fromPath") BETWEEN 2 AND 300)
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContentRedirect_storeId_fromPath_key" ON "ContentRedirect" ("storeId", "fromPath");
CREATE INDEX IF NOT EXISTS "ContentRedirect_resource_idx" ON "ContentRedirect" ("storeId", "resourceType", "resourceId");

ALTER TABLE public."ContentRedirect" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ContentRedirect" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."ContentRedirect" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."ContentRedirect" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."ContentRedirect" TO jelly_backend;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ContentRedirect' AND policyname = 'backend_access') THEN
      CREATE POLICY backend_access ON public."ContentRedirect" TO jelly_backend USING (true) WITH CHECK (true);
    END IF;
  END IF;
END
$isolate$;
