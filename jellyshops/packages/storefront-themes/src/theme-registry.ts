import type { GlobalSettings, ThemeId } from "@jelly/storefront-schema";
import { boldTokens } from "./bold/tokens.js";
import { artisanBoutiqueTokens } from "./artisan-boutique/tokens.js";
import { classicTokens } from "./classic/tokens.js";
import { elegantTokens } from "./elegant/tokens.js";
import { freshMarketTokens } from "./fresh-market/tokens.js";
import { minimalTokens } from "./minimal/tokens.js";
import { playfulTokens } from "./playful/tokens.js";
import type { ResolvedDesignTokens, ThemeDefinition, ThemeManifestInput, ThemeShellComponents, ThemeTokens } from "./types.js";
import defaultManifest from "./themes/default/theme.json" with { type: "json" };
import exampleBoutiqueManifest from "./themes/example-boutique/theme.json" with { type: "json" };
import { BoutiqueHero, type ThemeSectionProps } from "./themes/example-boutique/hero.js";
import { boutiqueShellComponents } from "./themes/example-boutique/shell.js";
import type { ComponentType } from "react";
import { signatureManifest, signatureTokens } from "./jelly-signature/definition.js";
import { avenueManifest, avenueTokens } from "./jelly-avenue/definition.js";
import { defineTheme } from "./define-theme.js";
import { recipesOf, registerRecipes } from "./recipes.js";
import { fontStack } from "./fonts.js";
import { discoveredThemes } from "./themes/index.generated.js";
import { compareThemeVersions } from "@jelly/storefront-schema";
import { THEME_BASE_IDS } from "./theme-manifest-schema.js";

/** Positional shorthand for the built-in themes; every theme goes through `defineTheme`. */
function definition(id: ThemeId, label: string, tokens: ThemeTokens, manifest?: unknown, sectionOverrides: Record<string, ComponentType<ThemeSectionProps>> = {}, components?: ThemeShellComponents): ThemeDefinition {
  return defineTheme({ id, label, tokens, manifest, sectionOverrides, components });
}
const themes = [
  definition("jelly-signature", "Jelly Minimal", signatureTokens, signatureManifest),
  definition("jelly-avenue", "Jelly Avenue", avenueTokens, avenueManifest),
  definition("minimal", "Default", minimalTokens, defaultManifest),
  definition("classic", "Classic", classicTokens),
  definition("bold", "Bold", boldTokens),
  definition("elegant", "Elegant", elegantTokens),
  definition("playful", "Playful", playfulTokens),
  definition("fresh-market", "Fresh Market", freshMarketTokens),
  definition("artisan-boutique", "Artisan Boutique", artisanBoutiqueTokens),
  definition("example-boutique", "Example Boutique", { ...artisanBoutiqueTokens, typography: { display: "Georgia", body: "Inter" } }, exampleBoutiqueManifest, { hero: BoutiqueHero }, boutiqueShellComponents)
];

const manualIds = new Set(themes.map((theme) => theme.id));
export function isManuallyRegistered(id: string): boolean { return manualIds.has(id); }

/** True for every theme the platform itself ships (built in or found in src/themes/), which an upload may not take over. */
export function isPlatformThemeId(id: string): boolean { return manualIds.has(id) || discoveredThemes.some((entry) => entry.manifest.id === id); }

/**
 * Themes found in src/themes/<folder>/theme.json become declarative themes: colours and fonts come
 * from the manifest defaults, everything else is the shared storefront. A folder whose id is
 * already registered above is skipped (those need code, or predate discovery).
 */
