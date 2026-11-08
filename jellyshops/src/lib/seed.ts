import type { Order, Product, ShopState, Store } from "./domain";
import { createDefaultStoreDesign } from "@jelly/storefront-schema";

const sweetBakes: Store = {
  id: "store-sweet-bakes",
  businessId: "business-jelly",
  name: "Sweet Bakes",
  slug: "sweet-bakes",
  tagline: "A softer kind of celebration.",
  description: "Cloud-soft cakes, bright little treats, and hand-finished details baked in Bengaluru.",
  currency: "INR",
  published: true,
  bannerUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1800&q=85",
  shippingMinor: 7900,
  theme: { accent: "#d84f70", accentSoft: "#ffd7df", background: "#fff8f3", surface: "#ffffff", text: "#302328", displayFont: "serif" }
};

const bloomHome: Store = {
  id: "store-bloom-home",
  businessId: "business-jelly",
  name: "Bloom Home",
  slug: "bloom-home",
  tagline: "Small rituals for gentler rooms.",
  description: "Hand-poured scents and quiet objects for everyday spaces.",
  currency: "INR",
  published: true,
  bannerUrl: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=1800&q=85",
  shippingMinor: 9900,
  theme: { accent: "#2d6c5c", accentSoft: "#d9eee7", background: "#f5f4ed", surface: "#ffffff", text: "#25342f", displayFont: "rounded" }
};

const products: Product[] = [
  {
    id: "product-vanilla-cake", storeId: sweetBakes.id, name: "Vanilla Celebration Cake", slug: "vanilla-celebration-cake",
    description: "Vanilla bean sponge, cloud cream, raspberry preserve, and a confetti crown.", category: "Cakes",
    imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=85", published: true, archived: false, featured: true,
    variants: [{ id: "vanilla-cake", name: "1 kg", sku: "SB-CAKE-VAN-1KG", priceMinor: 149900, stock: 9 }]
  },
  {
    id: "product-berry-cloud", storeId: sweetBakes.id, name: "Berry Cloud Bento", slug: "berry-cloud-bento",
    description: "A tiny berry sponge made for two, finished with blush buttercream.", category: "Cakes",
    imageUrl: "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=1200&q=85", published: true, archived: false, featured: true,
    variants: [{ id: "berry-cloud", name: "500 g", sku: "SB-BENTO-BRY", priceMinor: 74900, stock: 3 }]
  },
  {
    id: "product-lemon-tart", storeId: sweetBakes.id, name: "Lemon Joy Tart", slug: "lemon-joy-tart",
    description: "Silky lemon curd in a crisp almond shell with toasted meringue.", category: "Tarts",
    imageUrl: "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&w=1200&q=85", published: true, archived: false, featured: true,
    variants: [{ id: "lemon-tart", name: "6 inch", sku: "SB-TART-LEM", priceMinor: 89900, stock: 7 }]
  },
  {
    id: "product-cookie-box", storeId: sweetBakes.id, name: "Afternoon Cookie Box", slug: "afternoon-cookie-box",
    description: "Six soft-centred cookies: sea salt chocolate, pistachio, and brown butter.", category: "Gifts",
    imageUrl: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1200&q=85", published: true, archived: false, featured: false,
    variants: [{ id: "cookie-box", name: "Box of 6", sku: "SB-COOKIE-6", priceMinor: 59900, stock: 12 }]
  },
  {
    id: "product-meadow-candle", storeId: bloomHome.id, name: "After Rain Candle", slug: "after-rain-candle",
    description: "Wet leaves, cedar, and a trace of wild jasmine in soy wax.", category: "Candles",
    imageUrl: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=1200&q=85", published: true, archived: false, featured: true,
    variants: [{ id: "meadow-candle", name: "220 g", sku: "BH-CAN-RAIN", priceMinor: 109900, stock: 8 }]
  },
  {
    id: "product-linen-spray", storeId: bloomHome.id, name: "Quiet Linen Mist", slug: "quiet-linen-mist",
    description: "A fine mist of lavender leaf, cotton blossom, and pale woods.", category: "Home fragrance",
    imageUrl: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=1200&q=85", published: true, archived: false, featured: true,
    variants: [{ id: "linen-spray", name: "100 ml", sku: "BH-MIST-LIN", priceMinor: 74900, stock: 14 }]
  },
  {
    id: "product-incense", storeId: bloomHome.id, name: "Amber Hour Incense", slug: "amber-hour-incense",
    description: "Slow-burning sticks with amber resin, sandalwood, and orange peel.", category: "Incense",
    imageUrl: "https://images.unsplash.com/photo-1608831540955-35094d48694a?auto=format&fit=crop&w=1200&q=85", published: true, archived: false, featured: false,
    variants: [{ id: "incense", name: "24 sticks", sku: "BH-INC-AMB", priceMinor: 39900, stock: 20 }]
  },
  {
    id: "product-ceramic-tray", storeId: bloomHome.id, name: "Pebble Catchall", slug: "pebble-catchall",
    description: "A hand-glazed oval tray for rings, matches, or tiny daily treasures.", category: "Objects",
    imageUrl: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1200&q=85", published: true, archived: false, featured: true,
    variants: [{ id: "ceramic-tray", name: "Moss glaze", sku: "BH-OBJ-PEB", priceMinor: 89900, stock: 2 }]
  }
];

