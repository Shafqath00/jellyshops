// Builds the Jelly Diode theme folder (docs/theme-briefs/jelly-diode.md): theme.json, starter.json and vector artwork.
// Same settings schema as Halo (Forma's platform settings plus the newer card and cart settings). Run after
// `npm run build:storefront-packages`:
//   node scripts/build-diode-theme.mjs
// theme.css is hand-written; `node scripts/generate-theme-assets.mjs jelly-diode` turns it into the app stylesheet.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { FONT_OPTIONS, getThemeDefinition } from "../jellyshops/packages/storefront-themes/dist/index.js";

const root = new URL("../jellyshops/packages/storefront-themes/src/themes/", import.meta.url);
const folder = new URL("jelly-diode/", root);
const assets = new URL("assets/", folder);
mkdirSync(assets, { recursive: true });
const forma = JSON.parse(readFileSync(new URL("jelly-forma/theme.json", root), "utf8"));
const signature = getThemeDefinition("jelly-signature").manifest;
const prefix = "/themes/jelly-diode/";
const asset = (name) => `${prefix}${name}`;

// ---------- artwork ----------
// Photography: generated with ChatGPT image generation (see SOURCES.md), converted to WebP into assets/.
const photos = ["hero", "headphones", "earbuds", "keyboard", "speaker", "charger", "powerbank", "desk", "switches", "inthebox"];
for (const name of photos) if (!existsSync(new URL(`${name}.webp`, assets))) throw new Error(`Missing assets/${name}.webp`);
writeFileSync(new URL("mark.svg", assets), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M8 6v20M8 16h6l12-10v20L14 16" fill="none" stroke="#0C0E11" stroke-width="2.5" stroke-linejoin="round"/><circle cx="26" cy="16" r="2.5" fill="#2D46F5"/></svg>`);
writeFileSync(new URL("preview.svg", assets), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="#F5F6F7"/><rect x="16" y="14" width="44" height="8" rx="1" fill="#0C0E11"/><rect x="16" y="34" width="288" height="98" rx="4" fill="#111317"/><path d="M16 50h288M16 66h288M16 82h288M16 98h288M16 114h288" stroke="#2a2d33" stroke-width=".5"/><circle cx="232" cy="82" r="30" fill="none" stroke="#9aa0a8" stroke-width="7"/><rect x="32" y="62" width="100" height="10" rx="1" fill="#F5F6F7"/><rect x="32" y="82" width="54" height="10" rx="1" fill="#C8F03C"/>${[16, 90, 164, 238].map((x) => `<rect x="${x}.5" y="144.5" width="65" height="43" rx="3" fill="#E9ECEF" stroke="#0C0E11" stroke-opacity=".2"/>`).join("")}</svg>`);

// ---------- theme.json ----------
const extra = ["productCard.layout", "productCard.showRating", "productCard.compare", "cart.freeDeliveryFrom"].map((id) => {
  const setting = signature.settingsSchema.find((item) => item.id === id);
  if (!setting) throw new Error(`Built-in schema has no ${id}; run npm run build:storefront-packages`);
  return setting;
});
const schema = structuredClone([...forma.settingsSchema.filter((item) => !extra.some((added) => added.id === item.id)), ...extra]);
// The font lists follow the platform's current font library.
for (const setting of schema) if (setting.type === "font") setting.options = FONT_OPTIONS.map(({ value, label }) => ({ value, label }));
const scheme = (name, background, text, button, buttonText) => ({ name, background, text, button, buttonText });
const defaults = structuredClone(forma.settingsDefaults);
Object.assign(defaults, {
  colors: { background: "#F5F6F7", surface: "#E9ECEF", text: "#0C0E11", secondary: "#525962", primary: "#2D46F5", accent: "#C8F03C" },
  typography: { ...defaults.typography, headingFont: "Space Grotesk", bodyFont: "Inter", headingWeight: 600, bodyWeight: 400, bodySize: 16, headingSize: 64 },
  buttons: { ...defaults.buttons, radius: "soft" },
  productCard: { ...defaults.productCard, layout: "technical", showRating: true, compare: true, radius: "soft", alignment: "left", showBrand: true, swatches: "colors", hover: "none" },
  cart: { type: "drawer", freeDeliveryFrom: 50 },
  colorSchemes: {
    ...defaults.colorSchemes,
    count: "4",
    scheme1: scheme("Light", "#F5F6F7", "#0C0E11", "#2D46F5", "#FFFFFF"),
    scheme2: scheme("Grey", "#E6E9EC", "#0C0E11", "#0C0E11", "#F5F6F7"),
    scheme3: scheme("Graphite", "#111317", "#F5F6F7", "#C8F03C", "#0C0E11"),
    scheme4: scheme("Electric", "#2D46F5", "#FFFFFF", "#FFFFFF", "#0C0E11"),
  },
  fields: { ...defaults.fields, radius: "soft" },
});
for (const setting of schema) {
  const path = setting.id.split(".");
  let target = defaults;
  for (const key of path.slice(0, -1)) target = target[key] ??= {};
  if (!(path.at(-1) in target)) target[path.at(-1)] = setting.default;
}
for (const [id, value] of [["buttons.radius", defaults.buttons.radius], ["productCard.radius", defaults.productCard.radius], ["fields.radius", defaults.fields.radius]]) {
  const options = schema.find((item) => item.id === id)?.options ?? [];
  if (options.length && !options.some((option) => option.value === value)) throw new Error(`${id} has no option ${value}`);
}
// Each setting's own default is Diode's value, as the project validator requires.
const readPath = (object, id) => id.split(".").reduce((value, key) => value?.[key], object);
for (const setting of schema) { const value = readPath(defaults, setting.id); if (value !== undefined) setting.default = value; }
const theme = {
  id: "jelly-diode",
  name: "Jelly Diode",
  version: "1.0.0",
  // Designed with its own complete CSS before the platform section defaults existed.
  sectionDefaults: false,
  engines: forma.engines,
  description: "A precise electronics storefront: products on seamless grey, key specifications on every card, filters in a sidebar and full specification tables.",
  assetPrefix: prefix,
  previewAsset: asset("preview.svg"),
  assets: { stylesheets: [], scripts: [], fonts: [], icons: [{ id: "mark", path: asset("mark.svg") }], assets: photos.map((id) => ({ id, path: asset(`${id}.webp`) })) },
  layout: forma.layout,
  enabled: true,
  settingsDefaults: defaults,
  settingsSchema: schema,
  sections: [],
};
writeFileSync(new URL("theme.json", folder), `${JSON.stringify(theme, null, 2)}\n`);

// ---------- starter.json ----------
let next = 0;
const id = (name) => `diode-${name}-${++next}`;
const block = (type, settings, blocks) => ({ id: id(type), type, enabled: true, settings, ...(blocks ? { blocks } : {}) });
const section = (type, settings, blocks = []) => ({ kind: "inline", section: { id: id(type), type, enabled: true, settings: { styleScheme: "scheme1", ...settings }, blocks } });
const global = (key) => ({ kind: "global", globalSectionId: key });
const chrome = (sections) => [global("announcement"), global("header"), ...sections, global("footer")];
const categories = [["Audio", "audio"], ["Keyboards", "keyboard"], ["Speakers", "speaker"], ["Charging", "charger"], ["Power banks", "power"], ["Accessories", "accessory"]];
const categoryTags = section("custom-content", { direction: "horizontal", contentAlignment: "left", gap: 16, contentWidth: "full", styleSpacing: "small" }, [
  block("heading", { text: "Browse", blockTypePreset: "small" }),
  block("group", { groupDirection: "horizontal", groupAlign: "start", groupGap: 8 }, categories.map(([label, query]) => block("button", { label, href: `/search?q=${query}`, buttonStyle: "secondary", buttonSize: "small" }))),
]);
const starter = {
  globalSections: {
    announcement: { id: "diode-announcement", type: "announcement-bar", enabled: true, settings: { styleScheme: "scheme3", text: "Free UK delivery over £50 · 2-year warranty on everything" }, blocks: [] },
    header: { id: "diode-header", type: "header", enabled: true, settings: { styleScheme: "scheme1", layout: "classic", sticky: true, showSearch: true, showAccount: true, showCart: true, showWishlist: false, showToolLabels: false }, blocks: [block("menu", { handle: "main" })] },
    footer: { id: "diode-footer", type: "footer", enabled: true, settings: { styleScheme: "scheme3", text: "Audio, keyboards and power, designed to be used every day and supported for years.", showNewsletter: false }, blocks: [
      block("link-heading", { text: "Shop" }), block("link", { label: "Audio", link: "/search?q=audio" }), block("link", { label: "Keyboards", link: "/search?q=keyboard" }), block("link", { label: "Charging", link: "/search?q=charger" }),
      block("link-heading", { text: "Support" }), block("link", { label: "Delivery and returns", link: "/pages/shipping" }), block("link", { label: "Warranty", link: "/pages/warranty" }), block("link", { label: "Contact", link: "/pages/contact" }),
    ] },
  },
  templates: {
    home: { type: "home", sections: chrome([
      section("hero", { layout: "spotlight", eyebrow: "New · Arc headphones", image: { url: asset("hero.webp"), alt: "Graphite over-ear wireless headphones on a dark background", fit: "cover", focalPoint: { x: 66, y: 50 } }, callouts: "40 h battery\nActive noise cancelling\nBluetooth 5.3\nUSB-C fast charge", contentAlignment: "left", styleScheme: "scheme3" }, [
        block("heading", { text: "Hear less noise. More music." }),
        block("text", { text: "Adaptive noise cancelling, forty hours on a charge and a fold-flat design that fits the bag you already carry." }),
        block("button", { label: "Shop headphones", href: "/shop" }),
      ]),
      categoryTags,
      section("product-grid", { heading: "Bestsellers", text: "What people are buying this month.", columns: 4, limit: 4, viewAllLabel: "Shop all", viewAllLink: "/shop" }),
      section("image-with-text", { styleScheme: "scheme2", eyebrow: "Set up", image: { url: asset("desk.webp"), alt: "A keyboard, headphones and a small speaker on a tidy wooden desk" }, imagePosition: "right" }, [
        block("heading", { text: "Built for the desk you actually have." }),
        block("text", { text: "Compact sizes, one cable for everything and colours that sit quietly together." }),
        block("button", { label: "Shop the desk set-up", href: "/search?q=desk" }),
      ]),
      section("multicolumn", { heading: "The numbers", columns: 4, contentAlignment: "left" }, [
        block("column", { heading: "2 years", text: "Warranty on every product, repairs included." }),
        block("column", { heading: "30 days", text: "To change your mind. Returns are free." }),
        block("column", { heading: "£50", text: "Free UK delivery from this order value." }),
        block("column", { heading: "5 years", text: "Of firmware updates for every device." }),
      ]),
      section("image-with-text", { styleScheme: "scheme3", eyebrow: "Detail", image: { url: asset("switches.webp"), alt: "Close-up of mechanical keyboard switches and keycaps" }, imagePosition: "left" }, [
        block("heading", { text: "Tested to 80 million presses." }),
        block("text", { text: "Every switch is factory lubed and checked, so the last keystroke feels like the first." }),
        block("button", { label: "Shop keyboards", href: "/search?q=keyboard" }),
      ]),
      section("testimonials", { heading: "From people who use them" }, [
        block("testimonial", { quote: "Noise cancelling that actually works on the train, and the battery lasts all week.", author: "Sam, commuter" }),
        block("testimonial", { quote: "The keyboard feels solid and sounds great. Set up in under a minute.", author: "Aisha, developer" }),
        block("testimonial", { quote: "One charger for my laptop, phone and earbuds. My bag is lighter.", author: "Ben, frequent traveller" }),
      ]),
      section("newsletter", { styleScheme: "scheme4", buttonLabel: "Sign up", contentAlignment: "left" }, [
        block("heading", { text: "Launches first. No spam." }),
        block("text", { text: "Be first to new products and firmware updates, about once a month." }),
      ]),
    ]) },
    product: { type: "product", sections: chrome([
      section("product-gallery", { imageFit: "contain", layout: "thumbnails", thumbnailPosition: "left", pageLayout: "details-below" }),
      section("product-information", { showVendor: true, showSku: true, showCompareAtPrice: true, showAvailability: true, showSpecifications: false, discountChip: "amount" }),
      section("product-options", { style: "buttons" }),
      section("product-purchase", { showQuantity: true, label: "Add to basket", stickyBar: true }),
      section("trust-strip", {}, [
        block("trust-point", { text: "Free UK delivery over £50", icon: "truck" }),
        block("trust-point", { text: "2-year warranty", icon: "shield" }),
        block("trust-point", { text: "30-day free returns", icon: "return" }),
      ]),
      section("product-specifications", { heading: "Technical specifications", showProductSpecifications: true, layout: "table" }, [
        block("spec-row", { label: "Warranty", value: "2 years, repairs included" }),
        block("spec-row", { label: "Firmware updates", value: "5 years from launch" }),
      ]),
      section("product-tabs", { layout: "accordion", firstOpen: true }, [
        block("info-tab", { title: "In the box", text: "The product, a USB-C to USB-C cable (1 m), a quick start guide and a recycled-paper carry pouch." }),
        block("info-tab", { title: "Compatibility", text: "Works with any phone, tablet or computer with Bluetooth 5.0 or later, or with a USB-C port. Charges from any USB-C power adapter." }),
        block("info-tab", { title: "Support and downloads", text: "Manuals, firmware and the companion app are on our support page. Our team replies within one working day." }),
      ]),
      section("product-reviews", { heading: "Reviews", allowWriting: true, perPage: 5 }),
      section("related-products", { limit: 4, heading: "Works with" }),
    ]) },
    collection: { type: "collection", sections: chrome([
      section("collection-header", { showTitle: true, showDescription: true, showImage: false, layout: "simple", showBreadcrumb: true }),
      section("collection-product-grid", { columns: 3, limit: 24, showSort: true, showFilters: true, listLayout: "sidebar" }),
    ]) },
    cart: { type: "cart", sections: chrome([section("cart-summary", {})]) },
    search: { type: "search", sections: chrome([section("search-results", { showSort: true, showFilters: true, columns: 4 })]) },
    page: { type: "page", sections: chrome([section("page-content", {})]) },
    "not-found": { type: "not-found", sections: chrome([section("not-found-message", {}, [
      block("heading", { text: "Error 404: no signal." }),
      block("text", { text: "This page does not exist. Try the shop, or search for a product." }),
      block("button", { label: "Back to the shop", href: "/shop" }),
    ])]) },
  },
  menus: [{ key: "main", name: "Main menu", handle: "main", items: [
    { id: "diode-menu-audio", label: "Audio", target: { kind: "external", url: "/search?q=audio" }, children: [
      { id: "diode-menu-headphones", label: "Headphones", target: { kind: "external", url: "/search?q=headphones" }, children: [] },
      { id: "diode-menu-earbuds", label: "Earbuds", target: { kind: "external", url: "/search?q=earbuds" }, children: [] },
      { id: "diode-menu-speakers", label: "Speakers", target: { kind: "external", url: "/search?q=speaker" }, children: [] },
    ] },
    { id: "diode-menu-keyboards", label: "Keyboards", target: { kind: "external", url: "/search?q=keyboard" }, children: [] },
    { id: "diode-menu-power", label: "Power", target: { kind: "external", url: "/search?q=power" }, children: [
      { id: "diode-menu-chargers", label: "Chargers", target: { kind: "external", url: "/search?q=charger" }, children: [] },
      { id: "diode-menu-banks", label: "Power banks", target: { kind: "external", url: "/search?q=power+bank" }, children: [] },
    ] },
    { id: "diode-menu-support", label: "Support", target: { kind: "external", url: "/pages/contact" }, children: [] },
  ] }],
};
writeFileSync(new URL("starter.json", folder), `${JSON.stringify(starter, null, 2)}\n`);
for (const file of ["package.json", ".gitignore"]) if (!existsSync(new URL(file, folder))) writeFileSync(new URL(file, folder), readFileSync(new URL(`jelly-forma/${file}`, root), "utf8").replaceAll("jelly-forma", "jelly-diode"));
console.log("Built jelly-diode: theme.json and starter.json");
