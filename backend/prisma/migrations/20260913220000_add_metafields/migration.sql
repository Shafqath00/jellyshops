CREATE TABLE "MetafieldDefinition" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "validations" JSONB,
    "storefrontVisible" BOOLEAN NOT NULL DEFAULT false,
    "origin" TEXT NOT NULL DEFAULT 'jelly',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetafieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetafieldValue" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetafieldValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetafieldDefinition_storeId_id_key" ON "MetafieldDefinition"("storeId", "id");
CREATE UNIQUE INDEX "MetafieldDefinition_storeId_ownerType_namespace_key_key" ON "MetafieldDefinition"("storeId", "ownerType", "namespace", "key");
CREATE INDEX "MetafieldDefinition_storeId_ownerType_archivedAt_idx" ON "MetafieldDefinition"("storeId", "ownerType", "archivedAt");
CREATE UNIQUE INDEX "MetafieldValue_storeId_definitionId_ownerId_key" ON "MetafieldValue"("storeId", "definitionId", "ownerId");
CREATE INDEX "MetafieldValue_storeId_ownerId_idx" ON "MetafieldValue"("storeId", "ownerId");

ALTER TABLE "MetafieldDefinition" ADD CONSTRAINT "MetafieldDefinition_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MetafieldValue" ADD CONSTRAINT "MetafieldValue_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MetafieldValue" ADD CONSTRAINT "MetafieldValue_storeId_definitionId_fkey"
FOREIGN KEY ("storeId", "definitionId") REFERENCES "MetafieldDefinition"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MetafieldDefinition"
  ADD CONSTRAINT "MetafieldDefinition_ownerType_check" CHECK ("ownerType" IN ('store','product','variant','collection','page','blog','article')),
  ADD CONSTRAINT "MetafieldDefinition_origin_check" CHECK ("origin" IN ('jelly','provider')),
  ADD CONSTRAINT "MetafieldDefinition_namespace_check" CHECK ("namespace" ~ '^[a-z][a-z0-9_]*$'),
  ADD CONSTRAINT "MetafieldDefinition_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_]*$');
