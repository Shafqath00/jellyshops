export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

/** Out and low are measured against what shoppers can still buy: on hand minus held by active checkouts. */
export type StockStatus = "untracked" | "out" | "low" | "in_stock";
/** Used when the merchant has not chosen a threshold for a variant. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 3;
export function stockStatusOf(trackInventory: boolean, quantity: number | null, reserved: number, lowStockThreshold: number | null): StockStatus {
  if (!trackInventory || quantity === null) return "untracked";
  const available = Math.max(0, quantity - reserved);
  if (available <= 0) return "out";
  return available <= (lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD) ? "low" : "in_stock";
}

export interface CatalogInventoryRow {
  productId: string; variantId: string; productTitle: string; variantTitle: string; sku: string | null;
  barcode: string | null; lowStockThreshold: number | null; stockStatus: StockStatus;
  trackInventory: boolean; quantity: number | null; reserved: number; availableQuantity: number | null; revision: string | null;
}
export interface ListInventoryInput { query?: string; cursor?: string; limit: number }
/** `note` and `actor` describe a manual change and are written to the stock history. */
export interface UpdateInventoryInput { quantity: number; expectedRevision: string; note?: string; actor?: string }

export type InventoryAdjustmentReason = "initial" | "sale" | "restock" | "manual";
export interface InventoryAdjustment {
  id: string; quantityDelta: number; quantityAfter: number; reason: InventoryAdjustmentReason;
  note: string | null; actor: string | null; createdAt: string;
}
export interface ListInventoryHistoryInput { cursor?: string; limit: number }

/** A requested stock hold; availability is decided by conditional SQL writes. */
export interface CatalogInventoryQuantity {
  variantId: string;
  quantity: number;
}

export interface CatalogMedia {
  id: string;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  position: number;
  appliesTo?: Record<string, string[]>;
  originalName?: string;
}

/** "Total 500 g, show the price per 100 g". Both units must measure the same thing. */
export interface UnitPricing { totalAmount: number; totalUnit: string; baseAmount: number; baseUnit: string }

export interface CatalogVariant {
  id: string;
  productId: string;
  externalId: string | null;
  title: string;
  sku: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  /** Internal cost per item; never exposed on the public storefront. */
  costMinor?: number | null;
  unitPricing?: UnitPricing | null;
  /** Merchant-chosen code (GTIN, UPC, ...) used to find the variant; not validated beyond length. */
  barcode?: string | null;
  /** Warn when what is still available drops to this number or below; null uses the default. Merchant-only. */
  lowStockThreshold?: number | null;
  /** Packed weight in grams and size in millimetres. For fulfilment and customs; shipping is still a flat rate. */
  weightGrams?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  /** ISO 3166-1 alpha-2, upper case. */
  countryOfOrigin?: string | null;
  /** Harmonized System code, digits only (6 to 10). */
  hsCode?: string | null;
  /** False once the merchant stops selling this combination; it is then reported as unavailable. */
  sellable?: boolean;
  /** The product photo shown first for this combination; always one of the product's own photos. */
  mediaId?: string | null;
  options: Record<string, unknown>;
  trackInventory: boolean;
  quantity: number | null;
  reserved: number | null;
  available: boolean;
}

export interface CatalogProduct {
  fulfillmentType?: "PHYSICAL" | "DIGITAL";
  id: string;
  storeId: string;
  externalId: string | null;
  handle: string;
  title: string;
  /** Plain text, derived from descriptionDoc when there is one. Used for search, SEO and emails. */
  description: string;
  /** Rich text document the merchant edited; null for plain-text descriptions. */
  descriptionDoc?: import("@jelly/storefront-schema").RichTextDocument | null;
  /** Page title for search engines; the storefront falls back to the product title when empty. */
  seoTitle?: string | null;
  /** Page description for search engines; the storefront falls back to the start of the description. */
  seoDescription?: string | null;
  specifications: Record<string, string>;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  status: ProductStatus;
  media: CatalogMedia[];
  variants: CatalogVariant[];
  priceRange: {
    minMinor: number;
    maxMinor: number;
    currency: string;
  } | null;
  available: boolean;
  primaryCategoryId: string | null;
  additionalCategoryIds: string[];
  brandId: string | null;
  collectionIds: string[];
  options: unknown[];
  inventoryOptionIds: string[];
  categoryMetadata: unknown | null;
  brandMetadata: unknown | null;
  collectionMetadata: unknown[];
}

