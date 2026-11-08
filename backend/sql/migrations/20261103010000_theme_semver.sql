-- Theme API 1 uses strict SemVer. Never rewrite an immutable theme or snapshot to repair it.
-- Inventory legacy data before rollout; an incompatible row aborts the whole migration.
BEGIN;

CREATE OR REPLACE FUNCTION jelly_theme_semver_valid(value TEXT) RETURNS BOOLEAN
LANGUAGE SQL IMMUTABLE STRICT SET search_path = pg_catalog AS $$
  SELECT char_length(value) <= 128
    AND value ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-(0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(\.(0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'
    AND substring(value FROM '^([0-9]+)')::numeric <= 9007199254740991
    AND substring(value FROM '^[0-9]+\.([0-9]+)')::numeric <= 9007199254740991
    AND substring(value FROM '^[0-9]+\.[0-9]+\.([0-9]+)')::numeric <= 9007199254740991;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ThemePackageVersion" WHERE NOT jelly_theme_semver_valid("version"))
     OR EXISTS (SELECT 1 FROM "ThemeConfiguration" WHERE NOT jelly_theme_semver_valid("themeVersion")) THEN
    RAISE EXCEPTION 'Legacy theme versions do not satisfy the theme API 1 SemVer contract.'
      USING HINT = 'Inventory invalid ThemePackageVersion.version and ThemeConfiguration.themeVersion rows before deploying. Keep the previous backend until an explicit legacy-data policy is agreed; do not rewrite published versions.';
  END IF;
END $$;

ALTER TABLE "ThemePackageVersion" DROP CONSTRAINT IF EXISTS "ThemePackageVersion_version_check";
ALTER TABLE "ThemePackageVersion" ADD CONSTRAINT "ThemePackageVersion_version_check"
  CHECK (jelly_theme_semver_valid("version"));

ALTER TABLE "ThemeConfiguration" DROP CONSTRAINT IF EXISTS "ThemeConfiguration_themeVersion_check";
ALTER TABLE "ThemeConfiguration" ADD CONSTRAINT "ThemeConfiguration_themeVersion_check"
  CHECK (jelly_theme_semver_valid("themeVersion"));

COMMIT;
