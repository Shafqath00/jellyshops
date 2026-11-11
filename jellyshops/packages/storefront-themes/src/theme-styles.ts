/**
 * Designer theme styles (docs/design-contract.md §2.6): ready-made looks a theme ships, like Shopify's theme styles.
 * A style is a named set of theme settings (colours, colour schemes, fonts, corners). Applying one merges those
 * settings over the store's own and leaves pages, sections and content alone, so styles switch without losing
 * content. The first style of each theme is its default look.
 */
export interface ThemeStyle {
  id: string;
  name: string;
  description: string;
  /** Four colours for the style's swatch: background, text, button, accent. */
  swatches: [string, string, string, string];
  /** Theme settings this style sets (a part of the theme's settings, merged over the store's own). */
  settings: Record<string, unknown>;
}

interface Palette { background: string; surface: string; text: string; secondary: string; primary: string; accent: string; dark: string; darkText: string; soft: string }

/**
 * Colours plus the four base colour schemes that follow from them: page, soft, raised and dark. The dark scheme goes
 * in the slot the theme uses for it (Minimal: scheme 4, Avenue: scheme 3), because the older "Dark" background maps to
 * that slot (`legacySchemeMap`).
 */
function palette(colors: Palette, raised = "#ffffff", darkSlot: "scheme3" | "scheme4" = "scheme4", raisedButtonText = raised) {
  const lightSlot = darkSlot === "scheme4" ? "scheme3" : "scheme4";
  return {
    colors: { background: colors.background, surface: colors.surface, text: colors.text, secondary: colors.secondary, primary: colors.primary, accent: colors.accent },
    colorSchemes: {
      scheme1: { background: colors.background, text: colors.text, button: colors.primary, buttonText: colors.background },
      scheme2: { background: colors.soft, text: colors.text, button: colors.primary, buttonText: colors.background },
      [lightSlot]: { background: raised, text: colors.text, button: colors.primary, buttonText: raisedButtonText },
      [darkSlot]: { background: colors.dark, text: colors.darkText, button: colors.darkText, buttonText: colors.dark },
    },
  };
}

const minimal: ThemeStyle[] = [
  {
    id: "warm-sand", name: "Warm sand", description: "The original: warm white, charcoal and sand.",
    swatches: ["#faf9f7", "#1c1b19", "#1c1b19", "#ece7de"],
    settings: { ...palette({ background: "#faf9f7", surface: "#ffffff", text: "#1c1b19", secondary: "#6b665f", primary: "#1c1b19", accent: "#ece7de", dark: "#1c1b19", darkText: "#faf9f7", soft: "#ece7de" }), typography: { headingFont: "Fraunces", bodyFont: "Inter" }, buttons: { radius: "square" } },
  },
  {
    id: "ink-and-paper", name: "Ink and paper", description: "Crisp black and white with a classic serif.",
    swatches: ["#ffffff", "#111111", "#111111", "#f1f1ef"],
    settings: { ...palette({ background: "#ffffff", surface: "#f7f7f5", text: "#111111", secondary: "#5c5c5c", primary: "#111111", accent: "#f1f1ef", dark: "#111111", darkText: "#ffffff", soft: "#f1f1ef" }, "#f7f7f5"), typography: { headingFont: "Libre Baskerville", bodyFont: "Inter" }, buttons: { radius: "square" } },
  },
  {
    id: "sage", name: "Sage", description: "Soft greens and a rounded, friendly feel.",
    swatches: ["#f6f7f2", "#22281f", "#3f5a3a", "#dfe5d5"],
    settings: { ...palette({ background: "#f6f7f2", surface: "#ffffff", text: "#22281f", secondary: "#5a6354", primary: "#3f5a3a", accent: "#dfe5d5", dark: "#2e3a2b", darkText: "#f6f7f2", soft: "#dfe5d5" }), typography: { headingFont: "Lora", bodyFont: "DM Sans" }, buttons: { radius: "rounded" } },
  },
  {
    id: "blush", name: "Blush", description: "Warm pinks with an elegant display serif.",
    swatches: ["#fdf7f5", "#2a1f1f", "#7a3b45", "#f3e1dc"],
    settings: { ...palette({ background: "#fdf7f5", surface: "#ffffff", text: "#2a1f1f", secondary: "#6e5a58", primary: "#7a3b45", accent: "#f3e1dc", dark: "#3a2326", darkText: "#fdf7f5", soft: "#f3e1dc" }), typography: { headingFont: "Playfair Display", bodyFont: "Nunito Sans" }, buttons: { radius: "pill" } },
  },
];

