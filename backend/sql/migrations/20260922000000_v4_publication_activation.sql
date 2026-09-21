ALTER TABLE "StorefrontPublication"
  DROP CONSTRAINT IF EXISTS "StorefrontPublication_sourceRevision_check";

ALTER TABLE "StorefrontPublication"
  ADD CONSTRAINT "StorefrontPublication_sourceRevision_check"
  CHECK ("sourceRevision" >= 0);
