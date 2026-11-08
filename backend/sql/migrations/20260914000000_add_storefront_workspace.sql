CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "StorefrontTemplateType" AS ENUM ('HOME', 'PRODUCT', 'COLLECTION', 'PAGE', 'BLOG', 'ARTICLE', 'SEARCH', 'CART');

CREATE TABLE "StorefrontWorkspace" (
  "storeId" TEXT NOT NULL,
  "generation" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorefrontWorkspace_pkey" PRIMARY KEY ("storeId")
);

CREATE TABLE "StorefrontTemplate" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "type" "StorefrontTemplateType" NOT NULL,
  "handle" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "layout" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorefrontTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GlobalSection" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "name" TEXT NOT NULL,
  "section" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GlobalSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SectionPreset" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "name" TEXT NOT NULL,
  "section" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SectionPreset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NavigationMenu" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "name" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NavigationMenu_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThemeConfiguration" (
  "storeId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "themeId" TEXT NOT NULL,
  "settings" JSONB NOT NULL,
  "draftArtifactId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ThemeConfiguration_pkey" PRIMARY KEY ("storeId")
);

CREATE TABLE "StorefrontTemplateAssignment" (
  "storeId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "templateId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorefrontTemplateAssignment_pkey" PRIMARY KEY ("storeId", "resourceType", "resourceId")
);

CREATE TABLE "StorePage" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "featuredMediaId" TEXT,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "socialMediaId" TEXT,
  "noindex" BOOLEAN NOT NULL DEFAULT false,
  "canonicalOverride" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorePage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Blog" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Blog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Article" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "blogId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "excerpt" TEXT NOT NULL DEFAULT '',
  "content" JSONB NOT NULL,
  "featuredMediaId" TEXT,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "socialMediaId" TEXT,
  "noindex" BOOLEAN NOT NULL DEFAULT false,
  "canonicalOverride" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorefrontTemplate_storeId_id_key" ON "StorefrontTemplate"("storeId", "id");
CREATE UNIQUE INDEX "StorefrontTemplate_storeId_type_handle_key" ON "StorefrontTemplate"("storeId", "type", "handle");
CREATE INDEX "StorefrontTemplate_storeId_type_idx" ON "StorefrontTemplate"("storeId", "type");
CREATE UNIQUE INDEX "GlobalSection_storeId_id_key" ON "GlobalSection"("storeId", "id");
CREATE INDEX "GlobalSection_storeId_name_idx" ON "GlobalSection"("storeId", "name");
CREATE UNIQUE INDEX "SectionPreset_storeId_id_key" ON "SectionPreset"("storeId", "id");
CREATE INDEX "SectionPreset_storeId_name_idx" ON "SectionPreset"("storeId", "name");
CREATE UNIQUE INDEX "NavigationMenu_storeId_id_key" ON "NavigationMenu"("storeId", "id");
CREATE UNIQUE INDEX "NavigationMenu_storeId_handle_key" ON "NavigationMenu"("storeId", "handle");
CREATE INDEX "StorefrontTemplateAssignment_storeId_templateId_idx" ON "StorefrontTemplateAssignment"("storeId", "templateId");
CREATE UNIQUE INDEX "StorePage_storeId_id_key" ON "StorePage"("storeId", "id");
CREATE UNIQUE INDEX "StorePage_storeId_handle_key" ON "StorePage"("storeId", "handle");
CREATE INDEX "StorePage_storeId_status_idx" ON "StorePage"("storeId", "status");
CREATE UNIQUE INDEX "Blog_storeId_id_key" ON "Blog"("storeId", "id");
CREATE UNIQUE INDEX "Blog_storeId_handle_key" ON "Blog"("storeId", "handle");
CREATE UNIQUE INDEX "Article_storeId_id_key" ON "Article"("storeId", "id");
CREATE UNIQUE INDEX "Article_storeId_blogId_handle_key" ON "Article"("storeId", "blogId", "handle");
CREATE INDEX "Article_storeId_status_idx" ON "Article"("storeId", "status");

ALTER TABLE "StorefrontWorkspace" ADD CONSTRAINT "StorefrontWorkspace_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontTemplate" ADD CONSTRAINT "StorefrontTemplate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GlobalSection" ADD CONSTRAINT "GlobalSection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SectionPreset" ADD CONSTRAINT "SectionPreset_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NavigationMenu" ADD CONSTRAINT "NavigationMenu_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThemeConfiguration" ADD CONSTRAINT "ThemeConfiguration_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontTemplateAssignment" ADD CONSTRAINT "StorefrontTemplateAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontTemplateAssignment" ADD CONSTRAINT "StorefrontTemplateAssignment_storeId_templateId_fkey" FOREIGN KEY ("storeId", "templateId") REFERENCES "StorefrontTemplate"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorePage" ADD CONSTRAINT "StorePage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_storeId_blogId_fkey" FOREIGN KEY ("storeId", "blogId") REFERENCES "Blog"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StorefrontWorkspace" ADD CONSTRAINT "StorefrontWorkspace_generation_check" CHECK ("generation" >= 0);
ALTER TABLE "StorefrontTemplate" ADD CONSTRAINT "StorefrontTemplate_revision_check" CHECK ("revision" >= 0), ADD CONSTRAINT "StorefrontTemplate_layout_check" CHECK (jsonb_typeof("layout") = 'object');
ALTER TABLE "GlobalSection" ADD CONSTRAINT "GlobalSection_revision_check" CHECK ("revision" >= 0), ADD CONSTRAINT "GlobalSection_section_check" CHECK (jsonb_typeof("section") = 'object');
ALTER TABLE "SectionPreset" ADD CONSTRAINT "SectionPreset_revision_check" CHECK ("revision" >= 0), ADD CONSTRAINT "SectionPreset_section_check" CHECK (jsonb_typeof("section") = 'object');
ALTER TABLE "NavigationMenu" ADD CONSTRAINT "NavigationMenu_revision_check" CHECK ("revision" >= 0), ADD CONSTRAINT "NavigationMenu_items_check" CHECK (jsonb_typeof("items") = 'array');
ALTER TABLE "ThemeConfiguration" ADD CONSTRAINT "ThemeConfiguration_revision_check" CHECK ("revision" >= 0), ADD CONSTRAINT "ThemeConfiguration_settings_check" CHECK (jsonb_typeof("settings") = 'object');
ALTER TABLE "StorefrontTemplateAssignment" ADD CONSTRAINT "StorefrontTemplateAssignment_revision_check" CHECK ("revision" >= 0), ADD CONSTRAINT "StorefrontTemplateAssignment_resourceType_check" CHECK ("resourceType" IN ('product','collection','page','blog','article'));
ALTER TABLE "StorePage" ADD CONSTRAINT "StorePage_content_check" CHECK (jsonb_typeof("content") = 'object');
ALTER TABLE "Article" ADD CONSTRAINT "Article_content_check" CHECK (jsonb_typeof("content") = 'object');
