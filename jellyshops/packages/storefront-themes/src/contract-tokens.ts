/**
 * The Jelly Design Contract tokens (docs/design-contract.md, section 2).
 *
 * One namespace, `--j-*`, that every storefront theme provides and every section may read. Themes set **values**
 * (in their own CSS scope) and never invent new token names. Defaults below are written into
 * `src/app/themes/storefront-base.css` at zero specificity, between the `contract-tokens:start/end` markers, by
 * `node scripts/generate-contract-css.mjs` (a test keeps the file in step with this list).
 *
 * Values follow the merchant's theme settings through the existing token layers (`--theme-*`, `--jelly-*`), so a
 * setting changed in the editor reaches the contract without extra code.
 */

/** Fixed platform breakpoints: phones up to 767px, tablets 768–1023px, desktop from 1024px (same split as the editor's phone/tablet values). */
export const CONTRACT_BREAKPOINTS = { phoneMax: 767, tabletMax: 1023 } as const;

/** The spacing scale, in px. */
export const CONTRACT_SPACE = {
  "3xs": 2, "2xs": 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, "2xl": 40, "3xl": 48, "4xl": 64, "5xl": 80, "6xl": 96,
} as const;
export type ContractSpace = keyof typeof CONTRACT_SPACE;

/** Text presets every theme provides (size, line height, tracking, case, font role). */
export const CONTRACT_TYPE_PRESETS = ["h1", "h2", "h3", "h4", "h5", "h6", "body", "small", "caption"] as const;
export type ContractTypePreset = (typeof CONTRACT_TYPE_PRESETS)[number];

const typeSize: Record<ContractTypePreset, string> = {
  h1: "var(--jelly-type-h1-size, clamp(2.25rem, 5.2vw, var(--jelly-heading-size, 3.5rem)))",
  h2: "var(--jelly-type-h2-size, clamp(1.75rem, 3.6vw, 2.75rem))",
  h3: "var(--jelly-type-h3-size, clamp(1.375rem, 2.2vw, 1.75rem))",
  h4: "var(--jelly-type-h4-size, 1.25rem)",
  h5: "1.125rem",
  h6: "1rem",
  body: "var(--jelly-type-body-size, var(--jelly-body-size, 1rem))",
  small: "var(--jelly-type-small-size, 0.875rem)",
  caption: "0.75rem",
};
const isHeading = (preset: ContractTypePreset) => preset.startsWith("h");
const typeLevel = (preset: ContractTypePreset) => (["h1", "h2", "h3", "h4", "body", "small"] as string[]).includes(preset);

function typeTokens(): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const preset of CONTRACT_TYPE_PRESETS) {
    const own = (key: string, fallback: string) => typeLevel(preset) ? `var(--jelly-type-${preset}-${key}, ${fallback})` : fallback;
    tokens[`--j-type-${preset}-size`] = typeSize[preset];
    tokens[`--j-type-${preset}-line`] = own("line", isHeading(preset) ? "var(--j-line-tight)" : "var(--j-line-loose)");
    tokens[`--j-type-${preset}-track`] = own("tracking", isHeading(preset) ? "var(--j-track-tight)" : "var(--j-track-normal)");
    tokens[`--j-type-${preset}-case`] = own("case", "none");
    tokens[`--j-type-${preset}-font`] = own("font", isHeading(preset) ? "var(--j-font-heading)" : "var(--j-font-body)");
  }
  return tokens;
}

/** Every contract token with its platform default, in the order the CSS block lists them. */
export const CONTRACT_TOKENS: Readonly<Record<string, string>> = {
  // Spacing scale and automatic responsive spacing.
  ...Object.fromEntries(Object.entries(CONTRACT_SPACE).map(([name, px]) => [`--j-space-${name}`, `${px}px`])),
  "--j-space-scale": "1",
  // Section rhythm follows the merchant's "section spacing" setting and shrinks on tablets and phones.
  "--j-section-md": "calc(var(--jelly-spacing-section, var(--j-space-4xl)) * var(--j-space-scale))",
  "--j-section-sm": "calc(var(--j-section-md) * 0.5)",
  "--j-section-lg": "calc(var(--j-section-md) * 1.5)",
  // Page widths, margins and the content edge every section aligns to.
  "--j-page-narrow": "960px",
  "--j-page-normal": "var(--jelly-container-width, 1280px)",
  "--j-page-wide": "1440px",
  "--j-page-margin-desktop": "40px",
  "--j-page-margin-tablet": "24px",
  "--j-page-margin-sm": "16px",
  "--j-page-margin": "var(--j-page-margin-desktop)",
  "--j-page-edge": "max(var(--j-page-margin), calc((100% - var(--j-page-normal)) / 2))",
  "--j-content-narrow": "36rem",
  "--j-content-normal": "42rem",
  // Section heights.
  "--j-height-sm": "50svh",
  "--j-height-md": "65svh",
  "--j-height-lg": "80svh",
  // Corners.
  "--j-radius-xs": "2px",
  "--j-radius-sm": "4px",
  "--j-radius-md": "8px",
  "--j-radius-lg": "16px",
  "--j-radius-pill": "999px",
  "--j-radius-button": "var(--jelly-radius-button, 0px)",
  "--j-radius-card": "var(--jelly-radius-card, 4px)",
  "--j-radius-field": "var(--jelly-field-radius, var(--jelly-radius-input, var(--j-radius-button)))",
  // Font roles (at most two families in a theme).
  "--j-font-body": "var(--theme-font-body, system-ui, sans-serif)",
  "--j-font-heading": "var(--theme-font-heading, var(--j-font-body))",
  "--j-font-subheading": "var(--j-font-body)",
  "--j-font-accent": "var(--j-font-heading)",
  // Line height and tracking choices (tight / normal / loose).
  "--j-line-tight": "1.1",
  "--j-line-normal": "1.4",
  "--j-line-loose": "1.6",
  "--j-track-tight": "-0.02em",
  "--j-track-normal": "0em",
  "--j-track-loose": "0.04em",
  // Text presets.
  ...typeTokens(),
  // Colour roles: the theme colours here; inside a section with a colour scheme they follow it (CONTRACT_SCHEMES).
  "--j-color-bg": "var(--theme-background, #ffffff)",
  "--j-color-surface": "var(--theme-surface, var(--j-color-bg))",
  "--j-color-text": "var(--theme-text, #1a1a1a)",
  "--j-color-muted": "var(--theme-muted-text, color-mix(in srgb, var(--j-color-text) 75%, transparent))",
  "--j-color-border": "var(--theme-border, color-mix(in srgb, var(--j-color-text) 18%, transparent))",
  "--j-color-accent": "var(--theme-accent, var(--j-color-text))",
  "--j-color-primary": "var(--jelly-color-primary, var(--j-color-text))",
  "--j-color-on-primary": "var(--j-color-bg)",
  // Interaction.
  "--j-touch-target": "44px",
  "--j-duration-fast": "160ms",
  "--j-duration-slow": "600ms",
  "--j-ease": "cubic-bezier(.2, .7, .2, 1)",
};