function folderTheme(manifest: ThemeManifestInput): ThemeDefinition {
  if (typeof manifest.extends === "string" && (THEME_BASE_IDS as readonly string[]).includes(manifest.extends)) return extendedTheme(manifest, manifest.extends);
  const colors = manifest.settingsDefaults?.colors ?? {};
  const typography = manifest.settingsDefaults?.typography ?? {};
  const base = minimalTokens;
  const tokens: ThemeTokens = { ...base, colors: { ...base.colors, ...colors }, typography: { display: typography.headingFont ?? base.typography.display, body: typography.bodyFont ?? base.typography.body } };
  return definition(manifest.id, manifest.name, tokens, manifest);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function mergeSettings(base: Record<string, unknown>, own: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(own)) result[key] = isRecord(value) && isRecord(base[key]) ? mergeSettings(base[key] as Record<string, unknown>, value) : value;
  return result;
}
const settingAt = (settings: Record<string, unknown>, path: string) => path.split(".").reduce<unknown>((value, key) => isRecord(value) ? value[key] : undefined, settings);

/**
 * A theme that builds on a built-in design (`extends`): the base design's manifest, settings, section designs and
 * shell, with the theme's own id, name, version, assets and settings defaults on top. The settings schema shows the
 * theme's own defaults. The storefront draws it with the base design's stylesheets (`themeStyleId`).
 */
function extendedTheme(manifest: ThemeManifestInput, baseId: string): ThemeDefinition {
  const base = getThemeDefinition(baseId);
  const baseManifest = base.manifest as ThemeManifestInput & { settingsDefaults: Record<string, unknown>; settingsSchema?: Array<{ id: string; default?: unknown }> };
  const settingsDefaults = mergeSettings(baseManifest.settingsDefaults, (manifest.settingsDefaults ?? {}) as Record<string, unknown>);
  const ownSchema = Array.isArray(manifest.settingsSchema) && manifest.settingsSchema.length ? manifest.settingsSchema as Array<{ id: string; default?: unknown }> : undefined;
  const settingsSchema = (ownSchema ?? baseManifest.settingsSchema ?? []).map((setting) => {
    const value = settingAt(settingsDefaults, setting.id);
    return value === undefined ? setting : { ...setting, default: value };
  });
  const merged = { ...baseManifest, ...manifest, settingsDefaults, settingsSchema, sections: manifest.sections };
  if (!manifest.sections) delete (merged as { sections?: unknown }).sections;
  const colors = (settingsDefaults.colors ?? {}) as Record<string, string>;
  const typography = (settingsDefaults.typography ?? {}) as Record<string, string>;
  const tokens: ThemeTokens = { ...base.tokens, colors: { ...base.tokens.colors, ...colors }, typography: { display: typography.headingFont ?? base.tokens.typography.display, body: typography.bodyFont ?? base.tokens.typography.body } };
  return defineTheme({ id: manifest.id as ThemeId, label: manifest.name, tokens, manifest: merged, sectionOverrides: base.sectionOverrides, components: base.components });
}

/**
 * The design whose stylesheets draw a theme: the built-in design it extends, otherwise the theme itself. The
 * storefront root's `data-jelly-theme` carries this id, so a theme built on Jelly Minimal is styled by Minimal's CSS
 * while its own settings (colours, fonts, schemes) come from its manifest.
 */
export function themeStyleId(id: string | null | undefined, version?: string | null): string {
  if (!id) return "";
  try {
    const base = (getThemeDefinition(id, version).manifest as { extends?: unknown }).extends;
    return typeof base === "string" && (THEME_BASE_IDS as readonly string[]).includes(base) ? base : id;
  } catch { return id; }
}

/**
 * True when the old default storefront rules in src/app/globals.css apply to this theme (the manifest's
 * `legacyStorefrontStyles`). Built-in themes registered here default to true, folder and uploaded themes to false,
 * and a theme that `extends` a base design follows the base. The storefront roots carry the answer as
 * `data-jelly-legacy-styles="off"` (see `legacyStylesAttribute`).
 */
export function usesLegacyStorefrontStyles(id: string | null | undefined, version?: string | null): boolean {
  if (!id) return true;
  let manifest: { extends?: unknown; legacyStorefrontStyles?: unknown };
  try { manifest = getThemeDefinition(id, version).manifest as typeof manifest; } catch { return true; }
  if (typeof manifest.legacyStorefrontStyles === "boolean") return manifest.legacyStorefrontStyles;
  if (typeof manifest.extends === "string" && manifest.extends !== id && (THEME_BASE_IDS as readonly string[]).includes(manifest.extends)) return usesLegacyStorefrontStyles(manifest.extends);
  return manualIds.has(id);
}

