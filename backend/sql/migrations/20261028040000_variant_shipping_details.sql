-- Shipping and customs details per variant. For fulfilment, packing and customs forms.
-- Nothing here changes what a shopper pays: shipping is still the store's flat rate.

-- "weightGrams" already exists from the original catalog schema (nullable, never written until now).
ALTER TABLE "ProductVariant"
  ADD COLUMN IF NOT EXISTS "weightGrams" INTEGER,
  ADD COLUMN IF NOT EXISTS "lengthMm" INTEGER,
  ADD COLUMN IF NOT EXISTS "widthMm" INTEGER,
  ADD COLUMN IF NOT EXISTS "heightMm" INTEGER,
  ADD COLUMN IF NOT EXISTS "countryOfOrigin" TEXT,
  ADD COLUMN IF NOT EXISTS "hsCode" TEXT;

ALTER TABLE "ProductVariant" DROP CONSTRAINT IF EXISTS "ProductVariant_weightGrams_check";
ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_weightGrams_check" CHECK ("weightGrams" IS NULL OR "weightGrams" BETWEEN 0 AND 100000000),
  ADD CONSTRAINT "ProductVariant_lengthMm_check" CHECK ("lengthMm" IS NULL OR "lengthMm" BETWEEN 0 AND 10000000),
  ADD CONSTRAINT "ProductVariant_widthMm_check" CHECK ("widthMm" IS NULL OR "widthMm" BETWEEN 0 AND 10000000),
  ADD CONSTRAINT "ProductVariant_heightMm_check" CHECK ("heightMm" IS NULL OR "heightMm" BETWEEN 0 AND 10000000),
  ADD CONSTRAINT "ProductVariant_countryOfOrigin_check" CHECK ("countryOfOrigin" IS NULL OR "countryOfOrigin" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "ProductVariant_hsCode_check" CHECK ("hsCode" IS NULL OR "hsCode" ~ '^[0-9]{6,10}$');
