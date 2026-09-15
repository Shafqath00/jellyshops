import type { CatalogRepository, CatalogWriter } from "./repository.js";
import type {
  CatalogCollection,
  CatalogProduct,
  CatalogResource,
  CatalogResourceRef,
  CatalogVariant,
  Connection,
  CreateCollectionInput,
  CreateProductInput,
  ListCollectionsInput,
  ListProductsInput,
  UpdateCollectionInput,
  UpdateProductInput,
} from "./types.js";

function assertLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Catalog list limit must be an integer between 1 and 100");
  }
}

export interface CatalogReader {
  getProduct(storeId: string, id: string): Promise<CatalogProduct | null>;
  listProducts(storeId: string, input: ListProductsInput): Promise<Connection<CatalogProduct>>;
  listPublicProducts(storeId: string, input: Omit<ListProductsInput, "status">): Promise<Connection<CatalogProduct>>;
  getVariant(storeId: string, id: string): Promise<CatalogVariant | null>;
  getCollection(storeId: string, id: string): Promise<CatalogCollection | null>;
  listCollections(storeId: string, input: ListCollectionsInput): Promise<Connection<CatalogCollection>>;
  resolveResource(storeId: string, ref: CatalogResourceRef): Promise<CatalogResource | null>;
}

export interface CatalogAdmin extends CatalogReader {
  createProduct(storeId: string, input: CreateProductInput): Promise<CatalogProduct>;
  updateProduct(storeId: string, productId: string, input: UpdateProductInput): Promise<CatalogProduct>;
  createCollection(storeId: string, input: CreateCollectionInput): Promise<CatalogCollection>;
  updateCollection(storeId: string, collectionId: string, input: UpdateCollectionInput): Promise<CatalogCollection>;
}

export class CatalogService implements CatalogReader {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly writer?: CatalogWriter,
  ) {}

  getProduct(storeId: string, id: string): Promise<CatalogProduct | null> {
    return this.repository.getProduct(storeId, id);
  }

  async listProducts(storeId: string, input: ListProductsInput): Promise<Connection<CatalogProduct>> {
    assertLimit(input.limit);
    return this.repository.listProducts(storeId, input);
  }

  async listPublicProducts(
    storeId: string,
    input: Omit<ListProductsInput, "status">,
  ): Promise<Connection<CatalogProduct>> {
    assertLimit(input.limit);
    return this.repository.listProducts(storeId, { ...input, status: "ACTIVE" });
  }

  getVariant(storeId: string, id: string): Promise<CatalogVariant | null> {
    return this.repository.getVariant(storeId, id);
  }

  getCollection(storeId: string, id: string): Promise<CatalogCollection | null> {
    return this.repository.getCollection(storeId, id);
  }

  async listCollections(storeId: string, input: ListCollectionsInput): Promise<Connection<CatalogCollection>> {
    assertLimit(input.limit);
    return this.repository.listCollections(storeId, input);
  }

  createProduct(storeId: string, input: CreateProductInput): Promise<CatalogProduct> {
    return this.requireWriter().createProduct(storeId, input);
  }

  updateProduct(storeId: string, productId: string, input: UpdateProductInput): Promise<CatalogProduct> {
    return this.requireWriter().updateProduct(storeId, productId, input);
  }

  createCollection(storeId: string, input: CreateCollectionInput): Promise<CatalogCollection> {
    return this.requireWriter().createCollection(storeId, input);
  }

  updateCollection(storeId: string, collectionId: string, input: UpdateCollectionInput): Promise<CatalogCollection> {
    return this.requireWriter().updateCollection(storeId, collectionId, input);
  }

  async resolveResource(storeId: string, ref: CatalogResourceRef): Promise<CatalogResource | null> {
    switch (ref.type) {
      case "product":
        return this.getProduct(storeId, ref.id);
      case "variant":
        return this.getVariant(storeId, ref.id);
      case "collection":
        return this.getCollection(storeId, ref.id);
    }
  }

  private requireWriter(): CatalogWriter {
    if (!this.writer) throw new Error("Catalog write operations are unavailable for this adapter");
    return this.writer;
  }
}
