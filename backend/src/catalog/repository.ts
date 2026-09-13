import type {
  CatalogCollection,
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
  getProduct(storeId: string, id: string): Promise<CatalogProduct | null>;
  listProducts(storeId: string, input: ListProductsInput): Promise<Connection<CatalogProduct>>;
  getVariant(storeId: string, id: string): Promise<CatalogVariant | null>;
  getCollection(storeId: string, id: string): Promise<CatalogCollection | null>;
  listCollections(storeId: string, input: ListCollectionsInput): Promise<Connection<CatalogCollection>>;
}

export interface CatalogWriter {
  createProduct(storeId: string, input: CreateProductInput): Promise<CatalogProduct>;
  updateProduct(storeId: string, productId: string, input: UpdateProductInput): Promise<CatalogProduct>;
  createCollection(storeId: string, input: CreateCollectionInput): Promise<CatalogCollection>;
  updateCollection(storeId: string, collectionId: string, input: UpdateCollectionInput): Promise<CatalogCollection>;
}

export type CatalogAdminRepository = CatalogRepository & CatalogWriter;
