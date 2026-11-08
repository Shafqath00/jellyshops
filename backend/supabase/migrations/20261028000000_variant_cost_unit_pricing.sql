-- Internal cost per item (for profit/margin) and optional unit pricing ("£2.00 / 100 g").
ALTER TABLE "ProductVariant"
  ADD COLUMN IF NOT EXISTS "costMinor" INTEGER,
  ADD COLUMN IF NOT EXISTS "unitPricing" JSONB;

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_costMinor_check" CHECK ("costMinor" IS NULL OR "costMinor" >= 0);
