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
import { fontStack } from "./fonts.js";
import { discoveredThemes } from "./themes/index.generated.js";

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
  const colors = manifest.settingsDefaults?.colors ?? {};
  const typography = manifest.settingsDefaults?.typography ?? {};
  const base = minimalTokens;
  const tokens: ThemeTokens = { ...base, colors: { ...base.colors, ...colors }, typography: { display: typography.headingFont ?? base.typography.display, body: typography.bodyFont ?? base.typography.body } };
  return definition(manifest.id, manifest.name, tokens, manifest);
}
for (const { manifest } of discoveredThemes) {
  if (!manualIds.has(manifest.id)) themes.push(folderTheme(manifest));
}

/**
 * Registers (or replaces) a declarative theme while the program runs. The CLI preview and test
 * runner use this for a theme folder that is not part of the platform build. Built-in themes
 * cannot be replaced.
 */
export function registerFolderTheme(manifest: ThemeManifestInput): ThemeDefinition {
  if (manualIds.has(manifest.id)) throw new Error(`"${manifest.id}" is a built-in theme and cannot be replaced.`);
  const next = folderTheme(manifest);
  const index = themes.findIndex((theme) => theme.id === manifest.id);
  if (index === -1) themes.push(next); else themes[index] = next;
  return next;
}

export function listThemes(): ThemeDefinition[] { return [...themes]; }

/**
 * Themes that ship a complete storefront: their own header, footer, catalogue
 * browser and styled cart, checkout, account and content pages. Routes use
 * this instead of checking for one theme id.
 */
export const COMPLETE_STOREFRONT_THEME_IDS = ["jelly-signature", "jelly-avenue"] as const;
export function isCompleteStorefrontTheme(id: string | null | undefined): boolean {
  return typeof id === "string" && (COMPLETE_STOREFRONT_THEME_IDS as readonly string[]).includes(id);
}
export function getThemeDefinition(id: ThemeId | string): ThemeDefinition {
  const theme = themes.find((candidate) => candidate.id === id);
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

export function resolveDesignTokens(themeId: ThemeId, globalSettings: GlobalSettings): ResolvedDesignTokens {
  const tokens = (() => {
    try { return getThemeDefinition(themeId).tokens; }
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
    "--jelly-color-muted": `color-mix(in srgb, ${textColor} 62%, transparent)`,
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
