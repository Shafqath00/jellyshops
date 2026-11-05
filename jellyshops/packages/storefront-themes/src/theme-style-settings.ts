/**
 * Shopify-style global style settings shared by the complete themes:
 * text styles (Heading 1-4, Body, Small), four colour schemes sections can
 * pick, extra button settings, form fields, product card extras and badges.
 * `themeStyleSettings()` returns the manifest defaults and schema entries;
 * `resolveThemeStyleTokens()` turns the saved values into `--jelly-type-*`,
 * `--jelly-scheme-*`, `--jelly-button-*`, `--jelly-field-*`, `--jelly-card-*`
 * and `--jelly-badge-*` variables. A token is only written when the merchant's value differs from the
 * theme's default, so untouched stores keep the theme's own responsive sizes.
 */

import { scopeCustomCss } from "@jelly/storefront-schema";

export const TEXT_STYLE_LEVELS = ["h1", "h2", "h3", "h4", "body", "small"] as const;
export type TextStyleLevel = typeof TEXT_STYLE_LEVELS[number];
/** Up to eight schemes; `colorSchemes.count` (4-8) says how many the merchant uses. */
export const COLOR_SCHEME_IDS = ["scheme1", "scheme2", "scheme3", "scheme4", "scheme5", "scheme6", "scheme7", "scheme8"] as const;
export type ColorSchemeId = typeof COLOR_SCHEME_IDS[number];
export const MIN_COLOR_SCHEMES = 4;
type BaseSchemeId = "scheme1" | "scheme2" | "scheme3" | "scheme4";
/** Schemes 5-8 start as copies of a theme scheme the merchant can then change. */
const extraSchemeSources: Record<Exclude<ColorSchemeId, BaseSchemeId>, BaseSchemeId> = { scheme5: "scheme2", scheme6: "scheme4", scheme7: "scheme3", scheme8: "scheme1" };

export interface ColorSchemeValues { background: string; text: string; button: string; buttonText: string }
export interface ThemeStyleDefaults {
  /** Largest (desktop) size in px of Heading 2-4 and Small text. Heading 1 and Body use typography.headingSize/bodySize. */
  sizes: { h2: number; h3: number; h4: number; small: number };
  schemes: Record<BaseSchemeId, ColorSchemeValues> & Partial<Record<ColorSchemeId, ColorSchemeValues>>;
}

