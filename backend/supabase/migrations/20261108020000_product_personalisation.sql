-- Personalisation fields on a product (engraving, a name to print, a gift message, measurements).
-- Shoppers fill them in per cart line; the text is stored on the order line with the other choices.
-- At most five fields; the API reads them through readPersonalisationFields, which drops anything malformed.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "personalisation" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_personalisation_check";
ALTER TABLE "Product" ADD CONSTRAINT "Product_personalisation_check"
  CHECK (jsonb_typeof("personalisation") = 'array' AND jsonb_array_length("personalisation") <= 5);
