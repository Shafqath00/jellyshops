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
  /** Sample star ratings by product id, for themes that show ratings on cards. */
  ratings?: Record<string, { average: number; count: number }>;
  /** Sample specifications by product id, for the compare page (themes with Product cards > Let shoppers compare products). */
  compareSpecifications?: Record<string, Record<string, string>>;
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

const resthavenPhoto = (name: string) => `/themes/jelly-resthaven/${name}.webp`;
const resthavenProducts: PublicProduct[] = [
  { id: "r1", name: "Harbour upholstered bed", price: "£499.00", priceMinor: 49900, available: true, filters: [{ name: "Size", values: ["Double","King","Super king"] }, { name: "Storage", values: ["No storage", "2 drawers"] }, { name: "Fabric", values: ["Velvet", "Boucle"] }, { name: "Type", values: ["Upholstered bed"] }], compareAtPrice: "£699.00", saving: "£200.00", discountPercent: 29, chip: "More colours", href: "#", imageUrl: resthavenPhoto("hero"), hoverImageUrl: resthavenPhoto("detail") },
  { id: "r2", name: "Linden ottoman bed", price: "£649.00", priceMinor: 64900, available: true, filters: [{ name: "Size", values: ["Double","King"] }, { name: "Storage", values: ["Ottoman lift"] }, { name: "Fabric", values: ["Linen"] }, { name: "Type", values: ["Ottoman bed"] }], href: "#", imageUrl: resthavenPhoto("room-guest") },
  { id: "r3", name: "Calder divan set", price: "£429.00", priceMinor: 42900, available: false, filters: [{ name: "Size", values: ["Single","Double"] }, { name: "Storage", values: ["No storage", "2 drawers", "4 drawers"] }, { name: "Fabric", values: ["Velvet"] }, { name: "Type", values: ["Divan bed"] }], compareAtPrice: "£529.00", saving: "£100.00", discountPercent: 19, href: "#", imageUrl: resthavenPhoto("divan") },
  { id: "r4", name: "Hollis pocket sprung mattress", price: "£359.00", priceMinor: 35900, available: true, filters: [{ name: "Size", values: ["Single","Double","King"] }, { name: "Type", values: ["Mattress"] }], chip: "Medium firm", href: "#", imageUrl: resthavenPhoto("mattress") },
  { id: "r5", name: "Ashby headboard", price: "£149.00", priceMinor: 14900, available: true, filters: [{ name: "Size", values: ["Double","King"] }, { name: "Fabric", values: ["Boucle"] }, { name: "Type", values: ["Headboard"] }], href: "#", imageUrl: resthavenPhoto("headboard") },
  { id: "r6", name: "Merrow hybrid mattress", price: "£549.00", priceMinor: 54900, available: true, filters: [{ name: "Size", values: ["Double","King","Super king"] }, { name: "Type", values: ["Mattress"] }], href: "#", imageUrl: resthavenPhoto("mattress"), hoverImageUrl: resthavenPhoto("fabrics") },
];

