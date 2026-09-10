import type { GlobalSettings, ThemeId } from "@jelly/storefront-schema";

export interface ThemeTokens {
  colors: { primary: string; background: string; text: string; surface: string; accent: string };
  typography: { display: string; body: string };
  radii: { button: string; card: string };
  spacing: { section: string; container: string };
  cardShadow: string;
}
export interface ThemeDefinition { id: ThemeId; label: string; tokens: ThemeTokens; sectionVariants: Record<string, string> }
export type ResolvedDesignTokens = Record<string, string>;
export type { GlobalSettings };
