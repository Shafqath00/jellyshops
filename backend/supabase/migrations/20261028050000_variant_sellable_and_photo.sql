-- Two per-combination settings:
--   "sellable": the merchant can stop selling one combination without archiving it. A combination that is not
--               sellable is shown as unavailable and cannot be bought or added to an order.
--   "mediaId":  the photo shown first when a shopper picks this combination. It must be one of the product's photos;
--               the API enforces that and unlinks the combination when the photo is removed from the product.

ALTER TABLE "ProductVariant"
  ADD COLUMN IF NOT EXISTS "sellable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "mediaId" TEXT;

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_mediaId_check" CHECK ("mediaId" IS NULL OR length("mediaId") BETWEEN 1 AND 200);
