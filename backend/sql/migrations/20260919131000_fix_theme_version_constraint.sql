ALTER TABLE "ThemeConfiguration"
  DROP CONSTRAINT IF EXISTS "ThemeConfiguration_themeVersion_check";

ALTER TABLE "ThemeConfiguration"
  ADD CONSTRAINT "ThemeConfiguration_themeVersion_check"
  CHECK ("themeVersion" ~ '^[0-9]+\.[0-9]+\.[0-9]+([+-][A-Za-z0-9.-]+)?$');
