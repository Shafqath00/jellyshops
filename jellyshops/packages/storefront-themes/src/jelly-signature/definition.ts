import base from "../themes/default/theme.json" with { type: "json" };
import type { ThemeTokens } from "../types.js";

export const signatureTokens: ThemeTokens = {
  colors: { primary: "#111111", background: "#faf9f7", text: "#1a1a1a", surface: "#ffffff", accent: "#e7e2d9" },
  typography: { display: "Georgia", body: "Inter" },
  radii: { button: "2px", card: "4px" },
  spacing: { section: "80px", container: "80rem" },
  cardShadow: "0 1px 2px rgba(17, 17, 17, 0.06)",
};

const fonts = ["Arial", "Georgia", "Inter"].map((value) => ({ value, label: value }));
export const signatureManifest = {
  ...base, id: "jelly-signature", name: "Jelly Minimal", version: "1.0.0",
  description: "A modern, minimal storefront in warm white and charcoal.",
  assetPrefix: "/themes/jelly-signature/", previewAsset: "/themes/jelly-signature/preview.svg",
  assets: { stylesheets: [], scripts: [], fonts: [], icons: [], assets: [], preview: { path: "/themes/jelly-signature/preview.svg", alt: "Jelly Minimal storefront preview" } },
  settingsDefaults: {
    ...base.settingsDefaults,
    colors: { ...signatureTokens.colors, secondary: "#6b665f" },
    typography: { headingFont: "Georgia", bodyFont: "Inter", headingScale: "standard", scale: "default", headingWeight: 400, bodyWeight: 400, bodySize: 16, headingSize: 56 },
    layout: { containerWidth: "wide", sectionSpacing: "standard", density: "comfortable", contentWidth: 1280, sectionGap: 80 },
    branding: { logoUrl: "", bannerUrl: "", faviconUrl: "" },
    header: { ...base.settingsDefaults.header, showAccount: true, showWishlist: true },
  },
  settingsSchema: [
    ...base.settingsSchema,
    ...["background", "text", "surface", "secondary"].map((name) => ({ id: `colors.${name}`, type: "color", label: `${name[0].toUpperCase()}${name.slice(1)} color`, group: "Colors", default: name === "secondary" ? "#6b665f" : signatureTokens.colors[name as keyof typeof signatureTokens.colors] })),
    { id: "branding.faviconUrl", type: "image", label: "Favicon", group: "Branding", default: "" },
    ...[{ name: "headingWeight", label: "Heading weight", value: 400, min: 300, max: 800, step: 100 }, { name: "bodyWeight", label: "Body weight", value: 400, min: 300, max: 700, step: 100 }, { name: "bodySize", label: "Body size", value: 16, min: 14, max: 22, step: 1 }, { name: "headingSize", label: "Heading size", value: 56, min: 28, max: 88, step: 2 }].map((item) => ({ id: `typography.${item.name}`, type: "range", label: item.label, group: "Typography", default: item.value, min: item.min, max: item.max, step: item.step })),
    { id: "layout.contentWidth", type: "range", label: "Content width", group: "Layout", default: 1280, min: 960, max: 1600, step: 32 },
    { id: "layout.sectionGap", type: "range", label: "Section spacing", group: "Layout", default: 80, min: 24, max: 160, step: 8 },
    { id: "header.showAccount", type: "checkbox", label: "Show customer account", group: "Header", default: true },
    { id: "header.showWishlist", type: "checkbox", label: "Show wishlist", group: "Header", default: true },
  ].map((setting) => setting.type === "font" ? { ...setting, options: fonts } : setting),
};
