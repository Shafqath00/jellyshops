/**
 * Colour settings that point at a theme colour instead of holding a fixed hex value (template plan T7 part 4), like
 * Shopify's palette colours: a section or block saved with "palette:scheme2-button" follows Scheme 2's button colour
 * whenever the merchant changes it in theme settings. No zod here: store pages read these without the schema library.
 */

/** The theme's base colours (Theme settings > Colors) a setting can point at. */
export const PALETTE_THEME_COLORS = ["background", "surface", "text", "secondary", "primary", "accent"] as const;
/** The colours of each colour scheme a setting can point at. */
export const PALETTE_SCHEME_ROLES = ["bg", "text", "button", "button-text", "secondary"] as const;

const SCHEME = "scheme(?:[1-9]|1[0-6])";
const REFERENCE = new RegExp(`^palette:(?:${PALETTE_THEME_COLORS.join("|")}|${SCHEME}-(?:${PALETTE_SCHEME_ROLES.join("|")}))$`);
const HEX = /^#[0-9a-fA-F]{6}$/;

/** A saved colour setting: a #rrggbb colour or a palette reference. For zod regexes in the registry. */
export const COLOR_SETTING_PATTERN = new RegExp(`^(?:#[0-9a-fA-F]{6}|${REFERENCE.source.slice(1, -1)})$`);

export function isPaletteColor(value: unknown): value is string {
  return typeof value === "string" && REFERENCE.test(value);
}

/** A palette reference for a theme colour or a scheme's colour, e.g. paletteReference("scheme2", "button"). */
export function paletteReference(name: string, role?: string): string {
  return role ? `palette:${name}-${role}` : `palette:${name}`;
}

/**
 * The CSS for a saved colour setting: a hex colour as it is, a palette reference as the matching theme variable
 * (with a fallback, so a scheme's optional secondary colour falls back to its text colour), anything else undefined.
 */
export function colorSettingCss(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (HEX.test(value)) return value;
  if (!REFERENCE.test(value)) return undefined;
  const name = value.slice("palette:".length);
  const scheme = /^scheme(\d+)-(.+)$/.exec(name);
  if (!scheme) return `var(--jelly-color-${name})`;
  const [, n, role] = scheme;
  return role === "secondary" ? `var(--jelly-scheme-${n}-secondary, var(--jelly-scheme-${n}-text))` : `var(--jelly-scheme-${n}-${role})`;
}
