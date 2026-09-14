ALTER TABLE "StorefrontPublication"
  ADD COLUMN "sourceGeneration" INTEGER,
  ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "compilerVersion" TEXT,
  ADD COLUMN "dependencyManifest" JSONB,
  ADD COLUMN "themeArtifactId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;

ALTER TABLE "StorefrontPublication"
  ADD CONSTRAINT "StorefrontPublication_sourceGeneration_nonnegative"
  CHECK ("sourceGeneration" IS NULL OR "sourceGeneration" >= 0),
  ADD CONSTRAINT "StorefrontPublication_schemaVersion_positive"
  CHECK ("schemaVersion" > 0);

CREATE UNIQUE INDEX "StorefrontPublication_storeId_idempotencyKey_key"
  ON "StorefrontPublication"("storeId", "idempotencyKey");
