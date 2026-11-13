import { customCssProblem } from "@jelly/storefront-schema";
import { MAX_THEME_CSS_LENGTH } from "./theme-style-settings.js";
import { getThemeDefinition } from "./theme-registry.js";
import type { ThemeAssetManifest } from "./types.js";

export { DEFAULT_THEME_ID, getThemeAsset, resolveTheme, resolveThemePreview, type ResolvedTheme } from "./theme-resolve.js";

import { themeManifestSchema, type ThemeManifest, type ThemeSettingDefinition } from "./theme-manifest-schema.js";
export { themeManifestSchema };
export type { ThemeManifest, ThemeSettingDefinition };
export type ThemeSettingValidationIssue = { path: string; message: string };

function valueAtPath(settings: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)[key] : undefined, settings);
}

function valueMatches(definition: ThemeSettingDefinition, value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (["text", "textarea", "color", "font", "image", "url", "richtext"].includes(definition.type)) return typeof value === "string" || (definition.type === "image" && typeof value === "object");
  if (definition.type === "checkbox") return typeof value === "boolean";
  if (["number", "range"].includes(definition.type)) return typeof value === "number" && Number.isFinite(value) && value >= (definition.min ?? -Infinity) && value <= (definition.max ?? Infinity);
  return typeof value === "string" && Boolean(definition.options?.some((option) => option.value === value));
}

function availableManifest(id: string, version?: string | null): ThemeManifest | null {
  try {
    const definition = getThemeDefinition(id, version);
    const manifest = themeManifestSchema.safeParse(definition.manifest);
    return manifest.success && manifest.data.enabled ? manifest.data : null;
  } catch { return null; }
}

export function validateThemeManifest(value: unknown): ThemeManifest { return themeManifestSchema.parse(value); }

/** Validates only declared keys; unknown keys survive upgrades and extensions. */
export function validateThemeSettings(themeId: string, settings: Record<string, unknown>, version?: string | null): ThemeSettingValidationIssue[] {
  const manifest = availableManifest(themeId, version);
  if (!manifest) return [{ path: "themeId", message: "Theme is unavailable" }];
  return manifest.settingsSchema.flatMap((definition) => {
    const value = valueAtPath(settings, definition.id);
    if (!valueMatches(definition, value)) return [{ path: definition.id, message: `Invalid value for ${definition.label}` }];
    // Theme-wide custom CSS is refused with the same plain reason the section field gives.
    const cssProblem = definition.id === "advanced.customCss" && typeof value === "string" ? customCssProblem(value, MAX_THEME_CSS_LENGTH) : null;
    return cssProblem ? [{ path: definition.id, message: `Custom CSS: ${cssProblem}` }] : [];
  });
}
