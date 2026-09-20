import { listSectionDefinitions } from "@jelly/storefront-registry";
import type { GlobalSettings, ThemeId } from "@jelly/storefront-schema";
import { boldTokens } from "./bold/tokens.js";
import { artisanBoutiqueTokens } from "./artisan-boutique/tokens.js";
import { classicTokens } from "./classic/tokens.js";
import { elegantTokens } from "./elegant/tokens.js";
import { freshMarketTokens } from "./fresh-market/tokens.js";
import { minimalTokens } from "./minimal/tokens.js";
import { playfulTokens } from "./playful/tokens.js";
import type { ResolvedDesignTokens, ThemeDefinition, ThemeShellComponents, ThemeTokens } from "./types.js";
import defaultManifest from "./themes/default/theme.json" with { type: "json" };
import exampleBoutiqueManifest from "./themes/example-boutique/theme.json" with { type: "json" };
import { BoutiqueHero, type ThemeSectionProps } from "./themes/example-boutique/hero.js";
import { boutiqueShellComponents } from "./themes/example-boutique/shell.js";
import type { ComponentType } from "react";

function definition(id: ThemeId, label: string, tokens: ThemeTokens, manifest: unknown = { id, name: label, version: "1.0.0", description: label, assetPrefix: `/themes/${id}/`, layout: "standard", enabled: true, settingsDefaults: {}, assets: { stylesheets: [], scripts: [], fonts: [], icons: [], assets: [] } }, sectionOverrides: Record<string, ComponentType<ThemeSectionProps>> = {}, components?: ThemeShellComponents): ThemeDefinition {
  return { id, label, tokens, manifest, sectionOverrides, components, sectionVariants: Object.fromEntries(listSectionDefinitions().map((section) => [section.type, `${id}-${section.type}`])) };
}
const themes = [
  definition("minimal", "Default", minimalTokens, defaultManifest),
  definition("classic", "Classic", classicTokens),
  definition("bold", "Bold", boldTokens),
  definition("elegant", "Elegant", elegantTokens),
  definition("playful", "Playful", playfulTokens),
  definition("fresh-market", "Fresh Market", freshMarketTokens),
  definition("artisan-boutique", "Artisan Boutique", artisanBoutiqueTokens),
  definition("example-boutique", "Example Boutique", { ...artisanBoutiqueTokens, typography: { display: "Georgia", body: "Inter" } }, exampleBoutiqueManifest, { hero: BoutiqueHero }, boutiqueShellComponents)
];

export function listThemes(): ThemeDefinition[] { return [...themes]; }
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
    "--jelly-font-display": ty?.headingFont || tokens.typography.display,
    "--jelly-font-body": ty?.bodyFont || tokens.typography.body,
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
