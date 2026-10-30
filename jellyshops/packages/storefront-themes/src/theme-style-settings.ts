/**
 * Shopify-style global style settings shared by the complete themes:
 * text styles (Heading 1-4, Body, Small), four colour schemes sections can
 * pick, and extra button settings. `themeStyleSettings()` returns the
 * manifest defaults and schema entries; `resolveThemeStyleTokens()` turns the
 * saved values into `--jelly-type-*`, `--jelly-scheme-*` and `--jelly-button-*`
 * variables. A token is only written when the merchant's value differs from the
 * theme's default, so untouched stores keep the theme's own responsive sizes.
 */

export const TEXT_STYLE_LEVELS = ["h1", "h2", "h3", "h4", "body", "small"] as const;
export type TextStyleLevel = typeof TEXT_STYLE_LEVELS[number];
export const COLOR_SCHEME_IDS = ["scheme1", "scheme2", "scheme3", "scheme4"] as const;
export type ColorSchemeId = typeof COLOR_SCHEME_IDS[number];

export interface ColorSchemeValues { background: string; text: string; button: string; buttonText: string }
export interface ThemeStyleDefaults {
  /** Largest (desktop) size in px of Heading 2-4 and Small text. Heading 1 and Body use typography.headingSize/bodySize. */
  sizes: { h2: number; h3: number; h4: number; small: number };
  schemes: Record<ColorSchemeId, ColorSchemeValues>;
}

const levelLabels: Record<TextStyleLevel, string> = { h1: "Heading 1", h2: "Heading 2", h3: "Heading 3", h4: "Heading 4", body: "Body", small: "Small" };
const schemeLabels: Record<ColorSchemeId, string> = { scheme1: "Scheme 1", scheme2: "Scheme 2", scheme3: "Scheme 3", scheme4: "Scheme 4" };
/** Smallest size as a share of the largest, and the screen width (px) at which the largest is reached. */
const responsive: Record<"h2" | "h3", { min: number; full: number }> = { h2: { min: 0.64, full: 1220 }, h3: { min: 0.8, full: 1270 } };
const theme = "theme";

const lineHeights: Array<[string, string]> = [[theme, "Theme default"], ["tight", "Tight"], ["normal", "Normal"], ["loose", "Loose"]];
const lineHeightValues: Record<string, string> = { tight: "1.05", normal: "1.3", loose: "1.6" };
const spacings: Array<[string, string]> = [[theme, "Theme default"], ["tight", "Tight"], ["none", "None"], ["wide", "Wide"], ["wider", "Extra wide"]];
const spacingValues: Record<string, string> = { tight: "-0.02em", none: "0em", wide: "0.04em", wider: "0.12em" };
const cases: Array<[string, string]> = [[theme, "Theme default"], ["none", "As typed"], ["uppercase", "UPPERCASE"]];
const fontsFor = (level: TextStyleLevel): Array<[string, string]> => level.startsWith("h") ? [["heading", "Heading font"], ["body", "Body font"]] : [["body", "Body font"], ["heading", "Heading font"]];

const select = (id: string, label: string, group: string, value: string, options: Array<[string, string]>, description?: string) => ({ id, type: "select", label, group, default: value, ...(description ? { description } : {}), options: options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel })) });
const range = (id: string, label: string, group: string, value: number, min: number, max: number, step: number) => ({ id, type: "range", label, group, default: value, min, max, step });
const color = (id: string, label: string, group: string, value: string) => ({ id, type: "color", label, group, default: value });

/**
 * Manifest defaults and settings for one theme. `headingSize` and `bodySize`
 * are the theme's existing typography settings, shown again as the Heading 1
 * and Body sizes so each text style has all its settings in one place.
 */
export function themeStyleSettings(defaults: ThemeStyleDefaults, sizes: { heading: [number, number, number, number]; body: [number, number, number, number] }) {
  const textStyles = Object.fromEntries(TEXT_STYLE_LEVELS.map((level) => [level, {
    ...(level === "h1" || level === "body" ? {} : { size: defaults.sizes[level] }),
    font: level.startsWith("h") ? "heading" : "body",
    lineHeight: theme,
    letterSpacing: theme,
    textCase: theme,
  }]));
  const textStyleSchema = TEXT_STYLE_LEVELS.flatMap((level) => {
    const group = `Text style: ${levelLabels[level]}`;
    const size = level === "h1"
      ? range("typography.headingSize", "Size (px)", group, ...sizes.heading)
      : level === "body"
        ? range("typography.bodySize", "Size (px)", group, ...sizes.body)
        : range(`textStyles.${level}.size`, "Size (px)", group, defaults.sizes[level], level === "small" ? 10 : 12, level === "small" ? 16 : 72, 1);
    return [
      size,
      select(`textStyles.${level}.font`, "Font", group, level.startsWith("h") ? "heading" : "body", fontsFor(level), level === "body" ? undefined : "Applies where a block uses this text style."),
      select(`textStyles.${level}.lineHeight`, "Line height", group, theme, lineHeights),
      select(`textStyles.${level}.letterSpacing`, "Letter spacing", group, theme, spacings),
      select(`textStyles.${level}.textCase`, "Case", group, theme, cases),
    ];
  });
  const colorSchemeSchema = COLOR_SCHEME_IDS.flatMap((id) => {
    const group = `Colour ${schemeLabels[id].toLowerCase()}`;
    const values = defaults.schemes[id];
    return [
      color(`colorSchemes.${id}.background`, "Background", group, values.background),
      color(`colorSchemes.${id}.text`, "Text", group, values.text),
      color(`colorSchemes.${id}.button`, "Button", group, values.button),
      color(`colorSchemes.${id}.buttonText`, "Button text", group, values.buttonText),
    ];
  });
  const buttonSchema = [
    select("buttons.size", "Button size", "Buttons", theme, [[theme, "Theme default"], ["small", "Small"], ["medium", "Medium"], ["large", "Large"]]),
    select("buttons.textCase", "Button text case", "Buttons", theme, cases),
    select("buttons.borderWidth", "Border thickness", "Buttons", theme, [[theme, "Theme default"], ["none", "None"], ["thin", "Thin"], ["thick", "Thick"]]),
    select("buttons.hover", "Hover effect", "Buttons", theme, [[theme, "Theme default"], ["darken", "Darken"], ["lift", "Lift with shadow"], ["underline", "Underline"], ["none", "None"]]),
  ];
  return {
    defaults: { textStyles, colorSchemes: structuredClone(defaults.schemes) },
    buttonDefaults: { size: theme, textCase: theme, borderWidth: theme, hover: theme },
    textStyleSchema,
    colorSchemeSchema,
    buttonSchema,
  };
}

