-- Repair migration for databases created before themeVersion was introduced or
-- upgraded with the original escaped constraint expression.
ALTER TABLE "ThemeConfiguration"
  ADD COLUMN IF NOT EXISTS "themeVersion" TEXT NOT NULL DEFAULT '1.0.0';

ALTER TABLE "ThemeConfiguration"
  DROP CONSTRAINT IF EXISTS "ThemeConfiguration_themeVersion_check";

ALTER TABLE "ThemeConfiguration"
  ADD CONSTRAINT "ThemeConfiguration_themeVersion_check"
  CHECK ("themeVersion" ~ '^[0-9]+\.[0-9]+\.[0-9]+([+-][A-Za-z0-9.-]+)?$');
