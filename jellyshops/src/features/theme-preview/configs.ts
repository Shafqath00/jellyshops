import type { PublicProduct } from "@jelly/storefront-renderer";
import { getThemeDefinition, isStarterPackId, listThemes } from "@jelly/storefront-themes";

/**
 * Everything a theme's style guide and template previews need: the theme and
 * starter pack to render, plus sample catalogue data and copy. Adding a theme
 * preview means adding one entry here and a two-line route under
 * `src/app/theme-preview/<slug>/page.tsx`.
 */
export interface ThemePreviewConfig {
  themeId: string;
  packId: string;
  name: string;
  /** Page background behind the device frame. */
  stageColor: string;
  guide: { heading: string; subheading: string; body: string; announcement: string; footerText: string };
  products: PublicProduct[];
  product: { id: string; title: string; description: string; media: Array<{ url: string; alt: string }>; specifications: Record<string, string>; shippingCopy: string; price: string; compareAtPrice?: string; galleryEnabled?: boolean; showBuyNow?: boolean; option?: { id: string; name: string; values: Array<{ id: string; label: string; soldOut?: boolean }> } };
  collection: { title: string; description: string; imageUrl: string };
  page: { title: string; intro: string; heading: string; body: string; bullets: string[] };
  searchQuery: string;
  /** Sample cart: product id to quantity. The second line shows a "Medium" variant. */
  cart: Record<string, number>;
  /** Show the starter pack's own main menu instead of the sample one. */
  useStarterMenu?: boolean;
}

