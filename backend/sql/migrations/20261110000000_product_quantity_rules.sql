-- Quantity rules on a product: a minimum order, steps (sold in sixes) and a most per order, applied to each variant.
-- Stored as {"min": n, "step": n, "max"?: n}; NULL means no rule. The API reads it through readQuantityRule and
-- refuses rules whose minimum or most is not a multiple of the step. Checkout enforces it.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "quantityRule" JSONB;

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_quantityRule_check";
ALTER TABLE "Product" ADD CONSTRAINT "Product_quantityRule_check"
  CHECK ("quantityRule" IS NULL OR jsonb_typeof("quantityRule") = 'object');
