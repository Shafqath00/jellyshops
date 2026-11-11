// Rewrites the settings part of Resthaven's theme.json (docs/plans/resthaven-redesign.md): the full platform settings
// schema (colour schemes, text styles, buttons, fields, cards, badges, cart, social, languages, custom CSS) with
// Resthaven's own defaults. Assets, recipes and the rest of the manifest are kept. Run after
// `npm run build:storefront-packages`:
//   node scripts/build-resthaven-settings.mjs
// Never change the theme's id or version here: published stores pin them.
import { readFileSync, writeFileSync } from "node:fs";
import { FONT_OPTIONS } from "../jellyshops/packages/storefront-themes/dist/index.js";

const root = new URL("../jellyshops/packages/storefront-themes/src/themes/", import.meta.url);
const file = new URL("jelly-resthaven/theme.json", root);
const theme = JSON.parse(readFileSync(file, "utf8"));
// Diode carries the complete current platform schema (Forma's plus the newer card and cart settings).
const platform = JSON.parse(readFileSync(new URL("jelly-diode/theme.json", root), "utf8"));
const schema = structuredClone(platform.settingsSchema);
for (const setting of schema) if (setting.type === "font") setting.options = FONT_OPTIONS.map(({ value, label }) => ({ value, label }));

const scheme = (name, background, text, button, buttonText) => ({ name, background, text, button, buttonText });
const defaults = structuredClone(platform.settingsDefaults);
Object.assign(defaults, {
  // Midnight oat: oat page, white cards, midnight ink and buttons, brass highlights (all AA on their backgrounds).
  colors: { background: "#F7F3EE", surface: "#FFFFFF", text: "#1D2333", secondary: "#5E6270", primary: "#1D2333", accent: "#7E5F35" },
  typography: { ...defaults.typography, headingFont: "Cormorant Garamond", bodyFont: "Figtree", headingWeight: 500, bodyWeight: 400, bodySize: 16, headingSize: 60 },
  textStyles: {
    ...defaults.textStyles,
    h2: { ...defaults.textStyles.h2, size: 44 },
    h3: { ...defaults.textStyles.h3, size: 28 },
    h4: { ...defaults.textStyles.h4, size: 20 },
    small: { ...defaults.textStyles.small, size: 14 },
  },
  buttons: { ...defaults.buttons, style: "solid", radius: "pill", size: "theme", textCase: "theme", borderWidth: "theme", hover: "darken" },
  layout: { ...defaults.layout, contentWidth: 1280, sectionGap: 96 },
  productCard: {
    ...defaults.productCard,
    imageRatio: "landscape", style: "minimal", alignment: "left", radius: "theme", shadow: "none", hover: "none",
    order: "photo-title-price", showTitle: "show", titleLines: "theme", showPrice: "show", savings: "percent", button: "none",
    showBrand: false, swatches: "colors", layout: "theme", showRating: true, compare: false, hoverImage: true,
  },
  badges: { ...defaults.badges, sale: "show", position: "theme", shape: "theme", background: "#A3422C", text: "#FFFFFF" },
  fields: { ...defaults.fields, radius: "soft", borderWidth: "theme", height: "theme" },
  cart: { type: "drawer", freeDeliveryFrom: 0 },
  colorSchemes: {
    ...defaults.colorSchemes,
    count: "4",
    scheme1: scheme("Oat", "#F7F3EE", "#1D2333", "#1D2333", "#F7F3EE"),
    scheme2: scheme("Sand", "#ECE4D8", "#1D2333", "#1D2333", "#F7F3EE"),
    scheme3: scheme("White", "#FFFFFF", "#1D2333", "#1D2333", "#FFFFFF"),
    scheme4: scheme("Midnight", "#1D2333", "#F7F3EE", "#F7F3EE", "#1D2333"),
  },
  branding: { ...defaults.branding, logoUrl: "" },
});

// Card style "theme" keeps Resthaven's own card (photo shape from imageRatio). Check every chosen value is one the schema offers.
const readPath = (object, id) => id.split(".").reduce((value, key) => value?.[key], object);
for (const setting of schema) {
  const value = readPath(defaults, setting.id);
  if (value === undefined) {
    const path = setting.id.split(".");
    let target = defaults;
    for (const key of path.slice(0, -1)) target = target[key] ??= {};
    target[path.at(-1)] = setting.default;
    continue;
  }
  if (setting.options?.length && typeof value === "string" && !setting.options.some((option) => option.value === value)) throw new Error(`${setting.id} has no option ${value}`);
  // Each setting's own default is Resthaven's value, as the project validator requires.
  setting.default = value;
}
delete defaults.productCard.compare;
const compare = schema.findIndex((setting) => setting.id === "productCard.compare");
if (compare >= 0) schema.splice(compare, 1);
if (!schema.some((setting) => setting.id === "productCard.hoverImage")) {
  schema.push({ id: "productCard.hoverImage", type: "checkbox", label: "Show the second photo on hover", group: "Product cards", default: true });
}

const { legacyStorefrontStyles: _legacy, sectionDefaults: _defaults, ...rest } = theme;
// Built on the platform section defaults (every section lays out before the theme styles it), not the old globals.css rules.
const next = { ...rest, settingsDefaults: defaults, settingsSchema: schema };
writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
console.log(`theme.json: ${schema.length} settings`);
