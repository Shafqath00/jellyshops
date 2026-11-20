import type { PublicProduct } from "@jelly/storefront-renderer";
import type { V4StarterPack } from "@jelly/storefront-registry";
import type { ThemePreviewConfig } from "./configs";
import design from "./express-bed-design.json";

/**
 * Express Bed (a merchant store on Resthaven) as it would look once installed: its own page layouts, menus and theme
 * settings from scripts/express-bed/build-plan.mjs (which writes express-bed-design.json), with its 18 test products
 * as sample cards. Review it at /theme-preview/express-bed before installing or publishing.
 */
interface SampleProduct extends PublicProduct {
  collection: string;
  about?: string;
  specifications: Record<string, string>;
  gallery: string[];
  sizes: Array<{ label: string; price: string }>;
}

const products = design.products as unknown as SampleProduct[];
/** The card fields only (the sample's extra fields feed the product page). */
const card = (product: SampleProduct): PublicProduct => {
  const copy: Partial<SampleProduct> = { ...product };
  for (const key of ["collection", "about", "specifications", "gallery", "sizes"] as const) delete copy[key];
  return copy as PublicProduct;
};
const featured = products.find((product) => product.id === "calder-ottoman-storage-bed") ?? products[0];
const ratings = Object.fromEntries(products.map((product, index) => [product.id, { average: [4.9, 4.7, 4.8, 4.6, 5][index % 5], count: [212, 86, 141, 37, 18][index % 5] }]));

export const expressBedPreview: ThemePreviewConfig = {
  themeId: "jelly-resthaven",
  packId: "express-bed",
  name: "Express Bed",
  stageColor: "#efe9df",
  pack: design.pack as unknown as V4StarterPack,
  themeSettings: design.themeSettings as Record<string, unknown>,
  guide: {
    heading: "Beds worth waking up for.",
    subheading: "Our best sellers",
    body: "Headings are set in DM Serif Display and body text in Plus Jakarta Sans. Warm paper, ink, cobalt buttons, tangerine highlights and butter, mint, blush and cobalt bands.",
    announcement: "Beds delivered in 5 to 7 working days",
    footerText: "Beds, mattresses and headboards, delivered fast by our own two-person team.",
  },
  products: products.map(card),
  ratings,
  product: {
    id: featured.id,
    title: featured.name,
    description: featured.about ?? "",
    media: featured.gallery.map((url, index) => ({ url, alt: index === 0 ? `${featured.name} in a bright bedroom` : `${featured.name}, another view` })),
    specifications: featured.specifications,
    shippingCopy: "Two-person delivery to the room of your choice.",
    price: featured.price,
    compareAtPrice: featured.compareAtPrice,
    option: { id: "size", name: "Size", values: featured.sizes.map((size) => ({ id: size.label.toLowerCase().replace(/ /g, "-"), label: size.label })) },
  },
  collection: { title: "Beds", description: "Divan, ottoman storage, upholstered and wooden bed frames in every size from single to super king. Two-person delivery to the room of your choice.", imageUrl: "/images/express-bed/eb-banner-beds.webp" },
  page: {
    title: "About Express Bed",
    intro: "A bed showroom for beds, mattresses and headboards, with our own two-person delivery team.",
    heading: "What we believe",
    body: "A good bed should be simple to choose: exact sizes on every page, a showroom where you can lie on everything, and delivery to the room you choose.",
    bullets: ["Every mattress on show in our showroom", "Spread the cost with Klarna"],
  },
  searchQuery: "bed",
  cart: { [featured.id]: 1, "hollis-pocket-1000-mattress": 1 },
  useStarterMenu: true,
};
