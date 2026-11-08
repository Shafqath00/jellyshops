-- Rich text description edited in the product builder. "description" stays plain text, derived from
-- this document on every write, so search, SEO and emails keep working. NULL means a plain-text description.
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "descriptionDoc" JSONB;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_descriptionDoc_check" CHECK ("descriptionDoc" IS NULL OR jsonb_typeof("descriptionDoc") = 'object');
