import type {
  CatalogCollection,
  CatalogProduct,
  CatalogVariant,
  Connection,
  ListCollectionsInput,
  ListProductsInput,
} from "./types.js";

export interface CatalogRepository {
  getProduct(storeId: string, id: string): Promise<CatalogProduct | null>;
  listProducts(storeId: string, input: ListProductsInput): Promise<Connection<CatalogProduct>>;
  getVariant(storeId: string, id: string): Promise<CatalogVariant | null>;
  getCollection(storeId: string, id: string): Promise<CatalogCollection | null>;
  listCollections(storeId: string, input: ListCollectionsInput): Promise<Connection<CatalogCollection>>;
}
