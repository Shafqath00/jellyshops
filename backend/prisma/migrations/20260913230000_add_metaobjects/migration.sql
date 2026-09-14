CREATE TABLE "MetaobjectDefinition" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storefrontVisible" BOOLEAN NOT NULL DEFAULT false,
    "fields" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaobjectDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaobjectEntry" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaobjectEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetaobjectDefinition_storeId_id_key" ON "MetaobjectDefinition"("storeId", "id");
CREATE UNIQUE INDEX "MetaobjectDefinition_storeId_handle_key" ON "MetaobjectDefinition"("storeId", "handle");
CREATE INDEX "MetaobjectDefinition_storeId_archivedAt_idx" ON "MetaobjectDefinition"("storeId", "archivedAt");
CREATE UNIQUE INDEX "MetaobjectEntry_storeId_id_key" ON "MetaobjectEntry"("storeId", "id");
CREATE UNIQUE INDEX "MetaobjectEntry_storeId_definitionId_handle_key" ON "MetaobjectEntry"("storeId", "definitionId", "handle");
CREATE INDEX "MetaobjectEntry_storeId_definitionId_archivedAt_idx" ON "MetaobjectEntry"("storeId", "definitionId", "archivedAt");

ALTER TABLE "MetaobjectDefinition" ADD CONSTRAINT "MetaobjectDefinition_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MetaobjectEntry" ADD CONSTRAINT "MetaobjectEntry_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MetaobjectEntry" ADD CONSTRAINT "MetaobjectEntry_storeId_definitionId_fkey"
FOREIGN KEY ("storeId", "definitionId") REFERENCES "MetaobjectDefinition"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MetaobjectDefinition"
  ADD CONSTRAINT "MetaobjectDefinition_handle_check" CHECK ("handle" ~ '^[a-z][a-z0-9_]*$'),
  ADD CONSTRAINT "MetaobjectDefinition_fields_check" CHECK (jsonb_typeof("fields") = 'array');
ALTER TABLE "MetaobjectEntry"
  ADD CONSTRAINT "MetaobjectEntry_handle_check" CHECK ("handle" ~ '^[a-z][a-z0-9-]*$'),
  ADD CONSTRAINT "MetaobjectEntry_values_check" CHECK (jsonb_typeof("values") = 'object');
