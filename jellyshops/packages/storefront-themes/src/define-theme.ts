import { themeManifestSchema } from "./theme-manifest-schema.js";
import { buildThemeDefinition, type ThemeInput } from "./define-theme-core.js";
import type { ThemeDefinition } from "./types.js";

export type { ThemeInput } from "./define-theme-core.js";

/** Checks a theme manifest against the platform schema and that it names the theme's id; throws a plain message otherwise. */
export function checkThemeManifest(id: string, manifest: unknown): void {
  const parsed = themeManifestSchema.parse(manifest);
  if (parsed.id !== id) throw new Error(`Theme "${id}" has a manifest for "${parsed.id}".`);
}

/**
 * The one way a theme is declared. Checks the manifest against the platform schema (and that it
 * names the same id), so a typo fails when the theme loads rather than when a merchant opens it.
 */
export function defineTheme(input: ThemeInput): ThemeDefinition {
  const theme = buildThemeDefinition(input);
  checkThemeManifest(theme.id, theme.manifest);
  return theme;
}
