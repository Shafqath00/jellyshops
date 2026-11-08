ALTER TABLE "ThemeConfiguration"
  ADD COLUMN IF NOT EXISTS "themeVersion" TEXT NOT NULL DEFAULT '1.0.0';

ALTER TABLE "ThemeConfiguration"
  ADD CONSTRAINT "ThemeConfiguration_themeVersion_check"
  CHECK ("themeVersion" ~ '^[0-9]+\\.[0-9]+\\.[0-9]+([+-][A-Za-z0-9.-]+)?$');
