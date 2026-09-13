CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "slug" TEXT NOT NULL,
    "vendor" TEXT,
    "productType" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "priceMinor" INTEGER NOT NULL,
    "compareAtPriceMinor" INTEGER,
    "weightGrams" INTEGER,
    "options" JSONB NOT NULL,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "externalId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryLevel" (
    "storeId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryLevel_pkey" PRIMARY KEY ("storeId", "variantId")
);

CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectionProduct" (
    "storeId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CollectionProduct_pkey" PRIMARY KEY ("storeId", "collectionId", "productId")
);

CREATE TABLE "ProductMedia" (
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "altText" TEXT,
    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("storeId", "productId", "mediaId")
);

CREATE UNIQUE INDEX "Product_storeId_id_key" ON "Product"("storeId", "id");
CREATE UNIQUE INDEX "Product_storeId_slug_key" ON "Product"("storeId", "slug");
CREATE UNIQUE INDEX "Product_storeId_externalId_key" ON "Product"("storeId", "externalId");
CREATE INDEX "Product_storeId_status_idx" ON "Product"("storeId", "status");

CREATE UNIQUE INDEX "ProductVariant_storeId_id_key" ON "ProductVariant"("storeId", "id");
CREATE UNIQUE INDEX "ProductVariant_storeId_sku_key" ON "ProductVariant"("storeId", "sku");
CREATE UNIQUE INDEX "ProductVariant_storeId_externalId_key" ON "ProductVariant"("storeId", "externalId");
CREATE INDEX "ProductVariant_storeId_productId_idx" ON "ProductVariant"("storeId", "productId");

CREATE UNIQUE INDEX "Collection_storeId_id_key" ON "Collection"("storeId", "id");
CREATE UNIQUE INDEX "Collection_storeId_slug_key" ON "Collection"("storeId", "slug");
CREATE UNIQUE INDEX "Collection_storeId_externalId_key" ON "Collection"("storeId", "externalId");

CREATE INDEX "CollectionProduct_storeId_productId_idx" ON "CollectionProduct"("storeId", "productId");
CREATE INDEX "ProductMedia_storeId_mediaId_idx" ON "ProductMedia"("storeId", "mediaId");

ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_storeId_productId_fkey"
FOREIGN KEY ("storeId", "productId") REFERENCES "Product"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_storeId_variantId_fkey"
FOREIGN KEY ("storeId", "variantId") REFERENCES "ProductVariant"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_storeId_collectionId_fkey"
FOREIGN KEY ("storeId", "collectionId") REFERENCES "Collection"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_storeId_productId_fkey"
FOREIGN KEY ("storeId", "productId") REFERENCES "Product"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_storeId_productId_fkey"
FOREIGN KEY ("storeId", "productId") REFERENCES "Product"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_storeId_mediaId_fkey"
FOREIGN KEY ("storeId", "mediaId") REFERENCES "Media"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_priceMinor_check" CHECK ("priceMinor" >= 0),
  ADD CONSTRAINT "ProductVariant_compareAtPriceMinor_check" CHECK ("compareAtPriceMinor" IS NULL OR "compareAtPriceMinor" >= 0),
  ADD CONSTRAINT "ProductVariant_weightGrams_check" CHECK ("weightGrams" IS NULL OR "weightGrams" >= 0);
ALTER TABLE "InventoryLevel"
  ADD CONSTRAINT "InventoryLevel_quantity_check" CHECK ("quantity" >= 0),
  ADD CONSTRAINT "InventoryLevel_reserved_check" CHECK ("reserved" >= 0 AND "reserved" <= "quantity");
ALTER TABLE "CollectionProduct"
  ADD CONSTRAINT "CollectionProduct_position_check" CHECK ("position" >= 0);
ALTER TABLE "ProductMedia"
  ADD CONSTRAINT "ProductMedia_position_check" CHECK ("position" >= 0);