const avenue: ThemeStyle[] = [
  {
    id: "gallery", name: "Gallery", description: "The original: white space and charcoal.",
    swatches: ["#ffffff", "#2b2f33", "#2b2f33", "#f2f2f0"],
    settings: { ...palette({ background: "#ffffff", surface: "#f2f2f0", text: "#2b2f33", secondary: "#666b70", primary: "#2b2f33", accent: "#f2f2f0", dark: "#2b2f33", darkText: "#ffffff", soft: "#f2f2f0" }, "#e9e4dc", "scheme3", "#ffffff"), typography: { headingFont: "Inter", bodyFont: "Inter" } },
  },
  {
    id: "midnight", name: "Midnight", description: "A dark store with light text, for evening collections.",
    swatches: ["#15171a", "#f2f2f0", "#f2f2f0", "#23272c"],
    settings: { ...palette({ background: "#15171a", surface: "#23272c", text: "#f2f2f0", secondary: "#b9bcc0", primary: "#f2f2f0", accent: "#23272c", dark: "#f2f2f0", darkText: "#15171a", soft: "#23272c" }, "#1d2024", "scheme3"), typography: { headingFont: "Space Grotesk", bodyFont: "Inter" } },
  },
  {
    id: "stone", name: "Stone", description: "Warm neutrals and a refined serif.",
    swatches: ["#f7f4ef", "#2d2924", "#2d2924", "#e9e2d6"],
    settings: { ...palette({ background: "#f7f4ef", surface: "#efe9df", text: "#2d2924", secondary: "#6b6359", primary: "#2d2924", accent: "#e9e2d6", dark: "#2d2924", darkText: "#f7f4ef", soft: "#e9e2d6" }, "#ffffff", "scheme3"), typography: { headingFont: "Cormorant Garamond", bodyFont: "Work Sans" } },
  },
  {
    id: "coastal", name: "Coastal", description: "Cool blues and clean sans-serif type.",
    swatches: ["#f6f9fb", "#14283a", "#1f4e79", "#dde8f0"],
    settings: { ...palette({ background: "#f6f9fb", surface: "#ffffff", text: "#14283a", secondary: "#4f6578", primary: "#1f4e79", accent: "#dde8f0", dark: "#14283a", darkText: "#f6f9fb", soft: "#dde8f0" }, "#ffffff", "scheme3"), typography: { headingFont: "Manrope", bodyFont: "Manrope" } },
  },
];

/** Resthaven (beds and bedroom): the dark scheme sits in scheme 4. "Heather" keeps the theme's earlier plum and linen look. */
const resthaven: ThemeStyle[] = [
  {
    id: "midnight-oat", name: "Midnight oat", description: "The original: oat, midnight ink and brass.",
    swatches: ["#F7F3EE", "#1D2333", "#1D2333", "#7E5F35"],
    settings: { ...namedSchemes(palette({ background: "#F7F3EE", surface: "#FFFFFF", text: "#1D2333", secondary: "#5E6270", primary: "#1D2333", accent: "#7E5F35", dark: "#1D2333", darkText: "#F7F3EE", soft: "#ECE4D8" }, "#FFFFFF", "scheme4", "#FFFFFF"), ["Oat", "Sand", "White", "Midnight"]), typography: { headingFont: "Cormorant Garamond", bodyFont: "Figtree" }, buttons: { radius: "pill" } },
  },
  {
    id: "heather", name: "Heather", description: "Plum and warm linen with a classic serif.",
    swatches: ["#F4ECE5", "#33302D", "#7D285D", "#E8D9CE"],
    settings: { ...namedSchemes(palette({ background: "#F4ECE5", surface: "#FFFFFF", text: "#33302D", secondary: "#665F59", primary: "#7D285D", accent: "#7D285D", dark: "#4A1838", darkText: "#F4ECE5", soft: "#E8D9CE" }, "#FFFFFF", "scheme4", "#FFFFFF"), ["Linen", "Blush", "White", "Plum"]), typography: { headingFont: "Playfair Display", bodyFont: "Figtree" }, buttons: { radius: "soft" } },
  },
  {
    id: "sage-linen", name: "Sage linen", description: "Soft greens for a calm, natural bedroom.",
    swatches: ["#F4F3EC", "#232821", "#3E5641", "#E1E5D8"],
    settings: { ...namedSchemes(palette({ background: "#F4F3EC", surface: "#FFFFFF", text: "#232821", secondary: "#596055", primary: "#3E5641", accent: "#56683F", dark: "#2B3A2E", darkText: "#F4F3EC", soft: "#E1E5D8" }, "#FFFFFF", "scheme4", "#FFFFFF"), ["Linen", "Sage", "White", "Forest"]), typography: { headingFont: "Lora", bodyFont: "DM Sans" }, buttons: { radius: "rounded" } },
  },
  {
    id: "charcoal-stone", name: "Charcoal and stone", description: "Quiet greys and black for a modern bedroom.",
    swatches: ["#F5F4F2", "#1F1F1F", "#1F1F1F", "#E6E2DC"],
    settings: { ...namedSchemes(palette({ background: "#F5F4F2", surface: "#FFFFFF", text: "#1F1F1F", secondary: "#5C5955", primary: "#1F1F1F", accent: "#6A5E53", dark: "#1F1F1F", darkText: "#F5F4F2", soft: "#E6E2DC" }, "#FFFFFF", "scheme4", "#FFFFFF"), ["Stone", "Clay", "White", "Charcoal"]), typography: { headingFont: "EB Garamond", bodyFont: "Jost" }, buttons: { radius: "square" } },
  },
];

/** Gives the four base schemes their names (shown in the editor's "Colour scheme" choices). */
function namedSchemes<T extends { colorSchemes: Record<string, Record<string, string>> }>(value: T, names: [string, string, string, string]): T {
  const colorSchemes = Object.fromEntries(Object.entries(value.colorSchemes).map(([id, scheme]) => [id, { ...scheme, name: names[Number(id.replace("scheme", "")) - 1] }]));
  return { ...value, colorSchemes };
}

const styles: Record<string, ThemeStyle[]> = { "jelly-signature": minimal, "jelly-avenue": avenue, "jelly-resthaven": resthaven };

/** The designer styles a theme ships (empty for themes without styles). */
export function listThemeStyles(themeId: string | null | undefined): ThemeStyle[] {
  return themeId ? styles[themeId] ?? [] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function merge(base: Record<string, unknown>, extra: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(extra)) result[key] = isRecord(value) && isRecord(base[key]) ? merge(base[key] as Record<string, unknown>, value) : structuredClone(value);
  return result;
}

/** The store's theme settings with a style applied: the style's settings win, everything else stays. */
export function applyThemeStyle(settings: Record<string, unknown>, style: ThemeStyle): Record<string, unknown> {
  return merge(settings, style.settings);
}
