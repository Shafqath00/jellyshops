import { assertDistinctVariantChoices } from "./postgres-repository.js";
import { assertMediaInput } from "./product-media.js";
import { resolveProductDescription } from "./product-description.js";

/** Two products in a store cannot share a URL handle; say so plainly instead of reporting a database error. */
function handleConflict(error: unknown): never {
  const failure = error as { code?: string; constraint?: string; message?: string };
  if (failure?.code === "23505" && /slug/i.test(`${failure.constraint ?? ""} ${failure.message ?? ""}`)) throw new ApiError(409, "HANDLE_TAKEN", "Another product already uses this URL handle. Choose a different one.");
  throw error;
}
import { ApiError } from "../http/errors.js";
import { assertValidProductConfiguration } from "./product-configuration.js";
import type { CatalogRepository, CatalogWriter } from "./repository.js";
import type {
  CatalogCollection,
  CatalogCollectionDetail,
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
  getCollection(storeId: string, id: string): Promise<CatalogCollectionDetail | null>;
  listCollections(storeId: string, input: ListCollectionsInput): Promise<Connection<CatalogCollection>>;
  resolveResource(storeId: string, ref: CatalogResourceRef): Promise<CatalogResource | null>;
}

export interface CatalogAdmin extends CatalogReader {
  listInventory(storeId: string, input: import("./types.js").ListInventoryInput): Promise<Connection<import("./types.js").CatalogInventoryRow>>;
  updateInventory(storeId: string, variantId: string, input: import("./types.js").UpdateInventoryInput): Promise<import("./types.js").CatalogInventoryRow>;
  listInventoryHistory(storeId: string, variantId: string, input: import("./types.js").ListInventoryHistoryInput): Promise<Connection<import("./types.js").InventoryAdjustment>>;
  listProductFacets(storeId: string): Promise<import("./types.js").ProductFacets>;
  findProducts(storeId: string, by: { handles?: string[]; ids?: string[] }): Promise<CatalogProduct[]>;
  findSkuOwners(storeId: string, skus: string[]): Promise<Array<{ sku: string; productId: string; handle: string }>>;
  createProduct(storeId: string, input: CreateProductInput): Promise<CatalogProduct>;
  updateProduct(storeId: string, productId: string, input: UpdateProductInput): Promise<CatalogProduct>;
  createCollection(storeId: string, input: CreateCollectionInput): Promise<CatalogCollection>;
  updateCollection(storeId: string, collectionId: string, input: UpdateCollectionInput): Promise<CatalogCollection>;
}

export class CatalogService implements CatalogReader {
  listInventory(storeId: string, input: import("./types.js").ListInventoryInput) {
    assertLimit(input.limit);
    if (!this.repository.listInventory) throw new ApiError(503,"INVENTORY_UNAVAILABLE","Stock management is unavailable.");
    return this.repository.listInventory(storeId,input);
  }
  listInventoryHistory(storeId: string, variantId: string, input: import("./types.js").ListInventoryHistoryInput) {
    assertLimit(input.limit);
    if (!this.repository.listInventoryHistory) throw new ApiError(503,"INVENTORY_UNAVAILABLE","Stock management is unavailable.");
    return this.repository.listInventoryHistory(storeId,variantId,input);
  }
  updateInventory(storeId: string, variantId: string, input: import("./types.js").UpdateInventoryInput) {
    const writer=this.requireWriter();
    if (!writer.updateInventory) throw new ApiError(503,"INVENTORY_UNAVAILABLE","Stock management is unavailable.");
    return writer.updateInventory(storeId,variantId,input);
  }
  constructor(
    private readonly repository: CatalogRepository,
    private readonly writer?: CatalogWriter,
  ) {}

  getProduct(storeId: string, id: string): Promise<CatalogProduct | null> {
    return this.repository.getProduct(storeId, id);
  }

  async findProducts(storeId: string, by: { handles?: string[]; ids?: string[] }): Promise<CatalogProduct[]> {
    if (!this.repository.findProducts) throw new ApiError(503, "CATALOG_BULK_UNAVAILABLE", "Bulk product tools are not available for this store.");
    return this.repository.findProducts(storeId, by);
  }

  async findSkuOwners(storeId: string, skus: string[]): Promise<Array<{ sku: string; productId: string; handle: string }>> {
    if (!this.repository.findSkuOwners) throw new ApiError(503, "CATALOG_BULK_UNAVAILABLE", "Bulk product tools are not available for this store.");
    return this.repository.findSkuOwners(storeId, skus);
  }

  /** A catalogue that cannot list them (the demo one) simply has none. */
  async listProductFacets(storeId: string): Promise<import("./types.js").ProductFacets> {
    return this.repository.listProductFacets ? this.repository.listProductFacets(storeId) : { productTypes: [], vendors: [], tags: [] };
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
    const page = await this.repository.listProducts(storeId, { ...input, status: "ACTIVE" });
    // Internal cost and stock thresholds are merchant-only data.
    return { ...page, nodes: page.nodes.map((product) => ({ ...product, variants: product.variants.map(({ costMinor: _cost, lowStockThreshold: _threshold, ...variant }) => variant) })) };
  }

  getVariant(storeId: string, id: string): Promise<CatalogVariant | null> {
    return this.repository.getVariant(storeId, id);
  }

  getCollection(storeId: string, id: string): Promise<CatalogCollectionDetail | null> {
    return this.repository.getCollection(storeId, id);
  }

  async listCollections(storeId: string, input: ListCollectionsInput): Promise<Connection<CatalogCollection>> {
    assertLimit(input.limit);
    return this.repository.listCollections(storeId, input);
  }

  async createProduct(storeId: string, input: CreateProductInput): Promise<CatalogProduct> {
    assertDistinctVariantChoices(input.variants);
    assertMediaInput(input);
    assertValidProductConfiguration(input);
    return this.requireWriter().createProduct(storeId, resolveProductDescription(input)).catch(handleConflict);
  }

  async updateProduct(storeId: string, productId: string, input: UpdateProductInput): Promise<CatalogProduct> {
    assertMediaInput(input);
    assertDistinctVariantChoices(input.variants);
    // An update may leave the choices untouched; validate what it sends against what is stored.
    if (input.options !== undefined || input.inventoryOptionIds !== undefined || input.variants !== undefined) {
      const existing = await this.repository.getProduct(storeId, productId);
      assertValidProductConfiguration(input, existing ?? undefined);
    }
    return this.requireWriter().updateProduct(storeId, productId, resolveProductDescription(input)).catch(handleConflict);
  }

  async createCollection(storeId: string, input: CreateCollectionInput): Promise<CatalogCollection> {
    return this.requireWriter().createCollection(storeId, resolveProductDescription(input, "collection"));
  }

  async updateCollection(storeId: string, collectionId: string, input: UpdateCollectionInput): Promise<CatalogCollection> {
    return this.requireWriter().updateCollection(storeId, collectionId, resolveProductDescription(input, "collection"));
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