const hex = /^#[0-9a-fA-F]{6}$/;
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function sizeToken(level: "h2" | "h3" | "h4" | "small", size: number): string {
  if (level === "h4" || level === "small") return `${size}px`;
  const { min, full } = responsive[level];
  return `clamp(${Math.round(size * min)}px, ${(size / full * 100).toFixed(2)}vw, ${size}px)`;
}

/** Reads a theme's style defaults back from its manifest defaults (undefined for themes without these settings). */
export function themeStyleDefaultsFrom(settingsDefaults: Record<string, unknown> | undefined): ThemeStyleDefaults | undefined {
  const styles = record(settingsDefaults?.textStyles);
  const schemes = record(settingsDefaults?.colorSchemes);
  if (!Object.keys(styles).length || !Object.keys(schemes).length) return undefined;
  const size = (level: string) => Number(record(styles[level]).size);
  return { sizes: { h2: size("h2"), h3: size("h3"), h4: size("h4"), small: size("small") }, schemes: schemes as unknown as ThemeStyleDefaults["schemes"] };
}

export function resolveThemeStyleTokens(settings: Record<string, unknown>, defaults: ThemeStyleDefaults | undefined): Record<string, string> {
  const tokens: Record<string, string> = {};
  const styles = record(settings.textStyles);
  for (const level of TEXT_STYLE_LEVELS) {
    const style = record(styles[level]);
    if (level !== "h1" && level !== "body" && defaults) {
      const size = style.size;
      if (typeof size === "number" && Number.isFinite(size) && size !== defaults.sizes[level]) tokens[`--jelly-type-${level}-size`] = sizeToken(level, Math.min(96, Math.max(8, Math.round(size))));
    }
    const ownFont = level.startsWith("h") ? "heading" : "body";
    if ((style.font === "heading" || style.font === "body") && style.font !== ownFont) tokens[`--jelly-type-${level}-font`] = `var(--theme-font-${style.font})`;
    if (typeof style.lineHeight === "string" && lineHeightValues[style.lineHeight]) tokens[`--jelly-type-${level}-line`] = lineHeightValues[style.lineHeight];
    if (typeof style.letterSpacing === "string" && spacingValues[style.letterSpacing]) tokens[`--jelly-type-${level}-tracking`] = spacingValues[style.letterSpacing];
    if (style.textCase === "none" || style.textCase === "uppercase") tokens[`--jelly-type-${level}-case`] = style.textCase;
  }

  const schemes = record(settings.colorSchemes);
  for (const [index, id] of COLOR_SCHEME_IDS.entries()) {
    const saved = record(schemes[id]);
    const fallback = defaults?.schemes[id];
    const pick = (key: keyof ColorSchemeValues, otherwise: string) => typeof saved[key] === "string" && hex.test(saved[key] as string) ? saved[key] as string : fallback?.[key] ?? otherwise;
    const n = index + 1;
    tokens[`--jelly-scheme-${n}-bg`] = pick("background", "var(--theme-background, #ffffff)");
    tokens[`--jelly-scheme-${n}-text`] = pick("text", "var(--theme-text, #1a1a1a)");
    tokens[`--jelly-scheme-${n}-button`] = pick("button", "var(--theme-text, #1a1a1a)");
    tokens[`--jelly-scheme-${n}-button-text`] = pick("buttonText", "var(--theme-background, #ffffff)");
  }

  const buttons = record(settings.buttons);
  const sizes: Record<string, [string, string]> = { small: ["40px", "20px"], medium: ["48px", "28px"], large: ["56px", "36px"] };
  if (typeof buttons.size === "string" && sizes[buttons.size]) [tokens["--jelly-button-height"], tokens["--jelly-button-padding"]] = sizes[buttons.size];
  if (buttons.textCase === "none" || buttons.textCase === "uppercase") tokens["--jelly-button-case"] = buttons.textCase;
  const borders: Record<string, string> = { none: "0px", thin: "1px", thick: "2px" };
  if (typeof buttons.borderWidth === "string" && borders[buttons.borderWidth]) tokens["--jelly-button-border-width"] = borders[buttons.borderWidth];
  if (buttons.hover === "lift") Object.assign(tokens, { "--jelly-button-hover-transform": "translateY(-2px)", "--jelly-button-hover-shadow": "0 6px 16px rgb(0 0 0 / 0.16)" });
  else if (buttons.hover === "underline") Object.assign(tokens, { "--jelly-button-hover-decoration": "underline", "--jelly-button-hover-mix": "100%" });
  else if (buttons.hover === "none") tokens["--jelly-button-hover-mix"] = "100%";
  else if (buttons.hover === "darken") tokens["--jelly-button-hover-mix"] = "72%";
  return tokens;
}