const levelLabels: Record<TextStyleLevel, string> = { h1: "Heading 1", h2: "Heading 2", h3: "Heading 3", h4: "Heading 4", body: "Body", small: "Small" };
const schemeNumber = (id: ColorSchemeId) => COLOR_SCHEME_IDS.indexOf(id) + 1;
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
  const schemes = Object.fromEntries(COLOR_SCHEME_IDS.map((id) => [id, { ...(defaults.schemes[id] ?? defaults.schemes[extraSchemeSources[id as keyof typeof extraSchemeSources]]) }])) as Record<ColorSchemeId, ColorSchemeValues>;
  const colorSchemeSchema = [
    select("colorSchemes.count", "Number of colour schemes", "Colour schemes", String(MIN_COLOR_SCHEMES), COLOR_SCHEME_IDS.slice(MIN_COLOR_SCHEMES - 1).map((_id, index) => [String(MIN_COLOR_SCHEMES + index), String(MIN_COLOR_SCHEMES + index)] as [string, string]), "Sections using a scheme you remove keep its colours until you pick another."),
    ...COLOR_SCHEME_IDS.flatMap((id) => {
      const group = `Colour scheme ${schemeNumber(id)}`;
      const values = schemes[id];
      return [
        { id: `colorSchemes.${id}.name`, type: "text", label: "Name", group, default: "", description: "Shown when a section picks its colour scheme." },
        color(`colorSchemes.${id}.background`, "Background", group, values.background),
        color(`colorSchemes.${id}.text`, "Text", group, values.text),
        color(`colorSchemes.${id}.button`, "Button", group, values.button),
        color(`colorSchemes.${id}.buttonText`, "Button text", group, values.buttonText),
      ];
    })];
  const buttonSchema = [
    select("buttons.size", "Button size", "Buttons", theme, [[theme, "Theme default"], ["small", "Small"], ["medium", "Medium"], ["large", "Large"]]),
    select("buttons.textCase", "Button text case", "Buttons", theme, cases),
    select("buttons.borderWidth", "Border thickness", "Buttons", theme, [[theme, "Theme default"], ["none", "None"], ["thin", "Thin"], ["thick", "Thick"]]),
    select("buttons.hover", "Hover effect", "Buttons", theme, [[theme, "Theme default"], ["darken", "Darken"], ["lift", "Lift with shadow"], ["underline", "Underline"], ["none", "None"]]),
  ];
  const fieldSchema = [
    select("fields.radius", "Field corners", "Form fields", theme, [[theme, "Theme default"], ["square", "Square"], ["soft", "Slightly rounded"], ["rounded", "Rounded"], ["pill", "Pill"]]),
    select("fields.borderWidth", "Border thickness", "Form fields", theme, [[theme, "Theme default"], ["thin", "Thin"], ["thick", "Thick"]]),
    select("fields.height", "Field height", "Form fields", theme, [[theme, "Theme default"], ["small", "Small"], ["medium", "Medium"], ["large", "Large"]]),
  ];
  const cardSchema = [
    select("productCard.radius", "Card corners", "Product cards", theme, [[theme, "Theme default"], ["square", "Square"], ["soft", "Slightly rounded"], ["rounded", "Rounded"]]),
    select("productCard.shadow", "Card shadow", "Product cards", theme, [[theme, "Theme default"], ["none", "None"], ["soft", "Soft"], ["medium", "Medium"]], "A shadow also gives the card a background and inner space."),
    select("productCard.hover", "Hover effect", "Product cards", theme, [[theme, "Theme default"], ["zoom", "Zoom the photo"], ["lift", "Lift the card"], ["none", "None"]]),
  ];
  const badgeSchema = [
    select("badges.sale", "Sale badge", "Badges", "hide", [["hide", "Don't show"], ["show", "Show on discounted products"]]),
    select("badges.position", "Position", "Badges", theme, [[theme, "Theme default"], ["top-left", "Top left"], ["top-right", "Top right"]]),
    select("badges.shape", "Shape", "Badges", theme, [[theme, "Theme default"], ["square", "Square"], ["rounded", "Rounded"], ["pill", "Pill"]]),
    color("badges.background", "Background", "Badges", ""),
    color("badges.text", "Text", "Badges", ""),
  ];
  const cardContentSchema = [
    select("productCard.order", "Card layout", "Product cards", "photo-title-price", [["photo-title-price", "Photo, name, price"], ["photo-price-title", "Photo, price, name"], ["title-price-photo", "Name and price above the photo"]], "Used by every product list: product grids, related products and search."),
    select("productCard.showTitle", "Product name", "Product cards", "show", [["show", "Show"], ["hide", "Hide"]]),
    select("productCard.titleLines", "Long names", "Product cards", theme, [[theme, "Show in full"], ["1", "Cut to one line"], ["2", "Cut to two lines"]]),
    select("productCard.showPrice", "Price", "Product cards", "show", [["show", "Show"], ["hide", "Hide"]]),
    select("productCard.savings", "Savings on discounted products", "Product cards", "none", [["none", "Don't show"], ["amount", "Amount saved (Save 10.00)"], ["percent", "Percentage off (20% off)"], ["both", "Both"]], "Shown under the price when a product has a higher \"compare at\" price."),
    select("productCard.button", "Button", "Product cards", "none", [["none", "None"], ["view", "View product"], ["shop", "Shop now"]], "A button under each card that opens the product."),
  ];
  const socialSchema = SOCIAL_PLATFORMS.map(({ id, label }) => ({ id: `social.${id}`, type: "url", label, group: "Social media", default: "", ...(id === "instagram" ? { description: "Full https:// links. Shown in the footer when it has no social links of its own." } : {}) }));
  const cartSchema = [
    select("cart.type", "When a shopper opens the bag", "Cart", "page", [["page", "Go to the bag page"], ["drawer", "Slide out the bag"]], "The slide-out bag also opens after Add to cart."),
  ];
  const languageSchema = [
    { id: "languages.defaultName", type: "text", label: "Main language", group: "Languages", default: "English", description: "The language your store is written in." },
    { id: "languages.extra", type: "text", label: "Other languages", group: "Languages", default: "", description: "Language codes separated by commas, for example hi, ta, fr. Shoppers pick one in the footer; you add the text in the editor's Language menu. Text you haven't translated shows in the main language." },
  ];
  const advancedSchema = [
    { id: "advanced.customCss", type: "textarea", label: "Custom CSS", group: "Custom CSS", default: "", description: `Applies to the whole store. Up to ${MAX_THEME_CSS_LENGTH} characters; imports, fonts and non-https links aren't allowed.` },
  ];
  return {
    defaults: {
      textStyles,
      colorSchemes: { count: String(MIN_COLOR_SCHEMES), ...Object.fromEntries(COLOR_SCHEME_IDS.map((id) => [id, { name: "", ...schemes[id] }])) },
      fields: { radius: theme, borderWidth: theme, height: theme },
      badges: { sale: "hide", position: theme, shape: theme, background: "", text: "" },
      social: Object.fromEntries(SOCIAL_PLATFORMS.map(({ id }) => [id, ""])),
      advanced: { customCss: "" },
      languages: { defaultName: "English", extra: "" },
      cart: { type: "page" },
    },
    buttonDefaults: { size: theme, textCase: theme, borderWidth: theme, hover: theme },
    cardDefaults: { radius: theme, shadow: theme, hover: theme, order: "photo-title-price", showTitle: "show", titleLines: theme, showPrice: "show", savings: "none", button: "none" },
    textStyleSchema,
    colorSchemeSchema,
    buttonSchema,
    fieldSchema,
    cardSchema,
    badgeSchema,
    cardContentSchema,
    socialSchema,
    advancedSchema,
    languageSchema,
    cartSchema,
  };
}

