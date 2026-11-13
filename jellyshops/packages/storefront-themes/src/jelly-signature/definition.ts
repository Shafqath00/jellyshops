import base from "../themes/default/theme.json" with { type: "json" };
import { themeStyleSettings } from "../theme-style-settings.js";
import { platformSettingsSchema } from "../platform-settings.js";
import type { ThemeTokens } from "../types.js";

/**
 * Jelly Minimal — the flagship storefront theme. The internal id stays
 * `jelly-signature` so stores created before the rename keep working.
 *
 * Design system: warm white canvas, charcoal ink, sand highlights,
 * Fraunces headings over an Inter body, an 8px spacing scale and a
 * 1280px content width. Every value below is a merchant-editable default.
 */
export const signatureTokens: ThemeTokens = {
  colors: { primary: "#1c1b19", background: "#faf9f7", text: "#1c1b19", surface: "#ffffff", accent: "#ece7de" },
  typography: { display: "Fraunces", body: "Inter" },
  radii: { button: "2px", card: "4px" },
  spacing: { section: "96px", container: "80rem" },
  cardShadow: "0 1px 2px rgba(28, 27, 25, 0.06)",
};

// Text styles, colour schemes and button extras; defaults match the theme's own look.
const styleSettings = themeStyleSettings({
  sizes: { h2: 44, h3: 28, h4: 20, small: 14 },
  schemes: {
    scheme1: { background: "#faf9f7", text: "#1c1b19", button: "#1c1b19", buttonText: "#faf9f7" },
    scheme2: { background: "#ece7de", text: "#1c1b19", button: "#1c1b19", buttonText: "#faf9f7" },
    scheme3: { background: "#ffffff", text: "#1c1b19", button: "#1c1b19", buttonText: "#ffffff" },
    scheme4: { background: "#1c1b19", text: "#faf9f7", button: "#faf9f7", buttonText: "#1c1b19" },
  },
}, { heading: [56, 32, 88, 4], body: [16, 14, 20, 1] });

const settingsDefaults = {
  ...base.settingsDefaults,
  colors: { ...signatureTokens.colors, secondary: "#6b665f" },
  typography: { headingFont: "Fraunces", bodyFont: "Inter", headingScale: "standard", scale: "default", headingWeight: 400, bodyWeight: 400, bodySize: 16, headingSize: 56 },
  buttons: { style: "solid", radius: "square", ...styleSettings.buttonDefaults },
  ...styleSettings.defaults,
  layout: { containerWidth: "wide", sectionSpacing: "standard", density: "comfortable", contentWidth: 1280, sectionGap: 96 },
  productCard: { imageRatio: "portrait", style: "minimal", alignment: "left", showBrand: false, ...styleSettings.cardDefaults },
  branding: { logoUrl: "", bannerUrl: "", faviconUrl: "" },
};

export const signatureManifest = {
  ...base,
  id: "jelly-signature",
  name: "Jelly Minimal",
  // Published stores pin this version; bumping it makes them fall back to the default theme.
  version: "1.0.0",
  description: "A modern, minimal storefront in warm white and charcoal.",
  assetPrefix: "/themes/jelly-signature/",
  previewAsset: "/themes/jelly-signature/preview.svg",
  assets: { stylesheets: [], scripts: [], fonts: [], icons: [], assets: [], preview: { path: "/themes/jelly-signature/preview.svg", alt: "Jelly Minimal storefront preview" } },
  settingsDefaults,
  settingsSchema: platformSettingsSchema(settingsDefaults, []),
};
