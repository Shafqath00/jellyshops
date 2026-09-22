import { describe, expect, it } from "vitest";
import { createSearchPageContext, loadCollectionPageContext, loadSearchPageContext } from "./page-context-loaders";
import type { Collection, Product } from "@/lib/domain";

describe("V4 page-context loaders", () => {
  it("loads a visible collection together with its live products", async () => {
    const context = await loadCollectionPageContext({
      findCollection: async (handle) => handle === "summer" ? { id: "collection-1", storeId: "store-1", slug: handle, name: "Summer" } : null,
      listProducts: async () => [{ id: "product-1", storeId: "store-1", name: "Lemon cake", slug: "lemon-cake", description: "", category: "", imageUrl: "/lemon.jpg", published: true, archived: false, featured: false, variants: [], collectionIds: ["collection-1"] }],
    }, "summer");

    expect(context).toMatchObject({ type: "collection", collection: { id: "collection-1", slug: "summer" }, products: [{ id: "product-1" }] });
  });

  it("normalizes an empty search query into a runtime-only empty state", async () => {
    const context = await loadSearchPageContext({ search: async () => [{ id: "product-1" }] }, "   ");
    expect(context).toEqual({ type: "search", query: "", results: [], state: "empty" });
  });

  it("adapts validated public Search results into renderer-only product cards", () => {
    expect(createSearchPageContext({ type: "search", query: "shoes", state: "results", resultCount: 1, results: [{ id: "shoe", handle: "classic-shoe", title: "Classic shoe", description: "Light", imageUrl: "shoe.jpg", priceMinor: 1200 }] }, "store-a", "USD")).toEqual({
      type: "search", query: "shoes", state: "results", resultCount: 1,
      results: [{ id: "shoe", name: "Classic shoe", href: "/store-a/products/classic-shoe", imageUrl: "shoe.jpg", price: "$12.00" }],
    });
  });
});

describe("catalog-backed Collection context", () => {
  const collection: Collection = { id: "collection-1", storeId: "store-1", name: "Summer", slug: "summer" };
  const product = (id: string, overrides: Partial<Product> = {}): Product => ({ id, storeId: "store-1", name: id, slug: id, description: "", category: "", imageUrl: "", published: true, archived: false, featured: false, variants: [], ...overrides });

  it("resolves only a current-store collection slug and its live visible members", async () => {
    const context = await loadCollectionPageContext({
      findCollection: async (handle) => handle === "summer" ? collection : null,
      listProducts: async () => [product("member", { collectionIds: ["collection-1"] }), product("outside"), product("archived", { collectionIds: ["collection-1"], archived: true }), product("draft", { collectionIds: ["collection-1"], published: false })],
    }, "summer");
    expect(context?.products.map((entry) => entry.id)).toEqual(["member"]);
    expect(context?.collection).not.toHaveProperty("description");
  });

  it("returns null for a collection that cannot be found in the current store", async () => {
    await expect(loadCollectionPageContext({ findCollection: async () => null, listProducts: async () => [] }, "other-store")).resolves.toBeNull();
  });
});
