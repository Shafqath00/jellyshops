import type { PublicProduct } from "@jelly/storefront-renderer";
import type { ThemePreviewConfig } from "./configs";

/**
 * "Messy" sample data: a store as merchants really fill it in, so a template is judged on what shoppers will see,
 * not on our tidy illustrative photos. Photos of every shape and size (tall phone shots, wide banners, tiny
 * low-resolution images, cut-outs on white, off-centre subjects, a missing photo), very long and very short names,
 * long prices, sold-out products, a product with a dozen photos and many option values, long specifications and
 * descriptions. Built by scripts/build-messy-fixtures.mjs (photos) and used by every theme preview's
 * "Sample data: Messy" switch and by the design lint.
 */
const photo = (name: string) => `/theme-preview/messy/${name}.webp`;

export const MESSY_PRODUCTS: PublicProduct[] = [
  { id: "m1", name: "Hand-finished solid oak and recycled-steel modular storage unit with soft-close drawers (2 m)", price: "£1,249.00", compareAtPrice: "£1,599.00", saving: "£350.00", discountPercent: 22, badge: "Sale", href: "#", imageUrl: photo("tall-phone"), vendor: "Northern Workshop & Co. Furniture Makers", chip: "Made to order, 6–8 weeks", available: true, swatches: [{ label: "Natural", color: "#c9a97c" }, { label: "Smoked", color: "#6b4f3a" }, { label: "Black", color: "#1b1b1b" }, { label: "White", color: "#f4f2ee" }, { label: "Grey", color: "#9b9b9b" }], moreSwatches: 4 },
  { id: "m2", name: "Mug", price: "£4.00", href: "#", imageUrl: photo("tiny"), available: true },
  { id: "m3", name: "Panoramic desk set-up bundle", price: "£389.50", href: "#", imageUrl: photo("wide-banner"), vendor: "Desk", available: true },
  { id: "m4", name: "Product with no photo yet", price: "£12.99", href: "#", imageUrl: "", available: true },
  { id: "m5", name: "Cut-out speaker on a white background", price: "£89.00", href: "#", imageUrl: photo("cutout-white"), available: false, chip: "Sold out" },
  { id: "m6", name: "Off-centre lamp", price: "£129.00", compareAtPrice: "£149.00", href: "#", imageUrl: photo("off-centre"), available: true },
  { id: "m7", name: "Supersizedwordwithoutanyspacesthatmustnotbreakthelayout", price: "£10,000.00", href: "#", imageUrl: photo("detail-tall"), available: true },
  { id: "m8", name: "Small odd-shaped charger photo", price: "£19.00", href: "#", imageUrl: photo("charger-small"), available: true },
];

const longParagraph = "This description was pasted from a supplier spreadsheet, so it is long and runs on without breaks: dimensions, materials, care instructions, delivery notes and a warranty statement all in one place, because that is how many merchants start before they tidy it up.";

/** The theme's own preview with its sample data replaced by the messy store (look, copy and menus stay the theme's). */
export function messyPreviewConfig(config: ThemePreviewConfig): ThemePreviewConfig {
  return {
    ...config,
    products: MESSY_PRODUCTS,
    product: {
      id: "m1",
      title: MESSY_PRODUCTS[0].name,
      description: [longParagraph, longParagraph, "Short line.", longParagraph].join("\n\n"),
      media: [
        { url: photo("tall-phone"), alt: "Phone photo, tall" },
        { url: photo("wide-banner"), alt: "Wide banner" },
        { url: photo("tiny"), alt: "Tiny photo" },
        { url: photo("portrait"), alt: "Portrait" },
        { url: photo("landscape"), alt: "Landscape" },
        { url: photo("square"), alt: "Square" },
        { url: photo("cutout-white"), alt: "Cut-out on white" },
        { url: photo("off-centre"), alt: "Off-centre subject" },
        { url: photo("bedroom-wide"), alt: "Very wide room" },
        { url: photo("detail-tall"), alt: "Very tall detail" },
        { url: photo("charger-small"), alt: "Small odd photo" },
        { url: photo("vase-square"), alt: "Another square" },
      ],
      specifications: {
        Dimensions: "W 200 × D 45 × H 180 cm (W 78.7 × D 17.7 × H 70.9 in), assembled; flat-packed in 4 boxes",
        Materials: "Solid European oak (FSC), recycled powder-coated steel, soft-close runners",
        "Care instructions for the oak and the steel frame": "Dust with a dry cloth; re-oil the oak once a year",
        Weight: "86 kg",
        Warranty: "10 years",
        SKU: "NW-STOR-OAK-200-SMK-0042-2026",
      },
      shippingCopy: "Two-person delivery to your room of choice; we call 48 hours before to agree a time slot.",
      price: "£1,249.00",
      compareAtPrice: "£1,599.00",
      galleryEnabled: true,
      showBuyNow: true,
      option: { id: "size", name: "Size and finish", values: [
        { id: "a", label: "120 cm, natural" }, { id: "b", label: "160 cm, natural" }, { id: "c", label: "200 cm, natural" },
        { id: "d", label: "120 cm, smoked oak with black steel" }, { id: "e", label: "160 cm, smoked oak with black steel", soldOut: true }, { id: "f", label: "200 cm, smoked oak with black steel" },
        { id: "g", label: "XS" }, { id: "h", label: "240 cm, white" }, { id: "i", label: "Custom size (we will call you)" },
      ] },
    },
    collection: { title: "Everything we sell for living rooms, bedrooms, offices and gardens", description: `${longParagraph} ${longParagraph}`, imageUrl: photo("bedroom-wide") },
    page: { title: "Delivery, returns, warranty and everything else you might want to know before ordering", intro: longParagraph, heading: "A very long heading that a merchant wrote as a full sentence because that is what felt natural", body: `${longParagraph} ${longParagraph}`, bullets: ["Short", "A much longer bullet point that wraps onto a second line on phones and probably on tablets too", "Another"] },
    searchQuery: "solid oak storage unit with drawers",
    cart: { m1: 3, m7: 12, m2: 1, m3: 2 },
    ratings: { m1: { average: 4.3, count: 1284 }, m2: { average: 1, count: 1 }, m3: { average: 5, count: 3 }, m6: { average: 3.5, count: 27 } },
    compareSpecifications: {
      m1: { Width: "200 cm", Material: "Oak and steel", Weight: "86 kg" },
      m3: { Width: "160 cm", "Power supply": "UK plug, 2 m cable", Weight: "12 kg" },
    },
  };
}
