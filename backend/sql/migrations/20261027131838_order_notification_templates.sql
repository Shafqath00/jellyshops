ALTER TABLE "StoreNotificationBranding"
  ADD COLUMN IF NOT EXISTS "templates" JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof("templates") = 'object');