/** Social networks merchants can link to from theme settings, in footer order. */
export const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "x", label: "X (Twitter)" },
  { id: "pinterest", label: "Pinterest" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "whatsapp", label: "WhatsApp" },
] as const;

/** A language the store offers: its code and its name in that language (e.g. hi -> हिन्दी). */
export interface StoreLanguage { code: string; name: string }

function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : code;
  } catch { return code; }
}

/** The store's other languages from theme settings (valid codes, no repeats, at most 10). */
export function storeLanguages(settings: Record<string, unknown> | undefined): StoreLanguage[] {
  const raw = record(settings?.languages).extra;
  const codes = typeof raw === "string" ? raw.split(",").map((code) => code.trim()).filter(Boolean) : [];
  const unique = [...new Set(codes.map((code) => code.replace(/^([a-z]{2,3})-([a-z]{2})$/i, (_, lang: string, region: string) => `${lang.toLowerCase()}-${region.toUpperCase()}`).replace(/^[A-Z]{2,3}$/, (code) => code.toLowerCase())))];
  return unique.filter((code) => /^[a-z]{2,3}(-[A-Z]{2})?$/.test(code)).slice(0, 10).map((code) => ({ code, name: languageName(code) }));
}

/** True when the theme opens a slide-out bag instead of going to the bag page. */
export function usesCartDrawer(settings: Record<string, unknown> | undefined): boolean {
  return record(settings?.cart).type === "drawer";
}

/** The name of the store's main language ("English" unless the merchant changed it). */
export function mainLanguageName(settings: Record<string, unknown> | undefined): string {
  const name = record(settings?.languages).defaultName;
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 40) : "English";
}

/** Theme-wide custom CSS may be longer than a section's. */
export const MAX_THEME_CSS_LENGTH = 10000;

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

/** How many colour schemes the merchant uses (4-8). */
export function colorSchemeCount(settings: Record<string, unknown> | undefined): number {
  const count = Number(record(settings?.colorSchemes).count);
  return Number.isInteger(count) ? Math.min(COLOR_SCHEME_IDS.length, Math.max(MIN_COLOR_SCHEMES, count)) : MIN_COLOR_SCHEMES;
}

