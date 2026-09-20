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

export interface CatalogVariant {
  id: string;
  productId: string;
  externalId: string | null;
  title: string;
  sku: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  options: Record<string, unknown>;
  trackInventory: boolean;
  quantity: number | null;
  reserved: number | null;
  available: boolean;
}

export interface CatalogProduct {
  id: string;
  storeId: string;
  externalId: string | null;
  handle: string;
  title: string;
  description: string;
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

export interface Connection<T> {
  nodes: T[];
  nextCursor: string | null;
}

export interface ListProductsInput {
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
  options?: Record<string, unknown>;
  trackInventory?: boolean;
  quantity?: number | null;
  reserved?: number | null;
}

export interface CreateProductInput {
  handle: string;
  title: string;
  description?: string;
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
  handle?: string;
  title?: string;
  description?: string;
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
