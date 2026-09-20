import type { GlobalSettings, ThemeId } from "@jelly/storefront-schema";
import { resolveDesignTokens } from "./theme-registry.js";

export interface LegacyStoreThemeValues {
  accent?: string;
  accentSoft?: string;
  background?: string;
  surface?: string;
  text?: string;
  displayFont?: "serif" | "rounded";
}

const color = (value: unknown, fallback: string) => typeof value === "string" && /^(#[\da-f]{3,8}|(?:rgb|hsl)a?\([^\n]+\)|[a-z]+)$/i.test(value.trim()) ? value.trim() : fallback;
const font = (value: unknown, fallback: string) => typeof value === "string" && /^[\w ,.'-]{1,120}$/.test(value.trim()) ? value.trim() : fallback;

/** Resolves one canonical token layer for every storefront route. */
export function resolveStorefrontThemeTokens(themeId: ThemeId | string, settings: Record<string, unknown> = {}, legacy: LegacyStoreThemeValues = {}): Record<string, string> {
  const modern = settings as Record<string, any>;
  const merged = {
    ...modern,
    colors: {
      background: legacy.background,
      surface: legacy.surface,
      text: legacy.text,
      accent: legacy.accent,
      ...(modern.colors ?? {}),
    },
    typography: {
      headingFont: legacy.displayFont === "rounded" ? "Arial Rounded MT Bold" : legacy.displayFont === "serif" ? "Georgia" : undefined,
      ...(modern.typography ?? {}),
    },
  } as unknown as GlobalSettings;
  const base = resolveDesignTokens(themeId, merged);
  const background = color(base["--jelly-color-background"], "#ffffff");
  const surface = color(base["--jelly-color-surface"], background);
  const text = color(base["--jelly-color-text"], "#1a1a1a");
  const accent = color(base["--jelly-color-accent"], "#315e24");
  const accentSoft = color(modern.colors?.accentSoft ?? legacy.accentSoft, `color-mix(in srgb, ${accent} 18%, ${background})`);
  const heading = font(base["--jelly-font-display"], "Georgia");
  const body = font(base["--jelly-font-body"], "Arial");
  const semantic = {
    "--theme-background": background, "--theme-surface": surface, "--theme-text": text,
    "--theme-muted-text": base["--jelly-color-muted"] || `color-mix(in srgb, ${text} 62%, transparent)`,
    "--theme-accent": accent, "--theme-accent-soft": accentSoft,
    "--theme-border": base["--jelly-color-border"] || `color-mix(in srgb, ${text} 18%, transparent)`,
    "--theme-font-heading": heading, "--theme-font-body": body,
  };
  return { ...base, ...semantic, "--store-bg": background, "--store-surface": surface, "--store-text": text, "--store-accent": accent, "--store-accent-soft": accentSoft, "--store-display": heading };
}
