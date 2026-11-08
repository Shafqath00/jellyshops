// Builds the Jelly Halo theme folder (docs/theme-briefs/jelly-halo.md): theme.json, starter.json and placeholder
// artwork. The settings schema is Forma's (same platform settings) plus the settings added since, copied from the
// built-in Jelly Minimal definition so Halo can use them. Run after `npm run build:storefront-packages`:
//   node scripts/build-halo-theme.mjs
// theme.css is hand-written; scripts/generate-theme-css.mjs jelly-halo turns it into the app stylesheet.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getThemeDefinition } from "../jellyshops/packages/storefront-themes/dist/index.js";

const root = new URL("../jellyshops/packages/storefront-themes/src/themes/", import.meta.url);
const folder = new URL("jelly-halo/", root);
const assets = new URL("assets/", folder);
mkdirSync(assets, { recursive: true });
const forma = JSON.parse(readFileSync(new URL("jelly-forma/theme.json", root), "utf8"));
const signature = getThemeDefinition("jelly-signature").manifest;
const prefix = "/themes/jelly-halo/";
const asset = (name) => `${prefix}${name}`;

// ---------- artwork ----------
// Photography: generated with ChatGPT image generation (see SOURCES.md), converted to WebP into assets/.
const photos = ["hero", "texture", "ingredient", "routine", "serum", "cream", "cleanser", "spf", "oil", "balm"];
for (const name of photos) if (!existsSync(new URL(`${name}.webp`, assets))) throw new Error(`Missing assets/${name}.webp`);
writeFileSync(new URL("mark.svg", assets), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="none" stroke="#1F1D1B" stroke-width="2.5"/><circle cx="16" cy="16" r="4" fill="#D9C8BC"/></svg>`);
writeFileSync(new URL("preview.svg", assets), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="#FBFAF7"/><rect x="16" y="14" width="60" height="8" rx="4" fill="#1F1D1B"/><rect x="16" y="36" width="288" height="96" rx="14" fill="#F3E7E0"/><rect x="190" y="52" width="40" height="70" rx="12" fill="#C88A5A"/><rect x="32" y="62" width="110" height="12" rx="6" fill="#1F1D1B"/><rect x="32" y="84" width="80" height="8" rx="4" fill="#5E5852"/>${[16, 90, 164, 238].map((x) => `<rect x="${x}" y="144" width="66" height="44" rx="10" fill="#F2EEE8"/>`).join("")}</svg>`);

