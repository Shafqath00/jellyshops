import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { browsableProduct, createCatalogBrowser, MAX_BROWSE_PRODUCTS } from "./browse.js";
import { createPublicCatalogRouter } from "./routes.js";
import type { CatalogProduct, Connection, ListProductsInput } from "./types.js";

function bed(id: string, title: string, priceMinor: number, extra: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id, storeId: "store-a", externalId: null, handle: id, title, description: "", specifications: {}, vendor: null, productType: "Bed", tags: [], status: "ACTIVE", media: [],
    variants: [{ id: `${id}-v`, priceMinor, options: {} } as unknown as CatalogProduct["variants"][number]],
    priceRange: { minMinor: priceMinor, maxMinor: priceMinor, currency: "GBP" }, available: true, primaryCategoryId: null, additionalCategoryIds: [], brandId: null,
    options: [{ id: "size", name: "Size", values: [{ id: "double", label: "Double" }, { id: "king", label: "King" }] }],
    ...extra,
  } as CatalogProduct;
}

const beds = [
  bed("ascot", "Ascot ottoman bed", 28900, { tags: ["Fabric:Velvet", "label:Bestseller"] }),
  bed("bowen", "Bowen divan bed", 19900, { tags: ["Fabric:Boucle"], available: false }),
  bed("cleo", "Cleo bed frame", 34900, { tags: ["Fabric:Velvet"], options: [{ id: "size", name: "Size", values: [{ id: "king", label: "King" }, { id: "super", label: "Super king" }] }] }),
  bed("dale", "Dale storage bed", 45900, { tags: ["fabric:linen"] }),
];

function fakeReader(products: CatalogProduct[], pageSize = 100) {
  return {
    listPublicProducts: vi.fn(async (_storeId: string, input: Omit<ListProductsInput, "status">): Promise<Connection<CatalogProduct>> => {
      const start = input.cursor ? Number(input.cursor) : 0;
      const nodes = products.slice(start, start + Math.min(pageSize, input.limit));
      return { nodes, nextCursor: start + nodes.length < products.length ? String(start + nodes.length) : null };
    }),
  };
}

describe("catalog browser", () => {
  it("reads filters from options, Name:Value tags and type, but not label tags", () => {
    const filters = browsableProduct(beds[0]).filters;
    expect(filters).toEqual([{ name: "Size", values: ["Double", "King"] }, { name: "Fabric", values: ["Velvet"] }, { name: "Type", values: ["Bed"] }]);
  });

  it("filters, counts, sorts and pages one collection", async () => {
    const reader = fakeReader(beds);
    const browser = createCatalogBrowser(reader);
    const result = await browser.browse("store-a", { collectionId: "beds", filters: { fabric: ["velvet", "Linen"] }, sort: "price-desc", limit: 2 });
    expect(result.nodes.map((node) => node.id)).toEqual(["dale", "cleo"]);
    expect(result.total).toBe(3);
    const fabric = result.facets.find((facet) => facet.key === "fabric")!;
    // A filter's own counts ignore its choices, so other fabrics can still be added.
    expect(fabric.values).toEqual([{ value: "Velvet", count: 2, selected: true }, { value: "Boucle", count: 1, selected: false }, { value: "linen", count: 1, selected: true }]);
    const size = result.facets.find((facet) => facet.key === "size")!;
    expect(size.values.find((value) => value.value === "Super king")).toMatchObject({ count: 1 });
    // Type has one value only, so it is not offered.
    expect(result.facets.map((facet) => facet.key)).toEqual(["size", "fabric"]);
    expect(result.price).toEqual({ minMinor: 19900, maxMinor: 45900 });
    expect(result.filtered).toBe(true);
    expect(reader.listPublicProducts).toHaveBeenCalledWith("store-a", expect.objectContaining({ collectionId: "beds", limit: 100 }));
  });

  it("applies stock and price choices and keeps the list for 30 seconds", async () => {
    let clock = 0;
    const reader = fakeReader(beds);
    const browser = createCatalogBrowser(reader, () => clock);
    const result = await browser.browse("store-a", { inStock: true, maxPriceMinor: 35000 });
    expect(result.nodes.map((node) => node.id)).toEqual(["ascot", "cleo"]);
    await browser.browse("store-a", { offset: 2 });
    expect(reader.listPublicProducts).toHaveBeenCalledTimes(1);
    clock = 31_000;
    await browser.browse("store-a", {});
    expect(reader.listPublicProducts).toHaveBeenCalledTimes(2);
  });

  it("reads every page of a large list and stops at the cap", async () => {
    const many = Array.from({ length: MAX_BROWSE_PRODUCTS + 50 }, (_, index) => bed(`p${index}`, `Bed ${index}`, 10000 + index));
    const reader = fakeReader(many);
    const result = await createCatalogBrowser(reader).browse("store-a", { limit: 48, offset: 1990 });
    expect(result.total).toBe(MAX_BROWSE_PRODUCTS);
    expect(result.nodes).toHaveLength(10);
    expect(result.truncated).toBe(true);
    expect(reader.listPublicProducts).toHaveBeenCalledTimes(20);
  });

  it("serves the browse route and refuses bad queries", async () => {
    const app = express();
    app.use("/api/public/stores/:storeId/catalog", createPublicCatalogRouter({ ...fakeReader(beds), listCollections: vi.fn() } as never));
    app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => { response.status(400).json({ error: String(error) }); });
    const ok = await request(app).get("/api/public/stores/store-a/catalog/browse").query({ filter: JSON.stringify({ Size: ["Super king"] }), limit: "12" });
    expect(ok.status).toBe(200);
    expect(ok.body.nodes.map((node: CatalogProduct) => node.id)).toEqual(["cleo"]);
    expect(ok.body.facets[0]).toMatchObject({ key: "size", label: "Size" });
    expect((await request(app).get("/api/public/stores/store-a/catalog/browse").query({ limit: "500" })).status).toBe(400);
    expect((await request(app).get("/api/public/stores/store-a/catalog/browse").query({ sort: "random" })).status).toBe(400);
  });
});
