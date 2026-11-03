import { getThemeMigrationPath, validateThemeManifest } from "@jelly/storefront-themes";
import { ApiError } from "../../http/errors.js";

/** Enforce the part of the upgrade contract knowable before any merchant draft is loaded. */
export function assertThemeVersionTransition(previous: unknown, next: unknown): void {
  const before = validateThemeManifest(previous), after = validateThemeManifest(next);
  const major = Number(after.version.split(".")[0]) > Number(before.version.split(".")[0]);
  const removedOrChanged = (oldSettings: Array<{ id: string; type: string }>, newSettings: Array<{ id: string; type: string }>) => oldSettings.some((old) => !newSettings.some((item) => item.id === old.id && item.type === old.type));
  const breaking = removedOrChanged(before.settingsSchema, after.settingsSchema) || (before.sections ?? []).some((old) => {
    const current = after.sections?.find((section) => section.type === old.type);
    return !current || removedOrChanged(old.settings, current.settings) || old.supportedPages.some((page) => !current.supportedPages.includes(page));
  });
  if (breaking && !major) throw new ApiError(422, "BREAKING_THEME_CHANGE", "Removing a setting or section, changing its type, or dropping a supported page needs a new major theme version and a migration.");
  if (major) {
    try { getThemeMigrationPath(before.version, after.version, after.migrations ?? []); }
    catch (error) { throw new ApiError(422, "MIGRATION_REQUIRED", `Version ${after.version} needs a complete migration from ${before.version}. ${error instanceof Error ? error.message : "Check theme.json migrations."}`); }
  }
}
