import { listSectionDefinitions } from "@jelly/storefront-registry";
import type { ThemeId } from "@jelly/storefront-schema";
import type { ComponentType } from "react";
import type { ThemeSectionProps } from "./themes/example-boutique/hero.js";
import defaultManifest from "./themes/default/theme.json" with { type: "json" };
import { themeManifestSchema } from "./theme-manifest-schema.js";
import type { ThemeDefinition, ThemeShellComponents, ThemeTokens } from "./types.js";

export interface ThemeInput {
  id: ThemeId;
  /** Name shown in the theme picker. */
  label: string;
  /** Fallback colours, fonts, radii and spacing. */
  tokens: ThemeTokens;
  /** The full theme.json. Without one, a standard manifest is built from the tokens. */
  manifest?: unknown;
  /** Section types this theme draws with its own component. */
  sectionOverrides?: Record<string, ComponentType<ThemeSectionProps>>;
  /** Custom header, footer, cart and page shells. */
  components?: ThemeShellComponents;
}

/**
 * The one way a theme is declared. Checks the manifest against the platform schema (and that it
 * names the same id), so a typo fails when the theme loads rather than when a merchant opens it.
 */
export function defineTheme({ id, label, tokens, manifest, sectionOverrides = {}, components }: ThemeInput): ThemeDefinition {
  const presetManifest = {
    id, name: label, version: "1.0.0", description: label, assetPrefix: `/themes/${id}/`, layout: "standard", enabled: true,
    settingsDefaults: { ...defaultManifest.settingsDefaults, colors: tokens.colors, typography: { ...defaultManifest.settingsDefaults.typography, headingFont: tokens.typography.display, bodyFont: tokens.typography.body } },
    settingsSchema: defaultManifest.settingsSchema,
    assets: { stylesheets: [], scripts: [], fonts: [], icons: [], assets: [] },
  };
  const finalManifest = manifest ?? presetManifest;
  const parsed = themeManifestSchema.parse(finalManifest);
  if (parsed.id !== id) throw new Error(`Theme "${id}" has a manifest for "${parsed.id}".`);
  return { id, label, tokens, manifest: finalManifest, sectionOverrides, components, sectionVariants: Object.fromEntries(listSectionDefinitions().map((section) => [section.type, `${id}-${section.type}`])) };
}