/** "Scheme 2: Dark" when the merchant named it, otherwise "Scheme 2". */
export function colorSchemeLabel(settings: Record<string, unknown> | undefined, id: ColorSchemeId): string {
  const name = record(record(settings?.colorSchemes)[id]).name;
  const label = `Scheme ${schemeNumber(id)}`;
  return typeof name === "string" && name.trim() ? `${label}: ${name.trim().slice(0, 40)}` : label;
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

  const fields = record(settings.fields);
  const fieldRadii: Record<string, string> = { square: "0px", soft: "4px", rounded: "10px", pill: "999px" };
  if (typeof fields.radius === "string" && fieldRadii[fields.radius]) tokens["--jelly-field-radius"] = fieldRadii[fields.radius];
  if (fields.borderWidth === "thin" || fields.borderWidth === "thick") tokens["--jelly-field-border-width"] = borders[fields.borderWidth];
  const fieldHeights: Record<string, string> = { small: "40px", medium: "48px", large: "56px" };
  if (typeof fields.height === "string" && fieldHeights[fields.height]) tokens["--jelly-field-height"] = fieldHeights[fields.height];

  const card = record(settings.productCard);
  const cardRadii: Record<string, string> = { square: "0px", soft: "6px", rounded: "16px" };
  if (typeof card.radius === "string" && cardRadii[card.radius]) tokens["--jelly-card-radius"] = cardRadii[card.radius];
  const shadows: Record<string, string> = { soft: "0 1px 4px rgb(0 0 0 / 0.08)", medium: "0 8px 24px rgb(0 0 0 / 0.12)" };
  if (typeof card.shadow === "string" && shadows[card.shadow]) Object.assign(tokens, { "--jelly-card-shadow": shadows[card.shadow], "--jelly-card-bg": "var(--theme-surface)", "--jelly-card-padding": "12px" });
  else if (card.shadow === "none") tokens["--jelly-card-shadow"] = "none";
  if (card.hover === "zoom") tokens["--jelly-card-hover-image"] = "scale(1.06)";
  else if (card.hover === "lift") Object.assign(tokens, { "--jelly-card-hover-image": "none", "--jelly-card-hover-lift": "translateY(-4px)" });
  else if (card.hover === "none") tokens["--jelly-card-hover-image"] = "none";

  const badges = record(settings.badges);
  if (badges.sale === "show") tokens["--jelly-badge-sale-display"] = "inline-block";
  if (badges.position === "top-left") Object.assign(tokens, { "--jelly-badge-left": "12px", "--jelly-badge-right": "auto" });
  else if (badges.position === "top-right") Object.assign(tokens, { "--jelly-badge-left": "auto", "--jelly-badge-right": "12px" });
  const badgeRadii: Record<string, string> = { square: "0px", rounded: "4px", pill: "999px" };
  if (typeof badges.shape === "string" && badgeRadii[badges.shape]) tokens["--jelly-badge-radius"] = badgeRadii[badges.shape];
  if (typeof badges.background === "string" && hex.test(badges.background)) tokens["--jelly-badge-bg"] = badges.background;
  if (typeof badges.text === "string" && hex.test(badges.text)) tokens["--jelly-badge-text"] = badges.text;

  // Card content: CSS order of the photo and the name/price, hidden parts and the button.
  if (card.order === "photo-price-title") tokens["--jelly-card-price-order"] = "-1";
  else if (card.order === "title-price-photo") tokens["--jelly-card-media-order"] = "1";
  if (card.showTitle === "hide") tokens["--jelly-card-title-display"] = "none";
  else if (card.titleLines === "1" || card.titleLines === "2") Object.assign(tokens, { "--jelly-card-title-display": "-webkit-box", "--jelly-card-title-lines": card.titleLines });
  if (card.showPrice === "hide") tokens["--jelly-card-price-display"] = "none";
  if (card.savings === "amount" || card.savings === "percent" || card.savings === "both") {
    tokens["--jelly-card-saving-display"] = "flex";
    if (card.savings === "amount") tokens["--jelly-card-saving-percent-display"] = "none";
    if (card.savings === "percent") tokens["--jelly-card-saving-amount-display"] = "none";
  }
  const buttonLabel = productCardButtonLabel(settings);
  if (buttonLabel) Object.assign(tokens, { "--jelly-card-button-display": "inline-flex", "--jelly-card-button-label": JSON.stringify(buttonLabel) });
  return tokens;
}

/** The label of the product card button, or null when the theme shows none. */
export function productCardButtonLabel(settings: Record<string, unknown> | undefined): string | null {
  const button = record(settings?.productCard).button;
  return button === "view" ? "View product" : button === "shop" ? "Shop now" : null;
}

/** The social links set in theme settings (https only), in footer order. */
export function themeSocialLinks(settings: Record<string, unknown> | undefined): Array<{ id: string; label: string; href: string }> {
  const social = record(settings?.social);
  return SOCIAL_PLATFORMS.flatMap(({ id, label }) => {
    const href = typeof social[id] === "string" ? (social[id] as string).trim() : "";
    return /^https:\/\/[^\s"'<>]+$/i.test(href) ? [{ id, label: label.replace(/ \(.*\)$/, ""), href }] : [];
  });
}

/** The theme's custom CSS limited to the store (selectors start at `[data-jelly-theme]`), or null. */
export function themeCustomCss(settings: Record<string, unknown> | undefined, themeId?: string, themeVersion?: string): string | null {
  const scope = themeId && themeVersion ? `[data-jelly-theme="${themeId}"][data-jelly-theme-version="${themeVersion}"]` : "[data-jelly-theme]";
  return scopeCustomCss(record(settings?.advanced).customCss, scope, MAX_THEME_CSS_LENGTH);
}