// ---------- theme.json ----------
const extra = ["productCard.layout", "productCard.showRating", "cart.freeDeliveryFrom"].map((id) => {
  const setting = signature.settingsSchema.find((item) => item.id === id);
  if (!setting) throw new Error(`Built-in schema has no ${id}; run npm run build:storefront-packages`);
  return setting;
});
const schema = structuredClone([...forma.settingsSchema.filter((item) => !extra.some((added) => added.id === item.id)), ...extra]);
const scheme = (name, background, text, button, buttonText) => ({ name, background, text, button, buttonText });
const defaults = structuredClone(forma.settingsDefaults);
Object.assign(defaults, {
  colors: { background: "#FBFAF7", surface: "#F2EEE8", text: "#1F1D1B", secondary: "#5E5852", primary: "#1F1D1B", accent: "#D9C8BC" },
  typography: { ...defaults.typography, headingFont: "Plus Jakarta Sans", bodyFont: "Plus Jakarta Sans", headingWeight: 600, bodyWeight: 400, bodySize: 16, headingSize: 64 },
  buttons: { ...defaults.buttons, radius: "pill" },
  productCard: { ...defaults.productCard, layout: "tinted", showRating: true, radius: "rounded", alignment: "left", showBrand: false, swatches: "none" },
  cart: { type: "drawer", freeDeliveryFrom: 40 },
  colorSchemes: {
    ...defaults.colorSchemes,
    count: "4",
    scheme1: scheme("Milk", "#FBFAF7", "#1F1D1B", "#1F1D1B", "#FBFAF7"),
    scheme2: scheme("Blush", "#F3E7E0", "#1F1D1B", "#1F1D1B", "#FBFAF7"),
    scheme3: scheme("Sage", "#E3EBE2", "#1F1D1B", "#1F1D1B", "#FBFAF7"),
    scheme4: scheme("Ink", "#1F1D1B", "#FBFAF7", "#FBFAF7", "#1F1D1B"),
  },
  fields: { ...defaults.fields, radius: "rounded" },
});
for (const setting of schema) {
  const path = setting.id.split(".");
  let target = defaults;
  for (const key of path.slice(0, -1)) target = target[key] ??= {};
  if (!(path.at(-1) in target)) target[path.at(-1)] = setting.default;
}
if (!defaults.buttons.radius || !schema.find((item) => item.id === "buttons.radius")?.options?.some((option) => option.value === defaults.buttons.radius)) defaults.buttons.radius = schema.find((item) => item.id === "buttons.radius")?.default;
// Each setting's own default is Halo's value, as the project validator requires.
const readPath = (object, id) => id.split(".").reduce((value, key) => value?.[key], object);
for (const setting of schema) { const value = readPath(defaults, setting.id); if (value !== undefined) setting.default = value; }
const theme = {
  id: "jelly-halo",
  name: "Jelly Halo",
  version: "1.0.0",
  engines: forma.engines,
  description: "A calm skincare and beauty storefront: products on soft colour, shop by skin concern, ingredient stories and reviews.",
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
const id = (name) => `halo-${name}-${++next}`;
const block = (type, settings, blocks) => ({ id: id(type), type, enabled: true, settings, ...(blocks ? { blocks } : {}) });
const section = (type, settings, blocks = []) => ({ kind: "inline", section: { id: id(type), type, enabled: true, settings: { styleScheme: "scheme1", ...settings }, blocks } });
const global = (key) => ({ kind: "global", globalSectionId: key });
const chrome = (sections) => [global("announcement"), global("header"), ...sections, global("footer")];
const concerns = [["Dryness", "dry"], ["Breakouts", "blemish"], ["Dullness", "glow"], ["Sensitivity", "calm"], ["Fine lines", "firm"], ["Sun care", "spf"]];
// On the home page the pills are a section of their own; on collections a small label above the grid.
const concernPills = (heading, preset) => section("custom-content", { direction: "vertical", contentAlignment: "left", gap: preset ? 12 : 16, contentWidth: "full", styleSpacing: preset ? "none" : "small" }, [
  block("heading", { text: heading, ...(preset ? { blockTypePreset: preset } : {}) }),
  block("group", { groupDirection: "horizontal", groupAlign: "start", groupGap: 8 }, concerns.map(([label, query]) => block("button", { label, href: `/search?q=${query}`, buttonStyle: "secondary", buttonSize: "small" }))),
]);
const starter = {
  globalSections: {
    announcement: { id: "halo-announcement", type: "announcement-bar", enabled: true, settings: { styleScheme: "scheme2", text: "Free UK delivery over £40 · Two samples with every order" }, blocks: [] },
    header: { id: "halo-header", type: "header", enabled: true, settings: { styleScheme: "scheme1", layout: "classic", sticky: true, showSearch: true, showAccount: true, showCart: true, showWishlist: false, showToolLabels: false }, blocks: [block("menu", { handle: "main" })] },
    footer: { id: "halo-footer", type: "footer", enabled: true, settings: { styleScheme: "scheme4", text: "Gentle skincare, made in small batches and tested on people, never animals.", showNewsletter: false }, blocks: [
      block("link-heading", { text: "Shop" }), block("link", { label: "Skincare", link: "/shop" }), block("link", { label: "Body", link: "/search?q=body" }), block("link", { label: "Sets and gifts", link: "/search?q=set" }),
      block("link-heading", { text: "Help" }), block("link", { label: "Delivery and returns", link: "/pages/shipping" }), block("link", { label: "FAQ", link: "/pages/faq" }), block("link", { label: "Contact", link: "/pages/contact" }),
    ] },
  },
  templates: {
    home: { type: "home", sections: chrome([
      section("hero", { layout: "spotlight", eyebrow: "New · Vitamin C serum", image: { url: asset("hero.webp"), alt: "An amber serum bottle with a dropper on a soft blush background", fit: "cover", focalPoint: { x: 62, y: 50 } }, callouts: "10% vitamin C\nFragrance free\nVegan\nRefillable glass", contentAlignment: "left", styleScheme: "scheme1" }, [
        block("heading", { text: "glow, gently" }),
        block("text", { text: "A daily serum that brightens without stinging. Light enough for morning, gentle enough for every day." }),
        block("button", { label: "Shop the serum", href: "/shop" }),
      ]),
      concernPills("Shop by concern"),
      section("product-grid", { heading: "Bestsellers", text: "The four our customers reorder most.", columns: 4, limit: 4, viewAllLabel: "Shop all", viewAllLink: "/shop" }),
      section("image-with-text", { styleScheme: "scheme2", eyebrow: "Texture first", image: { url: asset("texture.webp"), alt: "A swirl of cream and a drop of golden serum" }, imagePosition: "right" }, [
        block("heading", { text: "light on skin, kind to it" }),
        block("text", { text: "Every formula is tested for how it feels: no sticky finish, no heavy scent, nothing that pills under make-up." }),
        block("button", { label: "Read our formulas", href: "/pages/about" }),
      ]),
      section("multicolumn", { heading: "A simple routine", columns: 4, contentAlignment: "left" }, [
        block("column", { heading: "1. Cleanse", text: "A soft gel that lifts the day without stripping." }),
        block("column", { heading: "2. Treat", text: "One targeted serum, chosen for your concern." }),
        block("column", { heading: "3. Moisturise", text: "Seal it in with a cream that suits your skin." }),
        block("column", { heading: "4. Protect", text: "Daily SPF, every morning, all year round." }),
      ]),
      section("image-with-text", { styleScheme: "scheme3", eyebrow: "Ingredient spotlight", image: { url: asset("ingredient.webp"), alt: "Sliced citrus and green leaves on a pale sage background" }, imagePosition: "left" }, [
        block("heading", { text: "vitamin C, made stable" }),
        block("text", { text: "We use a gentle, stable form of vitamin C so the serum keeps working to the last drop." }),
        block("button", { label: "Shop vitamin C", href: "/search?q=vitamin" }),
      ]),
      section("testimonials", { heading: "What customers say" }, [
        block("testimonial", { quote: "My skin feels calmer after two weeks, and it never stings.", author: "Priya, combination skin" }),
        block("testimonial", { quote: "The first serum I've finished and immediately reordered.", author: "Grace, dry skin" }),
        block("testimonial", { quote: "Light, quick to sink in, and the refills are a lovely touch.", author: "Tom, sensitive skin" }),
      ]),
      section("newsletter", { styleScheme: "scheme4", buttonLabel: "Sign up", contentAlignment: "center" }, [
        block("heading", { text: "10% off your first order" }),
        block("text", { text: "Routine tips and new launches, once a month. No spam." }),
      ]),
    ]) },
    product: { type: "product", sections: chrome([
      section("product-gallery", { imageFit: "contain", layout: "thumbnails", pageLayout: "details-below" }),
      section("product-information", { showVendor: false, showSku: false, showCompareAtPrice: true, showAvailability: true, showSpecifications: false, discountChip: "percent" }),
      section("product-options", { style: "buttons" }),
      section("product-purchase", { showQuantity: true, label: "Add to bag", stickyBar: true }),
      section("trust-strip", {}, [
        block("trust-point", { text: "Free UK delivery over £40", icon: "truck" }),
        block("trust-point", { text: "Two free samples", icon: "gift" }),
        block("trust-point", { text: "30-day returns", icon: "return" }),
      ]),
      section("product-tabs", { styleScheme: "scheme2", layout: "chapters" }, [
        block("info-tab", { title: "What it does", text: "Brightens dull skin and evens tone over four to eight weeks, without the sting of stronger acids." }),
        block("info-tab", { title: "Key ingredients", text: "Vitamin C (ascorbyl glucoside) for brightness, niacinamide for an even tone, and panthenol to calm." }),
        block("info-tab", { title: "How to use", text: "Morning and evening, press two drops into clean skin. Follow with moisturiser, and SPF in the day." }),
      ]),
      section("product-specifications", { heading: "Full ingredients and details", showProductSpecifications: true, layout: "expandable" }),
      section("product-reviews", { heading: "Reviews", allowWriting: true, perPage: 5 }),
      section("related-products", { limit: 4, heading: "Pairs well with" }),
    ]) },
    collection: { type: "collection", sections: chrome([
      section("collection-header", { showTitle: true, showDescription: true, showImage: false, layout: "simple", showBreadcrumb: true }),
      concernPills("Filter by skin concern", "small"),
      section("collection-product-grid", { columns: 4, limit: 24, showSort: true, listLayout: "chips" }),
    ]) },
    cart: { type: "cart", sections: chrome([section("cart-summary", {})]) },
    search: { type: "search", sections: chrome([section("search-results", { showSort: true, showFilters: true, columns: 4 })]) },
    page: { type: "page", sections: chrome([section("page-content", {})]) },
    "not-found": { type: "not-found", sections: chrome([section("not-found-message", {}, [
      block("heading", { text: "this page has wandered off" }),
      block("text", { text: "Try the shop, or search for what you need." }),
      block("button", { label: "Back to the shop", href: "/shop" }),
    ])]) },
  },
  menus: [{ key: "main", name: "Main menu", handle: "main", items: [
    { id: "halo-menu-shop", label: "Skincare", target: { kind: "external", url: "/shop" }, children: [
      { id: "halo-menu-serums", label: "Serums", target: { kind: "external", url: "/search?q=serum" }, children: [] },
      { id: "halo-menu-moisturisers", label: "Moisturisers", target: { kind: "external", url: "/search?q=cream" }, children: [] },
      { id: "halo-menu-cleansers", label: "Cleansers", target: { kind: "external", url: "/search?q=cleanser" }, children: [] },
    ] },
    { id: "halo-menu-concern", label: "Shop by concern", target: { kind: "external", url: "/shop" }, children: concerns.map(([label, query]) => ({ id: `halo-menu-${query}`, label, target: { kind: "external", url: `/search?q=${query}` }, children: [] })) },
    { id: "halo-menu-sets", label: "Sets", target: { kind: "external", url: "/search?q=set" }, children: [] },
    { id: "halo-menu-about", label: "About", target: { kind: "external", url: "/pages/about" }, children: [] },
  ] }],
};
writeFileSync(new URL("starter.json", folder), `${JSON.stringify(starter, null, 2)}\n`);
for (const file of ["package.json", ".gitignore"]) if (!existsSync(new URL(file, folder))) writeFileSync(new URL(file, folder), readFileSync(new URL(`jelly-forma/${file}`, root), "utf8").replaceAll("jelly-forma", "jelly-halo"));
console.log("Built jelly-halo: theme.json and starter.json");
