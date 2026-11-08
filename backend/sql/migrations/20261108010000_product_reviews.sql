-- Product reviews written by shoppers and moderated by the merchant.
-- New reviews start as 'pending'; only 'published' reviews are ever shown to shoppers.
-- The author's email is for the merchant only and never part of a public response.
-- Server-only: the browser Data API roles get no access to this table.
CREATE TABLE IF NOT EXISTS "ProductReview" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "rating" SMALLINT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "body" TEXT NOT NULL DEFAULT '',
  "authorName" TEXT NOT NULL,
  "authorEmail" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "verifiedPurchase" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "publishedAt" TIMESTAMPTZ,
  CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductReview_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "ProductReview_status_check" CHECK ("status" IN ('pending', 'published', 'hidden')),
  CONSTRAINT "ProductReview_title_check" CHECK (char_length("title") <= 120),
  CONSTRAINT "ProductReview_body_check" CHECK (char_length("body") <= 2000),
  CONSTRAINT "ProductReview_authorName_check" CHECK (char_length("authorName") BETWEEN 1 AND 80),
  CONSTRAINT "ProductReview_authorEmail_check" CHECK ("authorEmail" IS NULL OR char_length("authorEmail") <= 254)
);

CREATE INDEX IF NOT EXISTS "ProductReview_store_product_status_idx" ON "ProductReview" ("storeId", "productId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ProductReview_store_status_idx" ON "ProductReview" ("storeId", "status", "createdAt" DESC);

ALTER TABLE public."ProductReview" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ProductReview" FROM PUBLIC;
DO $isolate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public."ProductReview" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public."ProductReview" FROM authenticated; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jelly_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public."ProductReview" TO jelly_backend;
    CREATE POLICY backend_access ON public."ProductReview" TO jelly_backend USING (true) WITH CHECK (true);
  END IF;
END
$isolate$;
