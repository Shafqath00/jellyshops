import { describe, expect, it, vi } from "vitest";
import type { CatalogReader } from "../../catalog/service.js";
import { PublicStorefrontContextService } from "./service.js";
import type { PublicStorefrontContextRepository } from "./types.js";

function repository(): PublicStorefrontContextRepository {
  return {
    findPublishedPageByHandle: vi.fn(async () => null),
    findBlogByHandle: vi.fn(async () => null),
    listPublishedArticles: vi.fn(async () => []),
    findPublishedArticleByHandles: vi.fn(async () => null),
  };
}

describe("PublicStorefrontContextService", () => {
  it("keeps whitespace search empty without querying the catalog", async () => {
    const catalog = { listPublicProducts: vi.fn() } as unknown as CatalogReader;
    const service = new PublicStorefrontContextService(repository(), catalog);
    await expect(service.search("store-a", "   ")).resolves.toEqual({ type: "search", query: "", state: "empty", resultCount: 0, results: [] });
    expect(catalog.listPublicProducts).not.toHaveBeenCalled();
  });

  it("maps current public catalog results and separates no results", async () => {
    const catalog = { listPublicProducts: vi.fn(async () => ({ nodes: [{ id: "product-a", handle: "shoe", title: "Shoe", description: "Light", media: [{ url: "shoe.jpg" }], priceRange: { minMinor: 1200 } }], nextCursor: null })) } as unknown as CatalogReader;
    const service = new PublicStorefrontContextService(repository(), catalog);
    await expect(service.search("store-a", " shoes ")).resolves.toEqual({ type: "search", query: "shoes", state: "results", resultCount: 1, results: [{ id: "product-a", handle: "shoe", title: "Shoe", description: "Light", imageUrl: "shoe.jpg", priceMinor: 1200 }] });
    expect(catalog.listPublicProducts).toHaveBeenCalledWith("store-a", { query: "shoes", limit: 100 });
  });
});
