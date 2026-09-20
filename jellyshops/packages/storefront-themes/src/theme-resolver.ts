import { z } from "zod";
import { getThemeDefinition } from "./theme-registry.js";
import type { ThemeAssetManifest } from "./types.js";

export const DEFAULT_THEME_ID = "minimal";

const settingTypeSchema = z.enum(["text", "textarea", "number", "range", "checkbox", "select", "radio", "color", "font", "image", "url", "richtext", "alignment"]);
const localAssetPath = z.string().regex(/^\/themes\/[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9._/-]+$/).refine((path) => !path.includes("..") && !path.includes("\\") && !/^\/themes\/[^/]+\/https?:/i.test(path), "Theme assets must be local, namespaced paths");
const assetSchema = z.object({ id: z.string().regex(/^[a-z][a-zA-Z0-9_-]*$/), path: localAssetPath }).strict();
const fontAssetSchema = z.object({ id: z.string().regex(/^[a-z][a-zA-Z0-9_-]*$/), family: z.string().min(1), path: localAssetPath.optional(), weight: z.union([z.string(), z.number()]).optional(), style: z.string().optional(), format: z.string().optional() }).strict();
const assetsSchema = z.object({ stylesheets: z.array(assetSchema).default([]), scripts: z.array(assetSchema).default([]), fonts: z.array(fontAssetSchema).default([]), icons: z.array(assetSchema).default([]), assets: z.array(assetSchema).default([]), preview: z.object({ path: localAssetPath, alt: z.string().optional() }).strict().optional() }).strict();
const settingDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/),
  type: settingTypeSchema,
  label: z.string().min(1),
  description: z.string().min(1).optional(),
  group: z.string().min(1).optional(),
  default: z.unknown(),
  options: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) }).strict()).optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  step: z.number().positive().finite().optional(),
}).strict().superRefine((definition, context) => {
  if (["select", "radio", "alignment", "font"].includes(definition.type) && !definition.options?.length) {
    context.addIssue({ code: "custom", message: "Choice settings require options", path: ["options"] });
  }
  if (["number", "range"].includes(definition.type) && (definition.min === undefined || definition.max === undefined || definition.min > definition.max)) {
    context.addIssue({ code: "custom", message: "Numeric settings require valid min and max bounds" });
  }
});

const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/),
  description: z.string().min(1),
  assetPrefix: z.string().regex(/^\/themes\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/),
  previewAsset: z.string().regex(/^\/themes\/[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9._-]+$/).optional(),
  assets: assetsSchema.default({ stylesheets: [], scripts: [], fonts: [], icons: [], assets: [] }),
  layout: z.enum(["standard", "editorial"]),
  enabled: z.boolean(),
  settingsDefaults: z.record(z.string(), z.unknown()),
  settingsSchema: z.array(settingDefinitionSchema).default([]),
}).strict().superRefine((manifest, context) => {
  if (manifest.assetPrefix !== `/themes/${manifest.id}/`) {
    context.addIssue({ code: "custom", message: "Theme assetPrefix must belong to its theme id", path: ["assetPrefix"] });
  }
});

export type ThemeManifest = z.infer<typeof manifestSchema>;
export type ThemeSettingDefinition = z.infer<typeof settingDefinitionSchema>;
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
    const manifest = manifestSchema.safeParse(definition.manifest);
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

export function validateThemeManifest(value: unknown): ThemeManifest { return manifestSchema.parse(value); }

/** Validates only declared keys; unknown keys survive upgrades and extensions. */
export function validateThemeSettings(themeId: string, settings: Record<string, unknown>): ThemeSettingValidationIssue[] {
  const manifest = availableManifest(themeId);
  if (!manifest) return [{ path: "themeId", message: "Theme is unavailable" }];
  return manifest.settingsSchema.flatMap((definition) => {
    const value = valueAtPath(settings, definition.id);
    return valueMatches(definition, value) ? [] : [{ path: definition.id, message: `Invalid value for ${definition.label}` }];
  });
}
