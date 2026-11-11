import { expect, it, vi } from "vitest";
import { browseUrl, fetchCatalogPage } from "./catalog-browse-api";

it("puts only the chosen parts of the query in the address", () => {
  const url = new URL(browseUrl("https://api.test/", "store a", { collectionId: "beds", sort: "price-asc", inStock: true, minPriceMinor: 10000, filters: { size: ["King"], fabric: [] }, filterNames: ["Size", "Fabric"], offset: 24, limit: 12 }));
  expect(url.pathname).toBe("/api/public/stores/store%20a/catalog/browse");
  expect(Object.fromEntries(url.searchParams)).toEqual({ collectionId: "beds", sort: "price-asc", inStock: "true", min: "10000", filter: JSON.stringify({ size: ["King"] }), filterNames: "Size,Fabric", offset: "24", limit: "12" });
  expect(new URL(browseUrl("https://api.test", "s", { sort: "featured" })).search).toBe("?limit=12");
});

it("turns the answer into product cards", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({
    nodes: [{ id: "p1", storeId: "s", handle: "oslo", title: "Oslo bed", description: "", specifications: {}, vendor: null, productType: "Bed", tags: [], status: "ACTIVE", available: true,
      media: [{ id: "m", url: "/api/public/media/s/m", position: 0, altText: null }], variants: [{ id: "v1", title: "Double", priceMinor: 25000, available: true, quantity: 2, options: {} }], priceRange: { minMinor: 25000, maxMinor: 25000, currency: "GBP" }, options: [] }],
    total: 1, facets: [], price: null, filtered: false,
  }), { status: 200 }));
  const page = await fetchCatalogPage("s", "shop", "GBP", { limit: 12 }, fetcher as unknown as typeof fetch);
  expect(page.total).toBe(1);
  expect(page.products[0]).toMatchObject({ id: "p1", name: "Oslo bed", href: "/shop/products/oslo", price: "£250.00" });
  expect(page.products[0].imageUrl).toMatch(/^https?:\/\/.+\/api\/public\/media\/s\/m$/);
});
