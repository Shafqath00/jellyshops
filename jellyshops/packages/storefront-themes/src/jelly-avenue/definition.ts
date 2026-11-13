import base from "../themes/default/theme.json" with { type: "json" };
import { themeStyleSettings } from "../theme-style-settings.js";
import { platformSettingsSchema } from "../platform-settings.js";
import type { ThemeTokens } from "../types.js";

/**
 * Jelly Avenue — an editorial, product-first storefront for fashion and
 * lifestyle brands. Full-bleed imagery, a quiet white canvas, charcoal ink,
 * soft grey product backdrops and a single sans-serif (Inter) set tight at
 * medium weight. Every value below is a merchant-editable default.
 */
export const avenueTokens: ThemeTokens = {
  colors: { primary: "#2b2f33", background: "#ffffff", text: "#2b2f33", surface: "#f2f2f0", accent: "#f2f2f0" },
  typography: { display: "Inter", body: "Inter" },
  radii: { button: "0px", card: "0px" },
  spacing: { section: "96px", container: "90rem" },
  cardShadow: "none",
};

// Text styles, colour schemes and button extras; defaults match the theme's own look.
const styleSettings = themeStyleSettings({
  sizes: { h2: 40, h3: 24, h4: 18, small: 13 },
  schemes: {
    scheme1: { background: "#ffffff", text: "#2b2f33", button: "#2b2f33", buttonText: "#ffffff" },
    scheme2: { background: "#f2f2f0", text: "#2b2f33", button: "#2b2f33", buttonText: "#ffffff" },
    scheme3: { background: "#2b2f33", text: "#ffffff", button: "#ffffff", buttonText: "#2b2f33" },
    scheme4: { background: "#e9e4dc", text: "#2b2f33", button: "#2b2f33", buttonText: "#ffffff" },
  },
}, { heading: [56, 32, 88, 4], body: [15, 14, 20, 1] });

const settingsDefaults = {
  ...base.settingsDefaults,
  colors: { ...avenueTokens.colors, secondary: "#666b70" },
  typography: { headingFont: "Inter", bodyFont: "Inter", headingScale: "standard", scale: "default", headingWeight: 500, bodyWeight: 400, bodySize: 15, headingSize: 56 },
  buttons: { style: "solid", radius: "square", ...styleSettings.buttonDefaults },
  ...styleSettings.defaults,
  layout: { containerWidth: "wide", sectionSpacing: "standard", density: "comfortable", contentWidth: 1440, sectionGap: 96 },
  productCard: { imageRatio: "portrait", style: "minimal", alignment: "left", showBrand: false, ...styleSettings.cardDefaults, gridSpacing: "none" },
  branding: { logoUrl: "", bannerUrl: "", faviconUrl: "" },
};

export const avenueManifest = {
  ...base,
  id: "jelly-avenue",
  name: "Jelly Avenue",
  // Published stores pin this version; bumping it makes them fall back to the default theme.
  version: "1.0.0",
  description: "An editorial, image-led storefront for fashion and lifestyle brands.",
  assetPrefix: "/themes/jelly-avenue/",
  previewAsset: "/themes/jelly-avenue/preview.svg",
  assets: { stylesheets: [], scripts: [], fonts: [], icons: [], assets: [], preview: { path: "/themes/jelly-avenue/preview.svg", alt: "Jelly Avenue storefront preview" } },
  settingsDefaults,
  settingsSchema: platformSettingsSchema(settingsDefaults, [
    // Avenue's own wording for two platform colours, and its edge-to-edge product grid.
    { id: "colors.surface", type: "color", label: "Product image background", group: "Colors" },
    { id: "colors.accent", type: "color", label: "Panels and highlights", group: "Colors" },
    { id: "productCard.gridSpacing", type: "select", label: "Space between products", group: "Product cards", after: "productCard.imageRatio", options: [{ value: "none", label: "None (edge to edge)" }, { value: "small", label: "Small" }, { value: "large", label: "Large" }] },
  ]),
};
