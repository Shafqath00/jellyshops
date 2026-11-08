CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT NOT NULL,
    "altText" TEXT,
    "referenced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Media_storeId_id_key" ON "Media"("storeId", "id");
CREATE UNIQUE INDEX "Media_storeId_storageKey_key" ON "Media"("storeId", "storageKey");
CREATE INDEX "Media_storeId_createdAt_idx" ON "Media"("storeId", "createdAt");

ALTER TABLE "Media" ADD CONSTRAINT "Media_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Media"
  ADD CONSTRAINT "Media_byteSize_check" CHECK ("byteSize" >= 0),
  ADD CONSTRAINT "Media_width_check" CHECK ("width" IS NULL OR "width" > 0),
  ADD CONSTRAINT "Media_height_check" CHECK ("height" IS NULL OR "height" > 0),
  ADD CONSTRAINT "Media_type_check" CHECK ("type" IN ('image', 'file'));
