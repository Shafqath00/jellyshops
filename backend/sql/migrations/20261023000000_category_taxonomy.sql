-- Persisted per-store category tree and the option templates each category suggests.
-- Additive only: no existing table or column is changed. Products keep referencing
-- categories through the existing "primaryCategoryId" text column (no foreign key,
-- because existing values came from browser-local state and may not exist here).
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'merchant',
    "seedKey" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Category_source_check" CHECK ("source" IN ('platform', 'merchant')),
    CONSTRAINT "Category_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 80),
    CONSTRAINT "Category_not_own_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
    CONSTRAINT "Category_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Category_storeId_id_key" ON "Category"("storeId", "id");
ALTER TABLE "Category"
    ADD CONSTRAINT "Category_parent_fkey" FOREIGN KEY ("storeId", "parentId") REFERENCES "Category"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Makes platform-seed copying idempotent and safe under concurrent first requests.
CREATE UNIQUE INDEX "Category_storeId_seedKey_key" ON "Category"("storeId", "seedKey") WHERE "seedKey" IS NOT NULL;
-- Sibling slugs are unique among live categories.
CREATE UNIQUE INDEX "Category_storeId_parent_slug_key" ON "Category"("storeId", COALESCE("parentId", ''), "slug") WHERE "archivedAt" IS NULL;
CREATE INDEX "Category_storeId_parentId_idx" ON "Category"("storeId", "parentId");

CREATE TABLE "CategoryOptionTemplate" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "optionKind" TEXT NOT NULL DEFAULT 'configuration',
    "displayType" TEXT NOT NULL DEFAULT 'buttons',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "defaultValues" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "position" INTEGER NOT NULL DEFAULT 0,
    "seedKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CategoryOptionTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CategoryOptionTemplate_kind_check" CHECK ("optionKind" IN ('variant', 'configuration', 'addon')),
    CONSTRAINT "CategoryOptionTemplate_display_check" CHECK ("displayType" IN ('buttons', 'dropdown', 'color', 'image')),
    CONSTRAINT "CategoryOptionTemplate_values_check" CHECK (jsonb_typeof("defaultValues") = 'array'),
    CONSTRAINT "CategoryOptionTemplate_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 80),
    CONSTRAINT "CategoryOptionTemplate_category_fkey" FOREIGN KEY ("storeId", "categoryId") REFERENCES "Category"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CategoryOptionTemplate_storeId_seedKey_key" ON "CategoryOptionTemplate"("storeId", "seedKey") WHERE "seedKey" IS NOT NULL;
CREATE UNIQUE INDEX "CategoryOptionTemplate_category_name_key" ON "CategoryOptionTemplate"("storeId", "categoryId", lower("name"));
CREATE INDEX "CategoryOptionTemplate_storeId_categoryId_idx" ON "CategoryOptionTemplate"("storeId", "categoryId");

-- Backend service credentials own these records. No direct Data API access.
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CategoryOptionTemplate" ENABLE ROW LEVEL SECURITY;
DO $isolate$
DECLARE table_name TEXT;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['Category','CategoryOptionTemplate'] LOOP
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',table_name);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON public.%I FROM anon',table_name); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON public.%I FROM authenticated',table_name); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='jelly_backend') THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO jelly_backend',table_name);
   EXECUTE format('CREATE POLICY backend_access ON public.%I TO jelly_backend USING(true) WITH CHECK(true)',table_name);
  END IF;
 END LOOP;
END $isolate$;
