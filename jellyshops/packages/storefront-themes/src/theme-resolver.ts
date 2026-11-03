import { customCssProblem } from "@jelly/storefront-schema";
import { MAX_THEME_CSS_LENGTH } from "./theme-style-settings.js";
import { getThemeDefinition } from "./theme-registry.js";
import type { ThemeAssetManifest } from "./types.js";

export const DEFAULT_THEME_ID = "minimal";

import { themeManifestSchema, type ThemeManifest, type ThemeSettingDefinition } from "./theme-manifest-schema.js";
export { themeManifestSchema };
export type { ThemeManifest, ThemeSettingDefinition };
export type ThemeSettingValidationIssue = { path: string; message: string };
export type ResolvedTheme = {
  id: string;
  version: string;
  settings: Record<string, unknown>;
  assetPrefix: string;
  layout: "standard" | "editorial";
  assets: ThemeAssetManifest;
  previewAsset?: string;
  fallbackReason?: "theme-unavailable" | "version-unavailable";
};

function mergeSettings(defaults: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
  const result = structuredClone(defaults);
  for (const [key, value] of Object.entries(incoming)) {
    if (value && typeof value === "object" && !Array.isArray(value) && result[key] && typeof result[key] === "object" && !Array.isArray(result[key])) {
      result[key] = mergeSettings(result[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else result[key] = structuredClone(value);
  }
  return result;
}

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

function availableManifest(id: string): ThemeManifest | null {
  try {
    const definition = getThemeDefinition(id);
    const manifest = themeManifestSchema.safeParse(definition.manifest);
    return manifest.success && manifest.data.enabled ? manifest.data : null;
  } catch { return null; }
}

export function resolveTheme(requestedId: string | null | undefined, settings: Record<string, unknown> = {}, requestedVersion?: string | null): ResolvedTheme {
  const requested = requestedId ? availableManifest(requestedId) : null;
  const fallback = availableManifest(DEFAULT_THEME_ID);
  if (!fallback) throw new Error("Default JellyShop theme manifest is unavailable");
  const selected = requested && (!requestedVersion || requested.version === requestedVersion) ? requested : fallback;
  const fallbackReason = selected === fallback && requestedId && requestedId !== fallback.id
    ? "theme-unavailable" as const
    : requested && requestedVersion && requested.version !== requestedVersion
      ? "version-unavailable" as const
      : undefined;
  const assets = selected.assets as ThemeAssetManifest;
  return { id: selected.id, version: selected.version, settings: mergeSettings(selected.settingsDefaults, settings), assetPrefix: selected.assetPrefix, layout: selected.layout, assets, previewAsset: assets.preview?.path ?? selected.previewAsset, ...(fallbackReason ? { fallbackReason } : {}) };
}

export function resolveThemePreview(themeId: string | null | undefined): { path?: string; alt: string; fallback: boolean } {
  const resolved = resolveTheme(themeId);
  return resolved.previewAsset ? { path: resolved.previewAsset, alt: `${resolved.id} theme preview`, fallback: Boolean(resolved.fallbackReason) } : { alt: "Theme preview unavailable", fallback: true };
}

export function getThemeAsset(themeId: string, assetId: string): string | undefined {
  const manifest = resolveTheme(themeId).assets;
  return [...manifest.stylesheets, ...manifest.scripts, ...manifest.icons, ...manifest.assets, ...manifest.fonts.filter((font) => font.path).map((font) => ({ id: font.id, path: font.path! }))].find((asset) => asset.id === assetId)?.path;
}

export function validateThemeManifest(value: unknown): ThemeManifest { return themeManifestSchema.parse(value); }

/** Validates only declared keys; unknown keys survive upgrades and extensions. */
export function validateThemeSettings(themeId: string, settings: Record<string, unknown>): ThemeSettingValidationIssue[] {
  const manifest = availableManifest(themeId);
  if (!manifest) return [{ path: "themeId", message: "Theme is unavailable" }];
  return manifest.settingsSchema.flatMap((definition) => {
    const value = valueAtPath(settings, definition.id);
    if (!valueMatches(definition, value)) return [{ path: definition.id, message: `Invalid value for ${definition.label}` }];
    // Theme-wide custom CSS is refused with the same plain reason the section field gives.
    const cssProblem = definition.id === "advanced.customCss" && typeof value === "string" ? customCssProblem(value, MAX_THEME_CSS_LENGTH) : null;
    return cssProblem ? [{ path: definition.id, message: `Custom CSS: ${cssProblem}` }] : [];
  });
}
