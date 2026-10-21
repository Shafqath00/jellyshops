import type { PublicProduct } from "@jelly/storefront-renderer";
import type { V4StarterPackId } from "@jelly/storefront-registry";

/**
 * Everything a theme's style guide and template previews need: the theme and
 * starter pack to render, plus sample catalogue data and copy. Adding a theme
 * preview means adding one entry here and a two-line route under
 * `src/app/theme-preview/<slug>/page.tsx`.
 */
export interface ThemePreviewConfig {
  themeId: string;
  packId: V4StarterPackId;
  name: string;
  /** Page background behind the device frame. */
  stageColor: string;
  guide: { heading: string; subheading: string; body: string; announcement: string; footerText: string };
  products: PublicProduct[];
  product: { id: string; title: string; description: string; media: Array<{ url: string; alt: string }>; specifications: Record<string, string>; shippingCopy: string; price: string; compareAtPrice?: string };
  collection: { title: string; description: string; imageUrl: string };
  page: { title: string; intro: string; heading: string; body: string; bullets: string[] };
  searchQuery: string;
  /** Sample cart: product id to quantity. The second line shows a "Medium" variant. */
  cart: Record<string, number>;
}

const image = (photo: string, width = 900) => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${width}&q=80`;

const minimalProducts: PublicProduct[] = [
  { id: "p1", name: "Linen tote bag", price: "£28.00", href: "#", imageUrl: image("photo-1544816155-12df9643f363") },
  { id: "p2", name: "Stoneware mug", price: "£18.00", href: "#", imageUrl: image("photo-1514228742587-6b1558fcca3d") },
  { id: "p3", name: "Organic cotton tee", price: "£32.00", href: "#", imageUrl: image("photo-1521572163474-6864f9cf17ab") },
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
  { id: "a3", name: "Heavyweight crewneck", price: "£85.00", href: "#", imageUrl: image("photo-1620799140408-edc6dcb6d633") },
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
