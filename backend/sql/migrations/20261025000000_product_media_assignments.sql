ALTER TABLE "ProductMedia"
  ADD COLUMN "appliesTo" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT "ProductMedia_appliesTo_check" CHECK (jsonb_typeof("appliesTo") = 'object');
