import { describe, expect, it } from "vitest";
import { loadCollectionPageContext, loadSearchPageContext } from "./page-context-loaders";

describe("V4 page-context loaders", () => {
  it("loads a visible collection together with its live products", async () => {
    const context = await loadCollectionPageContext({
      findCollection: async (handle) => handle === "summer" ? { id: "collection-1", handle, title: "Summer", visible: true } : null,
      listProducts: async () => [{ id: "product-1", name: "Lemon cake", href: "/products/lemon-cake", imageUrl: "/lemon.jpg", price: "$10" }],
    }, "summer");

    expect(context).toMatchObject({ type: "collection", collection: { id: "collection-1", handle: "summer" }, products: [{ id: "product-1" }] });
  });

  it("normalizes an empty search query into a runtime-only empty state", async () => {
    const context = await loadSearchPageContext({ search: async () => [{ id: "product-1" }] }, "   ");
    expect(context).toEqual({ type: "search", query: "", results: [], state: "empty" });
  });
});
