import base from "../themes/default/theme.json" with { type: "json" };
import { FONT_OPTIONS } from "../fonts.js";
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

const fonts = FONT_OPTIONS.map((option) => ({ ...option }));
const color = (id: string, label: string, value: string) => ({ id: `colors.${id}`, type: "color", label, group: "Colors", default: value });
const range = (id: string, label: string, group: string, value: number, min: number, max: number, step: number) => ({ id, type: "range", label, group, default: value, min, max, step });
const select = (id: string, label: string, group: string, value: string, options: Array<[string, string]>) => ({ id, type: "select", label, group, default: value, options: options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel })) });

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
  settingsDefaults: {
    ...base.settingsDefaults,
    colors: { ...avenueTokens.colors, secondary: "#6f7378" },
    typography: { headingFont: "Inter", bodyFont: "Inter", headingScale: "standard", scale: "default", headingWeight: 500, bodyWeight: 400, bodySize: 15, headingSize: 56 },
    buttons: { style: "solid", radius: "square" },
    layout: { containerWidth: "wide", sectionSpacing: "standard", density: "comfortable", contentWidth: 1440, sectionGap: 96 },
    productCard: { imageRatio: "portrait", style: "minimal", alignment: "left", showBrand: false, gridSpacing: "none" },
    branding: { logoUrl: "", bannerUrl: "", faviconUrl: "" },
  },
  settingsSchema: [
    color("background", "Page background", "#ffffff"),
    color("surface", "Product image background", "#f2f2f0"),
    color("text", "Text", "#2b2f33"),
    color("secondary", "Soft text", "#6f7378"),
    color("primary", "Buttons", "#2b2f33"),
    color("accent", "Panels and highlights", "#f2f2f0"),
    { id: "typography.headingFont", type: "font", label: "Heading font", group: "Typography", default: "Inter", options: fonts },
    { id: "typography.bodyFont", type: "font", label: "Body font", group: "Typography", default: "Inter", options: fonts },
    range("typography.headingSize", "Heading size", "Typography", 56, 32, 88, 4),
    range("typography.bodySize", "Text size", "Typography", 15, 14, 20, 1),
    range("typography.headingWeight", "Heading weight", "Typography", 500, 300, 700, 100),
    select("buttons.radius", "Button corners", "Buttons", "square", [["square", "Square"], ["soft", "Slightly rounded"], ["rounded", "Rounded"], ["pill", "Pill"]]),
    range("layout.contentWidth", "Page width", "Layout", 1440, 960, 1600, 32),
    range("layout.sectionGap", "Space between sections", "Layout", 96, 32, 160, 8),
    select("productCard.imageRatio", "Product image shape", "Product cards", "portrait", [["portrait", "Portrait"], ["square", "Square"], ["landscape", "Landscape"]]),
    select("productCard.gridSpacing", "Space between products", "Product cards", "none", [["none", "None (edge to edge)"], ["small", "Small"], ["large", "Large"]]),
    select("productCard.style", "Product card style", "Product cards", "minimal", [["minimal", "Minimal"], ["bordered", "Bordered"]]),
    { id: "productCard.alignment", type: "alignment", label: "Product text alignment", group: "Product cards", default: "left", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }] },
    { id: "branding.logoUrl", type: "image", label: "Store logo", group: "Branding", default: "" },
    { id: "branding.faviconUrl", type: "image", label: "Browser tab icon", group: "Branding", default: "" },
  ],
};