/** Resthaven (bed showroom). Sample products only; photos are the theme's own (assets/, see SOURCES.md). */
export const jellyResthavenPreview: ThemePreviewConfig = {
  themeId: "jelly-resthaven",
  packId: "jelly-resthaven",
  name: "Resthaven",
  stageColor: "#e9e3da",
  guide: {
    heading: "Sleep well. Wake up somewhere beautiful.",
    subheading: "Our most-loved beds",
    body: "Headings are set in Cormorant Garamond and body text in Figtree. Oat backgrounds, midnight buttons, brass highlights and clear prices keep the focus on the beds.",
    announcement: "Beds and mattresses in every size, from single to super king",
    footerText: "Beds, mattresses and help choosing the right one for your room.",
  },
  products: resthavenProducts,
  ratings: { r1: { average: 4.8, count: 214 }, r2: { average: 4.6, count: 87 }, r3: { average: 4.7, count: 132 }, r4: { average: 4.5, count: 56 }, r6: { average: 4.9, count: 41 } },
  product: {
    id: "r1",
    title: "Harbour upholstered bed",
    description: "A tall panelled headboard and a deep upholstered frame in a soft woven fabric. Choose the size, colour and storage that suit your room.\n\nSlats are included; the mattress is sold separately.",
    media: [{ url: resthavenPhoto("hero"), alt: "The Harbour bed in oatmeal boucle in a light-filled bedroom" }, { url: resthavenPhoto("detail"), alt: "The rounded corner, piping and oak foot of the Harbour bed" }, { url: resthavenPhoto("fabrics"), alt: "Velvet, boucle and linen fabric swatches" }],
    specifications: { "Double (W x L x H)": "146 x 205 x 120 cm", "King (W x L x H)": "161 x 215 x 120 cm", Fabric: "Woven polyester", Assembly: "Two people, about 45 minutes" },
    shippingCopy: "Delivery details are shown at checkout.",
    price: "£499.00",
    compareAtPrice: "£699.00",
  },
  collection: { title: "Upholstered beds", description: "Soft, tailored frames in a range of fabrics and colours. Every bed lists its exact dimensions so you can check it fits your room before you order. Choose storage drawers or an ottoman lift for extra space.", imageUrl: resthavenPhoto("room-main") },
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

const haloAsset = (file: string) => `/themes/jelly-halo/${file}.webp`;
const haloProducts: PublicProduct[] = [
  { id: "h1", name: "Vitamin C brightening serum", price: "£32.00", href: "#", imageUrl: haloAsset("serum"), chip: "Dullness", available: true },
  { id: "h2", name: "Barrier repair cream", price: "£28.00", href: "#", imageUrl: haloAsset("cream"), chip: "Dryness", available: true },
  { id: "h3", name: "Soft gel cleanser", price: "£18.00", compareAtPrice: "£22.00", href: "#", imageUrl: haloAsset("cleanser"), chip: "All skin", available: true },
  { id: "h4", name: "Daily mineral SPF 50", price: "£26.00", href: "#", imageUrl: haloAsset("spf"), chip: "Sun care", available: true },
  { id: "h5", name: "Overnight facial oil", price: "£34.00", href: "#", imageUrl: haloAsset("oil"), chip: "Fine lines", available: true },
  { id: "h6", name: "Rose lip balm", price: "£9.00", href: "#", imageUrl: haloAsset("balm"), chip: "Lips", available: false },
];

export const jellyHaloPreview: ThemePreviewConfig = {
  themeId: "jelly-halo", packId: "jelly-halo", name: "Jelly Halo", stageColor: "#efe7df",
  guide: {
    heading: "glow, gently", subheading: "A simple routine",
    body: "Plus Jakarta Sans throughout, products on soft colour, and plenty of space. Shoppers browse by skin concern, read the ingredients and see real reviews before they buy.",
    announcement: "Free UK delivery over £40 · Two samples with every order", footerText: "Gentle skincare, made in small batches and tested on people, never animals.",
  },
  products: haloProducts,
  product: {
    id: "h1", title: "Vitamin C brightening serum", description: "A daily serum that brightens dull skin without stinging. Light enough for the morning, gentle enough for every day.",
    galleryEnabled: true, showBuyNow: false, option: { id: "size", name: "Size", values: [{ id: "15", label: "15 ml" }, { id: "30", label: "30 ml" }, { id: "refill", label: "30 ml refill", soldOut: true }] },
    media: [{ url: haloAsset("serum"), alt: "Amber serum bottle with a dropper" }, { url: haloAsset("texture"), alt: "A drop of serum and a swirl of cream" }],
    specifications: { "Skin type": "All, including sensitive", "Full ingredients": "Aqua, ascorbyl glucoside, niacinamide, glycerin, panthenol, sodium hyaluronate", Size: "30 ml" },
    shippingCopy: "Free UK delivery over £40.", price: "£32.00",
  },
  collection: { title: "Serums", description: "Targeted treatments for one concern at a time. Pick the one that matches your skin today.", imageUrl: haloAsset("routine") },
  page: { title: "About Halo", intro: "We make a small range of gentle skincare, each product built around one job.", heading: "How we formulate", body: "Every formula is tested for how it feels and how it works, on people with sensitive skin first.", bullets: ["Fragrance free", "Vegan and cruelty free", "Refillable glass"] },
  searchQuery: "serum", cart: { h1: 1, h2: 1 }, useStarterMenu: true,
  ratings: { h1: { average: 4.8, count: 214 }, h2: { average: 4.6, count: 98 }, h3: { average: 4.7, count: 156 }, h4: { average: 4.5, count: 61 }, h5: { average: 4.9, count: 33 } },
};

const diodeAsset = (file: string) => `/themes/jelly-diode/${file}.webp`;
const diodeProducts: PublicProduct[] = [
  { id: "d1", name: "Arc ANC headphones", price: "£229.00", compareAtPrice: "£259.00", badge: "Sale", href: "#", imageUrl: diodeAsset("headphones"), vendor: "Diode Audio", chip: "40 h battery", available: true, swatches: [{ label: "Graphite", color: "#2b2d31" }, { label: "Silver", color: "#c9ccd1" }] },
  { id: "d2", name: "Pulse wireless earbuds", price: "£129.00", href: "#", imageUrl: diodeAsset("earbuds"), vendor: "Diode Audio", chip: "IPX4", available: true },
  { id: "d3", name: "Field 75 mechanical keyboard", price: "£149.00", href: "#", imageUrl: diodeAsset("keyboard"), vendor: "Diode Desk", chip: "Hot-swap", available: true },
  { id: "d4", name: "Orbit portable speaker", price: "£89.00", href: "#", imageUrl: diodeAsset("speaker"), vendor: "Diode Audio", chip: "20 h battery", available: true },
  { id: "d5", name: "Volt 65W USB-C charger", price: "£49.00", href: "#", imageUrl: diodeAsset("charger"), vendor: "Diode Power", chip: "65 W", available: true },
  { id: "d6", name: "Cell 10K power bank", price: "£39.00", href: "#", imageUrl: diodeAsset("powerbank"), vendor: "Diode Power", chip: "10,000 mAh", available: false },
];

export const jellyDiodePreview: ThemePreviewConfig = {
  themeId: "jelly-diode", packId: "jelly-diode", name: "Jelly Diode", stageColor: "#dfe3e8",
  guide: {
    heading: "Hear less noise. More music.", subheading: "The numbers",
    body: "Space Grotesk headings, Inter for reading and a monospace face for specifications. Outlined cards, ruled tables and one electric blue keep every page precise.",
    announcement: "Free UK delivery over £50 · 2-year warranty on everything", footerText: "Audio, keyboards and power, designed to be used every day and supported for years.",
  },
  products: diodeProducts,
  product: {
    id: "d1", title: "Arc ANC headphones", description: "Over-ear wireless headphones with adaptive noise cancelling, forty hours of battery and a fold-flat design.\n\nFive minutes on USB-C gives four hours of listening.",
    galleryEnabled: true, showBuyNow: false, option: { id: "colour", name: "Colour", values: [{ id: "graphite", label: "Graphite" }, { id: "silver", label: "Silver" }, { id: "blue", label: "Signal blue", soldOut: true }] },
    media: [{ url: diodeAsset("headphones"), alt: "Graphite over-ear headphones, three-quarter view" }, { url: diodeAsset("inthebox"), alt: "Headphones, carry pouch, cable and guide laid out flat" }],
    specifications: { "Battery life": "Up to 40 hours (ANC on)", Charging: "USB-C, 5 min = 4 hours", Bluetooth: "5.3, multipoint (2 devices)", Codecs: "AAC, SBC, LC3", Weight: "254 g", Drivers: "40 mm dynamic" },
    shippingCopy: "Free UK delivery over £50.", price: "£229.00", compareAtPrice: "£259.00",
  },
  collection: { title: "Audio", description: "Headphones, earbuds and speakers, with the numbers that matter on every card.", imageUrl: diodeAsset("desk") },
  page: { title: "Warranty and support", intro: "Every Diode product comes with a two-year warranty and five years of firmware updates.", heading: "How repairs work", body: "Tell us what is wrong and we send a prepaid label. Most repairs are back with you within ten working days.", bullets: ["2-year warranty, repairs included", "Firmware updates for 5 years"] },
  searchQuery: "headphones", cart: { d1: 1, d5: 1 }, useStarterMenu: true,
  compareSpecifications: {
    d1: { "Battery life": "40 hours", Connectivity: "Bluetooth 5.3, multipoint", Charging: "USB-C, 5 min = 4 hours", "Noise cancelling": "Adaptive", Weight: "254 g", "Water resistance": "None", Warranty: "2 years" },
    d2: { "Battery life": "8 hours (32 with case)", Connectivity: "Bluetooth 5.3, multipoint", Charging: "USB-C and wireless", "Noise cancelling": "Adaptive", Weight: "5 g per earbud", "Water resistance": "IPX4", Warranty: "2 years" },
    d3: { Connectivity: "USB-C, Bluetooth 5.1 (3 devices)", "Battery life": "200 hours (backlight off)", Switches: "Hot-swap, pre-lubed linear", Layout: "75%, UK ISO", Weight: "1.1 kg", Warranty: "2 years" },
    d4: { "Battery life": "20 hours", Connectivity: "Bluetooth 5.3", Charging: "USB-C", Weight: "540 g", "Water resistance": "IP67", Warranty: "2 years" },
    d5: { Output: "65 W total", Ports: "2 × USB-C", Plug: "UK three-pin", Weight: "112 g", Warranty: "2 years" },
    d6: { Capacity: "10,000 mAh", Output: "20 W USB-C", Charging: "USB-C, 2.5 hours", Weight: "180 g", Warranty: "2 years" },
  },
  ratings: { d1: { average: 4.7, count: 382 }, d2: { average: 4.5, count: 241 }, d3: { average: 4.8, count: 129 }, d4: { average: 4.4, count: 87 }, d5: { average: 4.9, count: 64 } },
};

/** Previews of the built-in themes, by the path under /theme-preview/. */
const builtInPreviews: Record<string, ThemePreviewConfig> = { "jelly-minimal": jellyMinimalPreview, "jelly-avenue": jellyAvenuePreview, "jelly-resthaven": jellyResthavenPreview, "jelly-forma": jellyFormaPreview, "jelly-halo": jellyHaloPreview, "jelly-diode": jellyDiodePreview };
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
