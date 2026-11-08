-- What search engines and social cards show for a product. Both are optional: when empty, the storefront uses
-- the product title and the start of its description.

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "seoTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_seoTitle_check" CHECK ("seoTitle" IS NULL OR length("seoTitle") BETWEEN 1 AND 255),
  ADD CONSTRAINT "Product_seoDescription_check" CHECK ("seoDescription" IS NULL OR length("seoDescription") BETWEEN 1 AND 500);
