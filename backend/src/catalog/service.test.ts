import { describe, expect, it } from "vitest";
import type { CatalogRepository } from "./repository.js";
import { CatalogService } from "./service.js";
import type { CatalogProduct } from "./types.js";

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "product-1",
    storeId: "store-a",
    externalId: null,
    handle: "cake",
    title: "Cake",
    description: "",
    vendor: null,
    productType: null,
    tags: [],
    status: "ACTIVE",
    media: [],
    variants: [
      {
        id: "variant-1",
        externalId: null,
        title: "Small",
        sku: null,
        priceMinor: 1000,
        compareAtPriceMinor: null,
        options: {},
        trackInventory: true,
        quantity: 4,
        reserved: 1,
        available: true,
      },
      {
        id: "variant-2",
        externalId: null,
        title: "Large",
        sku: null,
        priceMinor: 1500,
        compareAtPriceMinor: null,
        options: {},
        trackInventory: false,
        quantity: null,
        reserved: null,
        available: true,
      },
    ],
    priceRange: { minMinor: 1000, maxMinor: 1500, currency: "USD" },
    available: true,
    ...overrides,
  };
}

function setup(products: CatalogProduct[]) {
  const repository: CatalogRepository = {
    getProduct: async (storeId, id) => products.find((item) => item.storeId === storeId && item.id === id) ?? null,
    listProducts: async (storeId, input) => {
      const filtered = products.filter((item) => item.storeId === storeId && (!input.status || item.status === input.status));
      return { nodes: filtered.slice(0, input.limit), nextCursor: null };
    },
    getVariant: async () => null,
    getCollection: async () => null,
    listCollections: async () => ({ nodes: [], nextCursor: null }),
  };
  return new CatalogService(repository);
}

describe("CatalogService", () => {
  it("keeps reads tenant-scoped", async () => {
    const service = setup([
      product(),
      product({ id: "product-b", storeId: "store-b", handle: "other" }),
    ]);

    await expect(service.getProduct("store-a", "product-b")).resolves.toBeNull();
    await expect(service.getProduct("store-a", "product-1")).resolves.toMatchObject({ id: "product-1" });
  });

  it("lists only active products for public reads", async () => {
    const service = setup([
      product(),
      product({ id: "draft", handle: "draft", status: "DRAFT" }),
      product({ id: "archived", handle: "archived", status: "ARCHIVED" }),
    ]);

    const result = await service.listPublicProducts("store-a", { limit: 20 });

    expect(result.nodes.map(({ id }) => id)).toEqual(["product-1"]);
  });

  it("rejects invalid pagination limits before repository access", async () => {
    const service = setup([product()]);

    await expect(service.listProducts("store-a", { limit: 0 })).rejects.toThrow(/limit/i);
    await expect(service.listProducts("store-a", { limit: 101 })).rejects.toThrow(/limit/i);
  });

  it("preserves canonical price range and availability derived from variants", async () => {
    const service = setup([product()]);

    await expect(service.getProduct("store-a", "product-1")).resolves.toMatchObject({
      priceRange: { minMinor: 1000, maxMinor: 1500, currency: "USD" },
      available: true,
    });
  });
});
