ALTER TABLE "Media" ADD COLUMN "contentHash" TEXT;
CREATE UNIQUE INDEX "Media_storeId_contentHash_key" ON "Media" ("storeId", "contentHash") WHERE "contentHash" IS NOT NULL;
