import { listSectionDefinitions } from "@jelly/storefront-registry";
import type { GlobalSettings, ThemeId } from "@jelly/storefront-schema";
import { boldTokens } from "./bold/tokens";
import { artisanBoutiqueTokens } from "./artisan-boutique/tokens";
import { classicTokens } from "./classic/tokens";
import { elegantTokens } from "./elegant/tokens";
import { freshMarketTokens } from "./fresh-market/tokens";
import { minimalTokens } from "./minimal/tokens";
import { playfulTokens } from "./playful/tokens";
import type { ResolvedDesignTokens, ThemeDefinition, ThemeTokens } from "./types";

function definition(id: ThemeId, label: string, tokens: ThemeTokens): ThemeDefinition {
  return { id, label, tokens, sectionVariants: Object.fromEntries(listSectionDefinitions().map((section) => [section.type, `${id}-${section.type}`])) };
}

const themes = [
  definition("minimal", "Minimal", minimalTokens),
  definition("classic", "Classic", classicTokens),
  definition("bold", "Bold", boldTokens),
  definition("elegant", "Elegant", elegantTokens),
  definition("playful", "Playful", playfulTokens),
  definition("fresh-market", "Fresh Market", freshMarketTokens),
  definition("artisan-boutique", "Artisan Boutique", artisanBoutiqueTokens)
];

export function listThemes(): ThemeDefinition[] { return [...themes]; }
export function getThemeDefinition(id: ThemeId): ThemeDefinition { return themes.find((theme) => theme.id === id)!; }

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
  const tokens = getThemeDefinition(themeId).tokens;
  return {
    "--jelly-color-primary": globalSettings.colors.primary || tokens.colors.primary,
    "--jelly-color-background": globalSettings.colors.background || tokens.colors.background,
    "--jelly-color-text": globalSettings.colors.text || tokens.colors.text,
    "--jelly-color-surface": globalSettings.colors.surface || tokens.colors.surface,
    "--jelly-color-accent": globalSettings.colors.accent || tokens.colors.accent,
    "--jelly-color-secondary": tokens.colors.accent,
    "--jelly-color-muted": `color-mix(in srgb, ${globalSettings.colors.text || tokens.colors.text} 62%, transparent)`,
    "--jelly-color-border": `color-mix(in srgb, ${globalSettings.colors.text || tokens.colors.text} 18%, transparent)`,
    "--jelly-font-display": globalSettings.typography.headingFont || tokens.typography.display,
    "--jelly-font-body": globalSettings.typography.bodyFont || tokens.typography.body,
    "--jelly-radius-button": buttonRadii[globalSettings.buttons.radius] || tokens.radii.button,
    "--jelly-radius-card": tokens.radii.card,
    "--jelly-radius-input": tokens.radii.button,
    "--jelly-spacing-section": sectionSpacing[globalSettings.layout.sectionSpacing] || tokens.spacing.section,
    "--jelly-container-width": containerWidths[globalSettings.layout.containerWidth] || tokens.spacing.container,
    "--jelly-layout-gutter": globalSettings.layout.containerWidth === "narrow" ? "20px" : "32px",
    "--jelly-motion-duration": "180ms",
    "--jelly-shadow-card": tokens.cardShadow
  };
}
