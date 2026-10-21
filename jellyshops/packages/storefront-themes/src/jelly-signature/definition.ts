import base from "../themes/default/theme.json" with { type: "json" };
import { FONT_OPTIONS } from "../fonts.js";
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

const fonts = FONT_OPTIONS.map((option) => ({ ...option }));
const color = (id: string, label: string, value: string) => ({ id: `colors.${id}`, type: "color", label, group: "Colors", default: value });
const range = (id: string, label: string, group: string, value: number, min: number, max: number, step: number) => ({ id, type: "range", label, group, default: value, min, max, step });
const select = (id: string, label: string, group: string, value: string, options: Array<[string, string]>) => ({ id, type: "select", label, group, default: value, options: options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel })) });

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
  settingsDefaults: {
    ...base.settingsDefaults,
    colors: { ...signatureTokens.colors, secondary: "#6b665f" },
    typography: { headingFont: "Fraunces", bodyFont: "Inter", headingScale: "standard", scale: "default", headingWeight: 400, bodyWeight: 400, bodySize: 16, headingSize: 56 },
    buttons: { style: "solid", radius: "square" },
    layout: { containerWidth: "wide", sectionSpacing: "standard", density: "comfortable", contentWidth: 1280, sectionGap: 96 },
    productCard: { imageRatio: "portrait", style: "minimal", alignment: "left", showBrand: false },
    branding: { logoUrl: "", bannerUrl: "", faviconUrl: "" },
  },
  settingsSchema: [
    color("background", "Page background", "#faf9f7"),
    color("surface", "Cards and panels", "#ffffff"),
    color("text", "Text", "#1c1b19"),
    color("secondary", "Soft text", "#6b665f"),
    color("primary", "Buttons", "#1c1b19"),
    color("accent", "Highlight backgrounds", "#ece7de"),
    { id: "typography.headingFont", type: "font", label: "Heading font", group: "Typography", default: "Fraunces", options: fonts },
    { id: "typography.bodyFont", type: "font", label: "Body font", group: "Typography", default: "Inter", options: fonts },
    range("typography.headingSize", "Heading size", "Typography", 56, 32, 88, 4),
    range("typography.bodySize", "Text size", "Typography", 16, 14, 20, 1),
    range("typography.headingWeight", "Heading weight", "Typography", 400, 300, 700, 100),
    select("buttons.radius", "Button corners", "Buttons", "square", [["square", "Square"], ["soft", "Slightly rounded"], ["rounded", "Rounded"], ["pill", "Pill"]]),
    range("layout.contentWidth", "Page width", "Layout", 1280, 960, 1600, 32),
    range("layout.sectionGap", "Space between sections", "Layout", 96, 32, 160, 8),
    select("productCard.imageRatio", "Product image shape", "Product cards", "portrait", [["portrait", "Portrait"], ["square", "Square"], ["landscape", "Landscape"]]),
    select("productCard.style", "Product card style", "Product cards", "minimal", [["minimal", "Minimal"], ["bordered", "Bordered"]]),
    { id: "productCard.alignment", type: "alignment", label: "Product text alignment", group: "Product cards", default: "left", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }] },
    { id: "branding.logoUrl", type: "image", label: "Store logo", group: "Branding", default: "" },
    { id: "branding.faviconUrl", type: "image", label: "Browser tab icon", group: "Branding", default: "" },
  ],
};
