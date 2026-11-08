import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogRequestError, useAdminCatalog } from "./catalog-api";

const origin = "http://127.0.0.1:5001/project/us-central1/api";
vi.mock("@/features/auth/providers/auth-provider", () => ({
  authApiOrigin: () => "http://127.0.0.1:5001/project/us-central1/api",
  useAuth: () => ({ activeStore: { id: "store-a" }, session: { access_token: "test-token" } }),
}));
afterEach(() => vi.unstubAllGlobals());

describe("admin catalog media URLs", () => {
  it("resolves uploaded covers on every product page against the backend origin", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ nodes: [{ media: [{ url: "/api/public/media/store-a/cover" }] }], nextCursor: "page-2" }))
      .mockResolvedValueOnce(Response.json({ nodes: [{ media: [{ url: "http://localhost:3001/api/public/media/store-a/legacy" }] }], nextCursor: null }));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useAdminCatalog());
    const products = await result.current.all<{ media: { url: string }[] }>("/products");
    expect(products.map(product => product.media[0].url)).toEqual([
      `${origin}/api/public/media/store-a/cover`,
      `${origin}/api/public/media/store-a/legacy`,
    ]);
    expect(fetcher.mock.calls[0][0]).toBe(`${origin}/api/stores/store-a/catalog/products?limit=100`);
    expect(fetcher.mock.calls[1][0]).toContain("cursor=page-2");
  });

  it("resolves a product detail cover while preserving external image URLs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ media: [
      { url: "/api/public/media/store-a/cover?w=320" },
      { url: "https://images.example.com/photo.jpg" },
    ] })));
    const { result } = renderHook(() => useAdminCatalog());
    expect(await result.current.request("/products/product-a")).toEqual({ media: [
      { url: `${origin}/api/public/media/store-a/cover?w=320` },
      { url: "https://images.example.com/photo.jpg" },
    ] });
  });

  it("preserves catalog errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { message: "Product missing" } }, { status: 404 })));
    const { result } = renderHook(() => useAdminCatalog());
    await expect(result.current.request("/products/missing")).rejects.toEqual(new CatalogRequestError("Product missing", 404));
  });
});
