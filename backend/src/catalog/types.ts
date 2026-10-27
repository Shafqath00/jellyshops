export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

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
  description: string;
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
  options?: Record<string, unknown>;
  trackInventory?: boolean;
  quantity?: number | null;
  reserved?: number | null;
}

export interface CreateProductInput {
  imageUrl?: string;
  handle: string;
  title: string;
  description?: string;
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
  handle?: string;
  title?: string;
  description?: string;
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
  productIds?: string[];
}

export interface UpdateCollectionInput {
  handle?: string;
  title?: string;
  description?: string;
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
