-- Rich text description edited in the collection form. "description" stays plain text, derived from
-- this document on every write, so search, SEO and plain-text clients keep working. NULL means a plain-text description.
ALTER TABLE "Collection"
  ADD COLUMN IF NOT EXISTS "descriptionDoc" JSONB;

ALTER TABLE "Collection"
  ADD CONSTRAINT "Collection_descriptionDoc_check" CHECK ("descriptionDoc" IS NULL OR jsonb_typeof("descriptionDoc") = 'object');