/**
 * True when the platform's section defaults (src/app/themes/section-defaults.css) apply: every theme without the old
 * rules, unless its manifest sets `sectionDefaults: false` because it was designed with its own complete CSS before
 * the defaults existed (Forma, Halo, Diode). A theme that `extends` a base design follows the base.
 */
export function usesSectionDefaults(id: string | null | undefined, version?: string | null): boolean {
  if (usesLegacyStorefrontStyles(id, version)) return false;
  let manifest: { extends?: unknown; sectionDefaults?: unknown };
  try { manifest = getThemeDefinition(id as string, version).manifest as typeof manifest; } catch { return true; }
  if (typeof manifest.sectionDefaults === "boolean") return manifest.sectionDefaults;
  if (typeof manifest.extends === "string" && manifest.extends !== id && (THEME_BASE_IDS as readonly string[]).includes(manifest.extends)) return usesSectionDefaults(manifest.extends);
  return true;
}

/**
 * The `data-jelly-legacy-styles` value for a storefront root: none for a theme that uses the old rules, "off" for one
 * that uses the section defaults instead, and "own" for one that brings all of its own CSS (neither applies).
 */
export function legacyStylesAttribute(id: string | null | undefined, version?: string | null): "off" | "own" | undefined {
  if (usesLegacyStorefrontStyles(id, version)) return undefined;
  return usesSectionDefaults(id, version) ? "off" : "own";
}

for (const { manifest } of discoveredThemes) {
  if (manualIds.has(manifest.id)) continue;
  themes.push(folderTheme(manifest));
  registerRecipes(manifest.id, recipesOf(manifest), manifest.version);
}

/**
 * Registers (or replaces) a declarative theme while the program runs. The CLI preview and test
 * runner use this for a theme folder that is not part of the platform build. Built-in themes
 * cannot be replaced.
 */
export function registerFolderTheme(manifest: ThemeManifestInput): ThemeDefinition {
  if (manualIds.has(manifest.id)) throw new Error(`"${manifest.id}" is a built-in theme and cannot be replaced.`);
  const next = folderTheme(manifest);
  registerRecipes(manifest.id, recipesOf(manifest), manifest.version);
  const index = themes.findIndex((theme) => theme.id === manifest.id && versionOf(theme) === manifest.version);
  if (index === -1) themes.push(next); else themes[index] = next;
  return next;
}

const versionOf = (theme: ThemeDefinition) => (theme.manifest as ThemeManifestInput).version;
export function listThemes(): ThemeDefinition[] {
  const newest = new Map<string, ThemeDefinition>();
  for (const theme of themes) if (!newest.has(theme.id) || compareThemeVersions(versionOf(theme), versionOf(newest.get(theme.id)!)) >= 0) newest.set(theme.id, theme);
  return [...newest.values()];
}

/**
 * Themes that ship a complete storefront: their own header, footer, catalogue
 * browser and styled cart, checkout, account and content pages. Routes use
 * this instead of checking for one theme id.
 */
export const COMPLETE_STOREFRONT_THEME_IDS = ["jelly-signature", "jelly-avenue"] as const;
/**
 * Uploaded and discovered themes whose starter brings its own header and footer. Like the built-in
 * complete themes they draw the store chrome themselves, so the shared frame must not add another.
 */
