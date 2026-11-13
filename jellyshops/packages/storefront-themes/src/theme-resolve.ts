import { getThemeDefinition } from "./theme-registry.js";
import type { ThemeManifest } from "./theme-manifest-schema.js";
import type { ThemeAssetManifest } from "./types.js";

export const DEFAULT_THEME_ID = "minimal";

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

/** The manifest fields resolveTheme reads, with the schema's defaults (store pages do not load the schema). */
function availableManifest(id: string, version?: string | null) {
  try {
    const manifest = getThemeDefinition(id, version).manifest as Partial<ThemeManifest> & { id: string; version: string };
    if (manifest.enabled === false) return null;
    const assets = (manifest.assets ?? {}) as Partial<ThemeAssetManifest>;
    return {
      id: manifest.id, version: manifest.version, settingsDefaults: (manifest.settingsDefaults ?? {}) as Record<string, unknown>,
      assetPrefix: manifest.assetPrefix ?? `/themes/${manifest.id}/`, layout: manifest.layout ?? "standard", previewAsset: manifest.previewAsset,
      assets: { stylesheets: assets.stylesheets ?? [], scripts: assets.scripts ?? [], fonts: assets.fonts ?? [], icons: assets.icons ?? [], assets: assets.assets ?? [], ...(assets.preview ? { preview: assets.preview } : {}) } as ThemeAssetManifest,
    };
  } catch { return null; }
}

export function resolveTheme(requestedId: string | null | undefined, settings: Record<string, unknown> = {}, requestedVersion?: string | null): ResolvedTheme {
  const requested = requestedId ? availableManifest(requestedId, requestedVersion) : null;
  const fallback = availableManifest(DEFAULT_THEME_ID);
  if (!fallback) throw new Error("Default JellyShop theme manifest is unavailable");
  const selected = requested && (!requestedVersion || requested.version === requestedVersion) ? requested : fallback;
  const fallbackReason = requestedId && !requested
    ? requestedVersion && availableManifest(requestedId) ? "version-unavailable" as const : "theme-unavailable" as const
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

