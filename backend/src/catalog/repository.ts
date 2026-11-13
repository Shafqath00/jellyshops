import type {
  CatalogCollection,
  CatalogCollectionDetail,
  CatalogProduct,
  CatalogVariant,
  Connection,
  CreateCollectionInput,
  CreateProductInput,
  ListCollectionsInput,
  ListProductsInput,
  UpdateCollectionInput,
  UpdateProductInput,
} from "./types.js";

export interface CatalogRepository {
  listInventory?(storeId: string, input: import("./types.js").ListInventoryInput): Promise<Connection<import("./types.js").CatalogInventoryRow>>;
  listInventoryHistory?(storeId: string, variantId: string, input: import("./types.js").ListInventoryHistoryInput): Promise<Connection<import("./types.js").InventoryAdjustment>>;
  listProductFacets?(storeId: string): Promise<import("./types.js").ProductFacets>;
  /** Products with these handles or ids, in one go (bulk import, export of selected rows). */
  findProducts?(storeId: string, by: { handles?: string[]; ids?: string[] }): Promise<CatalogProduct[]>;
  /** Which product owns each of these SKUs (lower case in, lower case out). */
  findSkuOwners?(storeId: string, skus: string[]): Promise<Array<{ sku: string; productId: string; handle: string }>>;
  getProduct(storeId: string, id: string): Promise<CatalogProduct | null>;
  listProducts(storeId: string, input: ListProductsInput): Promise<Connection<CatalogProduct>>;
  getVariant(storeId: string, id: string): Promise<CatalogVariant | null>;
  getCollection(storeId: string, id: string): Promise<CatalogCollectionDetail | null>;
  listCollections(storeId: string, input: ListCollectionsInput): Promise<Connection<CatalogCollection>>;
}

export interface CatalogWriter {
  updateInventory?(storeId: string, variantId: string, input: import("./types.js").UpdateInventoryInput): Promise<import("./types.js").CatalogInventoryRow>;
  createProduct(storeId: string, input: CreateProductInput): Promise<CatalogProduct>;
  updateProduct(storeId: string, productId: string, input: UpdateProductInput): Promise<CatalogProduct>;
  createCollection(storeId: string, input: CreateCollectionInput): Promise<CatalogCollection>;
  updateCollection(storeId: string, collectionId: string, input: UpdateCollectionInput): Promise<CatalogCollection>;
}

export type CatalogAdminRepository = CatalogRepository & CatalogWriter;