const completeFolderThemes = new Set<string>();
export function setFolderThemeComplete(id: string, complete: boolean, version?: string): void {
  const key = `${id}@${version ?? versionOf(getThemeDefinition(id))}`;
  if (complete) completeFolderThemes.add(key); else completeFolderThemes.delete(key);
}
export function isCompleteStorefrontTheme(id: string | null | undefined, version?: string | null): boolean {
  if (!id) return false;
  try { return (COMPLETE_STOREFRONT_THEME_IDS as readonly string[]).includes(id) || completeFolderThemes.has(`${id}@${version ?? versionOf(getThemeDefinition(id))}`); } catch { return false; }
}
export function getThemeDefinition(id: ThemeId | string, version?: string | null): ThemeDefinition {
  const theme = version ? themes.find((candidate) => candidate.id === id && versionOf(candidate) === version) : listThemes().find((candidate) => candidate.id === id);
  if (!theme) throw new Error(`Unknown JellyShop theme: ${id}`);
  return theme;
}

export function applyThemePreset(
  current: GlobalSettings,
  themeId: ThemeId,
  mode: "preserve" | "reset",
): GlobalSettings {
  const next = structuredClone(current);
  if (mode === "preserve") return next;
  const tokens = getThemeDefinition(themeId).tokens;
  next.colors = { ...next.colors, ...tokens.colors };
  next.typography.headingFont = tokens.typography.display;
  next.typography.bodyFont = tokens.typography.body;
  return next;
}

const buttonRadii = { square: "0px", soft: "8px", rounded: "16px", pill: "999px" } as const;
const sectionSpacing = { compact: "48px", standard: "72px", spacious: "104px" } as const;
const containerWidths = { narrow: "56rem", standard: "72rem", wide: "84rem" } as const;

export function resolveDesignTokens(themeId: ThemeId, globalSettings: GlobalSettings, version?: string | null): ResolvedDesignTokens {
  const tokens = (() => {
    try { return getThemeDefinition(themeId, version).tokens; }
    catch { return getThemeDefinition("minimal").tokens; }
  })();
  const c = globalSettings?.colors;
  const ty = globalSettings?.typography;
  const bt = globalSettings?.buttons;
  const la = globalSettings?.layout;
  const density = (la as typeof la & { density?: string } | undefined)?.density;
  const typeScale = (ty as typeof ty & { scale?: string } | undefined)?.scale;
  const textColor = c?.text || tokens.colors.text;
  return {
    "--jelly-color-primary": c?.primary || tokens.colors.primary,
    "--jelly-color-background": c?.background || tokens.colors.background,
    "--jelly-color-text": textColor,
    "--jelly-color-surface": c?.surface || tokens.colors.surface,
    "--jelly-color-accent": c?.accent || tokens.colors.accent,
    "--jelly-color-secondary": tokens.colors.accent,
    // 75% keeps muted text at WCAG AA (4.5:1) on light backgrounds; 62% gave about 3.9:1 on white.
    "--jelly-color-muted": `color-mix(in srgb, ${textColor} 75%, transparent)`,
    "--jelly-color-border": `color-mix(in srgb, ${textColor} 18%, transparent)`,
    "--jelly-font-display": fontStack(ty?.headingFont || tokens.typography.display, "Georgia"),
    "--jelly-font-body": fontStack(ty?.bodyFont || tokens.typography.body, "Arial"),
    "--jelly-radius-button": (bt?.radius ? buttonRadii[bt.radius] : undefined) || tokens.radii.button,
    "--jelly-radius-card": tokens.radii.card,
    "--jelly-radius-input": tokens.radii.button,
    "--jelly-spacing-section": density === "compact" ? "48px" : density === "airy" ? "104px" : (la?.sectionSpacing ? sectionSpacing[la.sectionSpacing] : undefined) || tokens.spacing.section,
    "--jelly-container-width": (la?.containerWidth ? containerWidths[la.containerWidth] : undefined) || tokens.spacing.container,
    "--jelly-layout-gutter": la?.containerWidth === "narrow" ? "20px" : "32px",
    "--jelly-motion-duration": "180ms",
    "--jelly-shadow-card": tokens.cardShadow,
    "--theme-type-scale": typeScale === "compact" ? "0.94" : typeScale === "large" ? "1.08" : "1",
    "--theme-density": density === "compact" ? "0.8" : density === "airy" ? "1.2" : "1"
  };
}
