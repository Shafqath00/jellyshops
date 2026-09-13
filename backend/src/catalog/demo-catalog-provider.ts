import type { CatalogReader } from "./service.js";
import type {
  CatalogCollection,
  CatalogProduct,
  CatalogResource,
  CatalogResourceRef,
  CatalogVariant,
  Connection,
  DemoCatalog,
  DemoCollection,
  DemoProduct,
  ListCollectionsInput,
  ListProductsInput,
} from "./types.js";

const productNames = [
  ["strawberry", "Strawberry Jelly"],
  ["blueberry", "Blueberry Jelly"],
  ["mango", "Mango Jelly"],
  ["grape", "Grape Jelly"],
  ["peach", "Peach Jelly"],
  ["raspberry", "Raspberry Jelly"],
  ["orange", "Orange Marmalade"],
  ["apple", "Apple Jelly"],
] as const;

const products: DemoProduct[] = productNames.map(([slug, name], index) => ({
  id: `product-${slug}`,
  slug,
  name,
  imageUrl: `/demo/products/${slug}.svg`,
  priceMinor: 900 + index * 125,
  currency: "USD",
}));

const collections: DemoCollection[] = [
  { id: "collection-fruit", slug: "fruit-favorites", name: "Fruit Favorites", imageUrl: "/demo/collections/fruit.svg", productIds: products.slice(0, 4).map(({ id }) => id) },
  { id: "collection-bright", slug: "bright-flavors", name: "Bright Flavors", imageUrl: "/demo/collections/bright.svg", productIds: [products[2].id, products[4].id, products[6].id, products[7].id] },
  { id: "collection-all", slug: "all-jellies", name: "All Jellies", imageUrl: "/demo/collections/all.svg", productIds: products.map(({ id }) => id) },
];

export function getDemoCatalog(): DemoCatalog {
  return structuredClone({ products, collections });
}

function canonicalProduct(storeId: string, product: DemoProduct): CatalogProduct {
  const variant: CatalogVariant = {
    id: `${product.id}-default`,
    externalId: null,
    title: "Default",
    sku: null,
    priceMinor: product.priceMinor,
    compareAtPriceMinor: null,
    options: {},
    trackInventory: false,
    quantity: null,
    reserved: null,
    available: true,
  };
  return {
    id: product.id,
    storeId,
    externalId: null,
    handle: product.slug,
    title: product.name,
    description: "",
    vendor: null,
    productType: null,
    tags: [],
    status: "ACTIVE",
    media: [{
      id: `${product.id}-image`,
      url: product.imageUrl,
      mimeType: "image/svg+xml",
      width: null,
      height: null,
      altText: product.name,
      position: 0,
    }],
    variants: [variant],
    priceRange: { minMinor: product.priceMinor, maxMinor: product.priceMinor, currency: product.currency },
    available: true,
  };
}

function canonicalCollection(storeId: string, collection: DemoCollection): CatalogCollection {
  return {
    id: collection.id,
    storeId,
    externalId: null,
    handle: collection.slug,
    title: collection.name,
    description: "",
    productIds: [...collection.productIds],
  };
}

function page<T extends { id: string }>(nodes: T[], input: { cursor?: string; limit: number }): Connection<T> {
  const afterCursor = input.cursor ? nodes.filter(({ id }) => id > input.cursor!) : nodes;
  const selected = afterCursor.slice(0, input.limit);
  return {
    nodes: selected,
    nextCursor: afterCursor.length > input.limit ? selected.at(-1)?.id ?? null : null,
  };
}

export class DemoCatalogAdapter implements CatalogReader {
  async getProduct(storeId: string, id: string): Promise<CatalogProduct | null> {
    const product = products.find((item) => item.id === id);
    return product ? canonicalProduct(storeId, product) : null;
  }

  async listProducts(storeId: string, input: ListProductsInput): Promise<Connection<CatalogProduct>> {
    const nodes = products
      .map((item) => canonicalProduct(storeId, item))
      .filter((item) => !input.query || item.title.toLowerCase().includes(input.query.toLowerCase()) || item.handle.includes(input.query))
      .filter((item) => !input.collectionId || collections.find(({ id }) => id === input.collectionId)?.productIds.includes(item.id));
    return page(nodes, input);
  }

  listPublicProducts(storeId: string, input: Omit<ListProductsInput, "status">): Promise<Connection<CatalogProduct>> {
    return this.listProducts(storeId, { ...input, status: "ACTIVE" });
  }

  async getVariant(storeId: string, id: string): Promise<CatalogVariant | null> {
    for (const item of products) {
      const product = canonicalProduct(storeId, item);
      const variant = product.variants.find((candidate) => candidate.id === id);
      if (variant) return variant;
    }
    return null;
  }

  async getCollection(storeId: string, id: string): Promise<CatalogCollection | null> {
    const collection = collections.find((item) => item.id === id);
    return collection ? canonicalCollection(storeId, collection) : null;
  }

  async listCollections(storeId: string, input: ListCollectionsInput): Promise<Connection<CatalogCollection>> {
    const nodes = collections
      .map((item) => canonicalCollection(storeId, item))
      .filter((item) => !input.query || item.title.toLowerCase().includes(input.query.toLowerCase()) || item.handle.includes(input.query));
    return page(nodes, input);
  }

  async resolveResource(storeId: string, ref: CatalogResourceRef): Promise<CatalogResource | null> {
    switch (ref.type) {
      case "product": return this.getProduct(storeId, ref.id);
      case "variant": return this.getVariant(storeId, ref.id);
      case "collection": return this.getCollection(storeId, ref.id);
    }
  }
}