/**
 * Colour schemes a section frame can carry (`data-scheme`): the theme's schemes 1-8, the older Page / Soft / Dark
 * choices (aliases of theme schemes, resolved in `resolveThemeStyleTokens`) and "custom" (the section's own colours).
 * Inside a section with a scheme every `--j-color-*` role follows that scheme.
 */
export const CONTRACT_SCHEMES = ["scheme1", "scheme2", "scheme3", "scheme4", "scheme5", "scheme6", "scheme7", "scheme8", "page", "soft", "dark", "custom"] as const;
export type ContractScheme = (typeof CONTRACT_SCHEMES)[number];

/** The colour roles of one scheme, built from its background, text, button and button text colours. */
export function contractSchemeRoles(scheme: ContractScheme): Record<string, string> {
  const id = scheme.startsWith("scheme") ? scheme.slice(6) : scheme;
  const source = scheme === "custom"
    ? { bg: "var(--section-bg)", text: "var(--section-text)", button: "var(--section-text)", buttonText: "var(--section-bg)" }
    : {
      // Fallbacks keep the roles valid where a page has no scheme tokens (they are written by resolveStorefrontThemeTokens).
      bg: `var(--jelly-scheme-${id}-bg, var(--theme-background, #ffffff))`,
      text: `var(--jelly-scheme-${id}-text, var(--theme-text, #1a1a1a))`,
      button: `var(--jelly-scheme-${id}-button, var(--theme-text, #1a1a1a))`,
      buttonText: `var(--jelly-scheme-${id}-button-text, var(--theme-background, #ffffff))`,
    };
  return {
    "--j-color-bg": source.bg,
    "--j-color-text": source.text,
    "--j-color-surface": "color-mix(in srgb, var(--j-color-text) 6%, var(--j-color-bg))",
    "--j-color-muted": "color-mix(in srgb, var(--j-color-text) 75%, var(--j-color-bg))",
    "--j-color-border": "color-mix(in srgb, var(--j-color-text) 18%, transparent)",
    "--j-color-primary": source.button,
    "--j-color-on-primary": source.buttonText,
  };
}

/** Values that change at the fixed breakpoints. */
export const CONTRACT_TABLET_TOKENS: Readonly<Record<string, string>> = { "--j-space-scale": "0.85", "--j-page-margin": "var(--j-page-margin-tablet)" };
export const CONTRACT_PHONE_TOKENS: Readonly<Record<string, string>> = { "--j-space-scale": "0.7", "--j-page-margin": "var(--j-page-margin-sm)" };

export const CONTRACT_TOKEN_NAMES: readonly string[] = Object.keys(CONTRACT_TOKENS);

export function isContractToken(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONTRACT_TOKENS, name);
}

const block = (selector: string, tokens: Readonly<Record<string, string>>, indent = "") =>
  `${indent}${selector} {\n${Object.entries(tokens).map(([name, value]) => `${indent}  ${name}: ${value};`).join("\n")}\n${indent}}`;

/** The CSS written into storefront-base.css: defaults at zero specificity, so any theme value wins. */
export function contractTokenCss(): string {
  const selector = ":where([data-jelly-theme])";
  return [
    block(selector, CONTRACT_TOKENS),
    `@media (max-width: ${CONTRACT_BREAKPOINTS.tabletMax}px) {\n${block(selector, CONTRACT_TABLET_TOKENS, "  ")}\n}`,
    `@media (max-width: ${CONTRACT_BREAKPOINTS.phoneMax}px) {\n${block(selector, CONTRACT_PHONE_TOKENS, "  ")}\n}`,
    ...CONTRACT_SCHEMES.map((scheme) => block(`${selector} [data-scheme="${scheme}"]`, contractSchemeRoles(scheme))),
  ].join("\n");
}
