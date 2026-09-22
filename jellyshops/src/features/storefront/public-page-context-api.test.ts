import { expect, it, vi } from "vitest";
import { loadPublicPageContext, loadPublicSearchPageContext } from "./public-page-context-api";

it("loads a validated anonymous public search context", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ type: "search", query: "shoes", state: "none", resultCount: 0, results: [] }), { status: 200 }));
  await expect(loadPublicSearchPageContext({ baseUrl: "http://localhost:3001", storeId: "store-a", query: "shoes", fetch: fetcher })).resolves.toMatchObject({ type: "search", state: "none" });
  expect(fetcher).toHaveBeenCalledWith("http://localhost:3001/api/public/stores/store-a/storefront/context/search?q=shoes", expect.objectContaining({ cache: "no-store" }));
});

it("loads a validated published Page context", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ type: "page", page: { id: "about", handle: "about", title: "About", content: { text: "Hello" }, publishedAt: null } }), { status: 200 }));
  await expect(loadPublicPageContext({ baseUrl: "http://localhost:3001", storeId: "store-a", handle: "about", fetch: fetcher })).resolves.toMatchObject({ type: "page", page: { id: "about" } });
  expect(fetcher).toHaveBeenCalledWith("http://localhost:3001/api/public/stores/store-a/storefront/context/pages/about", expect.objectContaining({ cache: "no-store" }));
});