const image = (photo: string, width = 900) => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&q=80`;

const minimalProducts: PublicProduct[] = [
  { id: "p1", name: "Linen tote bag", price: "£28.00", href: "#", imageUrl: image("photo-1544816155-12df9643f363") },
  { id: "p2", name: "Stoneware mug", price: "£18.00", href: "#", imageUrl: image("photo-1514228742587-6b1558fcca3d") },
  // Brand and colours show only when theme settings > Product cards turns them on.
  { id: "p3", name: "Organic cotton tee", price: "£32.00", vendor: "Jelly Basics", swatches: [{ label: "Chalk", color: "#f1ede4" }, { label: "Charcoal", color: "#2b2a27" }, { label: "Sage", color: "#9aa48f" }], href: "#", imageUrl: image("photo-1521572163474-6864f9cf17ab") },
  { id: "p4", name: "Ceramic vase", price: "£42.00", href: "#", imageUrl: image("photo-1578500494198-246f612d3b3d") },
  { id: "p5", name: "Cream knit top", price: "£64.00", href: "#", imageUrl: image("photo-1434389677669-e08b4cac3105") },
  { id: "p6", name: "Insulated bottle", price: "£24.00", href: "#", imageUrl: image("photo-1602143407151-7111542de6e8") },
  { id: "p7", name: "Everyday shirt", price: "£48.00", href: "#", imageUrl: image("photo-1512436991641-6745cdb1723f") },
  { id: "p8", name: "Weekend rail edit", price: "£36.00", href: "#", imageUrl: image("photo-1490481651871-ab68de25d43d") },
];

export const jellyMinimalPreview: ThemePreviewConfig = {
  themeId: "jelly-signature",
  packId: "jelly-signature",
  name: "Jelly Minimal",
  stageColor: "#eeece8",
  guide: {
    heading: "Find your everyday favourites",
    subheading: "The new collection",
    body: "Body text is set in a clean sans-serif at a comfortable reading size, with generous line height so product details and policies stay easy to read on any screen.",
    announcement: "Free delivery on orders over £50",
    footerText: "Thoughtful everyday goods, chosen with care and delivered to your door.",
  },
  products: minimalProducts,
  product: {
    id: "p3",
    title: "Organic cotton tee",
    description: "A relaxed, everyday tee cut from soft organic cotton. Pre-washed for a lived-in feel from the first wear.\n\nMachine wash cold and dry flat to keep its shape.",
    media: [
      { url: image("photo-1521572163474-6864f9cf17ab"), alt: "Organic cotton tee, front" },
      { url: image("photo-1512436991641-6745cdb1723f"), alt: "Organic cotton tee on a clothing rail" },
      { url: image("photo-1490481651871-ab68de25d43d"), alt: "The tee alongside other neutral basics" },
    ],
    specifications: { Material: "100% organic cotton", Fit: "Relaxed", Care: "Machine wash cold" },
    shippingCopy: "Free delivery on orders over £50. Returns within 30 days.",
    price: "£32.00",
    compareAtPrice: "£40.00",
  },
  collection: { title: "For the home", description: "Ceramics, textiles and small objects that make a house feel lived in.", imageUrl: image("photo-1578500494198-246f612d3b3d") },
  page: {
    title: "About us",
    intro: "We started in a small studio with a simple idea: everyday things should be made well and last for years.",
    heading: "What we care about",
    body: "Natural materials, honest prices and careful packaging. We work with a handful of makers we know by name.",
    bullets: ["Small batches, made to order where we can", "Plastic-free packaging"],
  },
  searchQuery: "linen",
  cart: { p1: 1, p3: 2 },
};

const avenueProducts: PublicProduct[] = [
  { id: "a1", name: "Leather biker jacket", price: "£320.00", badge: "New", href: "#", imageUrl: image("photo-1551028719-00167b16eac5") },
  { id: "a2", name: "Straight-leg jeans", price: "£110.00", compareAtPrice: "£140.00", badge: "Sale", href: "#", imageUrl: image("photo-1624378439575-d8705ad7ae80") },
  { id: "a3", name: "Heavyweight crewneck", price: "£85.00", vendor: "Avenue Studio", swatches: [{ label: "White", color: "#f5f5f2" }, { label: "Navy", color: "#1f2a44" }, { label: "Stone", color: "#b7ad9d" }, { label: "Black", color: "#141414" }, { label: "Rust", color: "#9c4a2f" }], moreSwatches: 2, href: "#", imageUrl: image("photo-1620799140408-edc6dcb6d633") },
  { id: "a4", name: "Belted wool coat", price: "£290.00", href: "#", imageUrl: image("photo-1539533018447-63fcce2678e3") },
  { id: "a5", name: "Utility bomber jacket", price: "£180.00", href: "#", imageUrl: image("photo-1591047139829-d91aecb6caea") },
  { id: "a6", name: "Check double-breasted blazer", price: "£240.00", badge: "New", href: "#", imageUrl: image("photo-1608234808654-2a8875faa7fd") },
  { id: "a7", name: "Denim shirt dress", price: "£120.00", href: "#", imageUrl: image("photo-1591369822096-ffd140ec948f") },
  { id: "a8", name: "Organic cotton tee", price: "£35.00", href: "#", imageUrl: image("photo-1618354691373-d851c5c3a990") },
];

export const jellyAvenuePreview: ThemePreviewConfig = {
  themeId: "jelly-avenue",
  packId: "jelly-avenue",
  name: "Jelly Avenue",
  stageColor: "#e9e9e7",
  guide: {
    heading: "Dressed for the city",
    subheading: "New this season",
    body: "Body text is set in a clean, tightly spaced sans-serif. Product names and prices stay small and quiet so the photography leads, while headings carry the brand.",
    announcement: "Free delivery and 30-day returns on every order",
    footerText: "Modern wardrobe essentials, made to be worn on repeat. Designed in the studio, delivered to your door.",
  },
  products: avenueProducts,
  product: {
    id: "a4",
    title: "Belted wool coat",
    description: "Cut for an easy, considered fit from a soft wool blend, with a removable tie belt and deep patch pockets. Made to layer over knitwear and tailoring alike.\n\nDry clean only. Store on a wide hanger to keep its shape.",
    media: [
      { url: image("photo-1539533018447-63fcce2678e3", 1200), alt: "Belted wool coat in camel, worn on city steps" },
      { url: image("photo-1485968579580-b6d095142e6e", 1200), alt: "A tailored coat styled for the street" },
      { url: image("photo-1445205170230-053b83016050", 1200), alt: "Wool coats hanging on a rail" },
      { url: image("photo-1539109136881-3be0616acf4b", 1200), alt: "A pale blue coat worn in a city square" },
    ],
    specifications: { Material: "70% wool, 30% recycled polyamide", Fit: "Relaxed, true to size", Care: "Dry clean only" },
    shippingCopy: "Free delivery and 30-day returns on every order.",
    price: "£290.00",
    compareAtPrice: "£360.00",
  },
  collection: { title: "Outerwear", description: "Coats and jackets in considered fabrics, cut to layer through every season.", imageUrl: image("photo-1445205170230-053b83016050", 1600) },
  page: {
    title: "Our story",
    intro: "We started with a simple idea: a small wardrobe of well-made pieces, worn often and kept for years.",
    heading: "How we make things",
    body: "We work with a handful of mills and workshops we know by name, choosing natural fibres and finishing every piece by hand.",
    bullets: ["Small runs, restocked rather than replaced", "Recycled and plastic-free packaging"],
  },
  searchQuery: "jacket",
  cart: { a4: 1, a3: 2 },
};

const bedroom = "/themes/jelly-resthaven/bedroom.png";
const resthavenProducts: PublicProduct[] = [
  { id: "r1", name: "Harbour upholstered bed", price: "£499.00", compareAtPrice: "£699.00", saving: "£200.00", discountPercent: 29, chip: "More colours", href: "#", imageUrl: bedroom },
  { id: "r2", name: "Linden ottoman bed", price: "£649.00", href: "#", imageUrl: bedroom },
  { id: "r3", name: "Calder divan set", price: "£429.00", compareAtPrice: "£529.00", saving: "£100.00", discountPercent: 19, href: "#", imageUrl: bedroom },
  { id: "r4", name: "Hollis pocket sprung mattress", price: "£359.00", chip: "Medium firm", href: "#", imageUrl: bedroom },
  { id: "r5", name: "Ashby headboard", price: "£149.00", href: "#", imageUrl: bedroom },
  { id: "r6", name: "Merrow hybrid mattress", price: "£549.00", href: "#", imageUrl: bedroom },
];

/** Resthaven (bed showroom). Sample products only; every picture is the theme's own bedroom photo. */
export const jellyResthavenPreview: ThemePreviewConfig = {
  themeId: "jelly-resthaven",
  packId: "jelly-resthaven",
  name: "Resthaven",
  stageColor: "#e8dfd8",
  guide: {
    heading: "Your best sleep starts here",
    subheading: "New and trending",
    body: "Headings are set in Playfair Display and body text in Inter. Warm linen backgrounds, plum buttons and clear prices keep the focus on the beds.",
    announcement: "Find the bed and mattress that fit your space and your sleep",
    footerText: "Beds, mattresses and help choosing the right one for your room.",
  },
  products: resthavenProducts,
  product: {
    id: "r1",
    title: "Harbour upholstered bed",
    description: "A tall panelled headboard and a deep upholstered frame in a soft woven fabric. Choose the size, colour and storage that suit your room.\n\nSlats are included; the mattress is sold separately.",
    media: [{ url: bedroom, alt: "An upholstered bed in a light-filled bedroom" }],
    specifications: { "Double (W x L x H)": "146 x 205 x 120 cm", "King (W x L x H)": "161 x 215 x 120 cm", Fabric: "Woven polyester", Assembly: "Two people, about 45 minutes" },
    shippingCopy: "Delivery details are shown at checkout.",
    price: "£499.00",
    compareAtPrice: "£699.00",
  },
  collection: { title: "Upholstered beds", description: "Soft, tailored frames in a range of fabrics and colours. Every bed lists its exact dimensions so you can check it fits your room before you order. Choose storage drawers or an ottoman lift for extra space.", imageUrl: bedroom },
  page: {
    title: "About us",
    intro: "We help you choose a bed and mattress that suit your room and the way you sleep.",
    heading: "How we help",
    body: "Every product page lists the sizes, materials and options, and our team is happy to answer questions before you order.",
    bullets: ["Clear dimensions on every bed", "Help choosing the right mattress"],
  },
  searchQuery: "bed",
  cart: { r1: 1, r4: 1 },
  useStarterMenu: true,
};

const formaAsset = (file: string) => `/themes/jelly-forma/${file}-v2.webp`;
const formaProducts: PublicProduct[] = [
  { id: "f1", name: "Everyday timber stool", price: "£149.00", compareAtPrice: "£179.00", badge: "Sale", href: "#", imageUrl: formaAsset("stool"), vendor: "Forma Studio", available: true, swatches: [{ label: "Natural", color: "#c9a97c" }, { label: "Ink", color: "#171717" }] },
  { id: "f2", name: "Sunday lounge sofa", price: "£899.00", href: "#", imageUrl: formaAsset("sofa"), vendor: "Forma Studio", available: true },
  { id: "f3", name: "Gather oak dining table", price: "£649.00", href: "#", imageUrl: formaAsset("table"), vendor: "Forma Studio", available: true },
  { id: "f4", name: "Arc table lamp", price: "£429.00", href: "#", imageUrl: formaAsset("lamp"), vendor: "Forma Studio", available: true },
];

export const jellyFormaPreview: ThemePreviewConfig = {
  themeId: "jelly-forma", packId: "jelly-forma", name: "Jelly Forma", stageColor: "#e8ebf1",
  guide: {
    heading: "Soft living", subheading: "Make room for something new",
    body: "Manrope headings, clear product details and generous images make a furniture collection easy to explore. Rounded controls and blue accents carry the design across every page.",
    announcement: "Make room for everyday living", footerText: "Furniture, lighting and useful objects for the rooms you live in.",
  },
  products: formaProducts,
  product: {
    id: "f1", title: "Everyday timber stool", description: "A simple timber stool with a handhold in the seat and a footrest below. Pull it up to a counter or use it as an occasional perch.\n\nWipe clean with a soft, damp cloth and dry immediately.",
    galleryEnabled: true, showBuyNow: false, option: { id: "finish", name: "Finish", values: [{ id: "natural", label: "Natural oak" }, { id: "smoked", label: "Smoked oak" }, { id: "walnut", label: "Walnut", soldOut: true }] },
    media: [{ url: formaAsset("stool_detail"), alt: "Oak counter stool, three-quarter view" }, { url: formaAsset("stool_front"), alt: "Oak counter stool, front view" }],
    specifications: { Material: "Timber frame", Care: "Wipe clean with a damp cloth", Assembly: "See the included guide" },
    shippingCopy: "Delivery options are shown at checkout.", price: "£149.00", compareAtPrice: "£179.00",
  },
  collection: { title: "Furniture for everyday living", description: "Chairs, sofas and considered pieces for the spaces you share.", imageUrl: formaAsset("hero") },
  page: { title: "Our story", intro: "We choose furniture for the way rooms are really used: coffee in the morning, dinner with friends and a quiet place to sit.", heading: "Made for your everyday", body: "Explore materials, measurements and care details before choosing a piece. Our team can help you work out what fits.", bullets: ["Clear dimensions and materials", "Helpful advice before you order"] },
  searchQuery: "chair", cart: { f1: 2, f2: 1 }, useStarterMenu: true,
};

/** Previews of the built-in themes, by the path under /theme-preview/. */
const builtInPreviews: Record<string, ThemePreviewConfig> = { "jelly-minimal": jellyMinimalPreview, "jelly-avenue": jellyAvenuePreview, "jelly-resthaven": jellyResthavenPreview, "jelly-forma": jellyFormaPreview };
const previewOfBase: Record<string, ThemePreviewConfig> = { "jelly-signature": jellyMinimalPreview, "jelly-avenue": jellyAvenuePreview };

/**
 * A theme built on a built-in design (`extends` in theme.json, e.g. one made by scripts/new-theme.mjs) is previewed
 * with its base design's sample catalogue and copy, its own settings and its own starter pages, at
 * /theme-preview/<theme id>. That page is what the design lint checks before a generated theme is reviewed.
 */
export function generatedThemePreview(themeId: string): ThemePreviewConfig | null {
  let definition;
  try { definition = getThemeDefinition(themeId); } catch { return null; }
  const manifest = definition.manifest as { extends?: string; name?: string };
  const base = manifest.extends ? previewOfBase[manifest.extends] : undefined;
  if (!base || !isStarterPackId(themeId)) return null;
  return { ...base, themeId, packId: themeId, name: manifest.name ?? themeId, stageColor: "#ebedec", useStarterMenu: true };
}

/** Every theme preview page and its config: the built-in themes, then every generated theme (with its base design's preview path). */
export function themePreviewEntries(): Array<{ path: string; config: ThemePreviewConfig; base?: string }> {
  const basePath = (themeId: string) => Object.entries(builtInPreviews).find(([, config]) => config.themeId === themeId)?.[0];
  const generated = listThemes()
    .filter((theme) => typeof (theme.manifest as { extends?: unknown }).extends === "string")
    .flatMap((theme) => { const config = generatedThemePreview(theme.id); return config ? [{ path: theme.id, config, base: basePath((theme.manifest as { extends: string }).extends) }] : []; });
  return [...Object.entries(builtInPreviews).map(([path, config]) => ({ path, config })), ...generated];
}