const orders: Order[] = [
  {
    id: "order-001", number: "JS-1042", storeId: sweetBakes.id, customerId: "customer-aisha",
    customerSnapshot: { name: "Aisha Rao", email: "aisha@example.com", phone: "+91 98765 43210", address: { line1: "18 Richmond Road", city: "Bengaluru", region: "Karnataka", postalCode: "560025", country: "India" } },
    items: [{ productId: "product-berry-cloud", variantId: "berry-cloud", productName: "Berry Cloud Bento", variantName: "500 g", sku: "SB-BENTO-BRY", imageUrl: products[1].imageUrl, unitPriceMinor: 74900, quantity: 1 }],
    subtotalMinor: 74900, shippingMinor: 7900, totalMinor: 82800, currency: "INR", status: "CONFIRMED", paymentStatus: "PAID", paymentId: "mock_seed_1042", inventoryRestored: false, createdAt: "2026-08-30T09:30:00.000Z"
  },
  {
    id: "order-002", number: "JS-1039", storeId: sweetBakes.id, customerId: "customer-aisha",
    customerSnapshot: { name: "Aisha Rao", email: "aisha@example.com", phone: "+91 98765 43210", address: { line1: "18 Richmond Road", city: "Bengaluru", region: "Karnataka", postalCode: "560025", country: "India" } },
    items: [{ productId: "product-cookie-box", variantId: "cookie-box", productName: "Afternoon Cookie Box", variantName: "Box of 6", sku: "SB-COOKIE-6", imageUrl: products[3].imageUrl, unitPriceMinor: 59900, quantity: 2 }],
    subtotalMinor: 119800, shippingMinor: 7900, totalMinor: 127700, currency: "INR", status: "DELIVERED", paymentStatus: "PAID", paymentId: "mock_seed_1039", inventoryRestored: false, createdAt: "2026-08-24T14:15:00.000Z"
  }
];

export function createSeedState(): ShopState {
  const categories = [
    { id: "category-cakes", storeId: sweetBakes.id, name: "Cakes", slug: "cakes" },
    { id: "category-candles", storeId: bloomHome.id, name: "Candles", slug: "candles" },
    { id: "category-fashion", storeId: sweetBakes.id, name: "Fashion", slug: "fashion" },
    { id: "category-clothing", storeId: sweetBakes.id, name: "Clothing", slug: "clothing", parentId: "category-fashion" },
    { id: "category-tshirts", storeId: sweetBakes.id, name: "T-Shirts", slug: "t-shirts", parentId: "category-clothing" },
    { id: "category-furniture", storeId: bloomHome.id, name: "Furniture", slug: "furniture" },
    { id: "category-beds", storeId: bloomHome.id, name: "Beds", slug: "beds", parentId: "category-furniture" },
    { id: "category-divan-beds", storeId: bloomHome.id, name: "Divan Beds", slug: "divan-beds", parentId: "category-beds" },
  ];
  const categoryOptionDefinitions = [
    { id: "template-tshirt-size", storeId: sweetBakes.id, categoryId: "category-tshirts", name: "Size", optionKind: "variant" as const, displayType: "buttons" as const, required: true, position: 0 },
    { id: "template-tshirt-colour", storeId: sweetBakes.id, categoryId: "category-tshirts", name: "Colour", optionKind: "variant" as const, displayType: "color" as const, required: true, position: 1 },
    { id: "template-tshirt-material", storeId: sweetBakes.id, categoryId: "category-tshirts", name: "Material", optionKind: "configuration" as const, displayType: "dropdown" as const, required: false, position: 2 },
    { id: "template-divan-fabric", storeId: bloomHome.id, categoryId: "category-divan-beds", name: "Fabric / Colour", optionKind: "variant" as const, displayType: "color" as const, required: true, position: 0 },
    { id: "template-divan-size", storeId: bloomHome.id, categoryId: "category-divan-beds", name: "Size", optionKind: "variant" as const, displayType: "buttons" as const, required: true, position: 1 },
    { id: "template-divan-storage", storeId: bloomHome.id, categoryId: "category-divan-beds", name: "Storage", optionKind: "configuration" as const, displayType: "buttons" as const, required: false, position: 2 },
    { id: "template-divan-headboard", storeId: bloomHome.id, categoryId: "category-divan-beds", name: "Headboard", optionKind: "configuration" as const, displayType: "buttons" as const, required: false, position: 3 },
    { id: "template-divan-base", storeId: bloomHome.id, categoryId: "category-divan-beds", name: "Base", optionKind: "configuration" as const, displayType: "buttons" as const, required: false, position: 4 },
    { id: "template-divan-mattress", storeId: bloomHome.id, categoryId: "category-divan-beds", name: "Mattress", optionKind: "addon" as const, displayType: "buttons" as const, required: false, position: 5 },
  ];
  return {
    version: 1,
    activeStoreId: sweetBakes.id,
    stores: structuredClone([sweetBakes, bloomHome]),
    products: structuredClone(products),
    categories,
    brands: [],
    collections: [],
    categoryOptionDefinitions,
    customers: [{ id: "customer-aisha", storeId: sweetBakes.id, name: "Aisha Rao", email: "aisha@example.com", phone: "+91 98765 43210", address: { line1: "18 Richmond Road", city: "Bengaluru", region: "Karnataka", postalCode: "560025", country: "India" }, createdAt: "2026-08-24T14:15:00.000Z" }],
    carts: [],
    orders: structuredClone(orders),
    storeDesigns: [sweetBakes, bloomHome].map((store) => ({
      storeId: store.id,
      draftDocument: createDefaultStoreDesign(),
      draftRevision: 1,
      publications: []
    }))
  };
}

/** Browser runtime state: store identity/layout remains local until the API loads; catalog is never demo-seeded. */
export function createRuntimeState(): ShopState {
  const state = createSeedState();
  return { ...state, products: [], customers: [], orders: [] };
}