export interface CatalogCollection {
  id: string;
  storeId: string;
  externalId: string | null;
  handle: string;
  title: string;
  description: string;
  /** Rich text document the merchant edited; null for plain-text descriptions. */
  descriptionDoc?: import("@jelly/storefront-schema").RichTextDocument | null;
  productIds: string[];
}

/** Read-only detail projection; collection membership and products stay live catalog data. */
export interface CatalogCollectionDetail extends CatalogCollection {
  products: CatalogProduct[];
}

export interface Connection<T> {
  nodes: T[];
  nextCursor: string | null;
}

export interface ListProductsInput {
  categoryId?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  available?: boolean;
  variantOptions?: Record<string, string>;
  sort?: "id" | "newest" | "price-asc" | "price-desc" | "title-asc" | "best-selling";
  query?: string;
  collectionId?: string;
  status?: ProductStatus;
  cursor?: string;
  limit: number;
}

export interface ListCollectionsInput {
  query?: string;
  cursor?: string;
  limit: number;
}

export interface CatalogVariantInput {
  id?: string;
  title: string;
  sku?: string | null;
  priceMinor: number;
  compareAtPriceMinor?: number | null;
  costMinor?: number | null;
  unitPricing?: UnitPricing | null;
  barcode?: string | null;
  lowStockThreshold?: number | null;
  weightGrams?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  countryOfOrigin?: string | null;
  hsCode?: string | null;
  sellable?: boolean;
  mediaId?: string | null;
  options?: Record<string, unknown>;
  trackInventory?: boolean;
  quantity?: number | null;
  reserved?: number | null;
}

export interface CatalogMediaInput {
  mediaId: string;
  altText?: string | null;
  appliesTo?: Record<string, string[]>;
}

export interface CreateProductInput {
  imageUrl?: string;
  media?: CatalogMediaInput[];
  handle: string;
  title: string;
  description?: string;
  /** Untrusted rich text; the service normalizes it and derives `description` from it. */
  descriptionDoc?: unknown | null;
  /** DIGITAL products are delivered as files and are never shipped. */
  fulfillmentType?: "PHYSICAL" | "DIGITAL";
  seoTitle?: string | null;
  seoDescription?: string | null;
  specifications?: Record<string, string>;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[];
  status?: ProductStatus;
  variants?: CatalogVariantInput[];
  primaryCategoryId?: string | null;
  additionalCategoryIds?: string[];
  brandId?: string | null;
  collectionIds?: string[];
  options?: unknown[];
  inventoryOptionIds?: string[];
  categoryMetadata?: unknown | null;
  brandMetadata?: unknown | null;
  collectionMetadata?: unknown[];
}

export interface UpdateProductInput {
  imageUrl?: string;
  media?: CatalogMediaInput[];
  handle?: string;
  title?: string;
  description?: string;
  descriptionDoc?: unknown | null;
  fulfillmentType?: "PHYSICAL" | "DIGITAL";
  seoTitle?: string | null;
  seoDescription?: string | null;
  specifications?: Record<string, string>;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[];
  status?: ProductStatus;
  variants?: CatalogVariantInput[];
  primaryCategoryId?: string | null;
  additionalCategoryIds?: string[];
  brandId?: string | null;
  collectionIds?: string[];
  options?: unknown[];
  inventoryOptionIds?: string[];
  categoryMetadata?: unknown | null;
  brandMetadata?: unknown | null;
  collectionMetadata?: unknown[];
}

export interface CreateCollectionInput {
  handle: string;
  title: string;
  description?: string;
  /** Untrusted rich text; the service normalizes it and derives `description` from it. */
  descriptionDoc?: unknown | null;
  productIds?: string[];
}

export interface UpdateCollectionInput {
  handle?: string;
  title?: string;
  description?: string;
  descriptionDoc?: unknown | null;
  productIds?: string[];
}

export type CatalogResourceRef =
  | { type: "product"; id: string }
  | { type: "variant"; id: string }
  | { type: "collection"; id: string };

export type CatalogResource = CatalogProduct | CatalogVariant | CatalogCollection;

export interface DemoProduct {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  priceMinor: number;
  currency: "USD";
}

export interface DemoCollection {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  productIds: string[];
}

export interface DemoCatalog {
  products: DemoProduct[];
  collections: DemoCollection[];
}
