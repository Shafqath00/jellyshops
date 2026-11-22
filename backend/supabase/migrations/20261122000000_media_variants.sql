-- Which resized copies exist for each uploaded image, and a tiny blurred placeholder shown while a photo loads.
-- Both are optional: NULL means "uploaded before this"; the image route then falls back to looking for copies.
-- See docs/plans/2026-11-22-speed-cost-phase-2-migrations.md.
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "variantWidths" INTEGER[];
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "placeholder" TEXT;

DO $media_placeholder$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Media_placeholder_size') THEN
    -- The placeholder travels in every product payload, so it must stay tiny.
    ALTER TABLE "Media" ADD CONSTRAINT "Media_placeholder_size"
      CHECK ("placeholder" IS NULL OR (char_length("placeholder") <= 1200 AND "placeholder" LIKE 'data:image/webp;base64,%'));
  END IF;
END
$media_placeholder$;
