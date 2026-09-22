import { expect, it, vi } from "vitest";
import { loadPublicSearchPageContext } from "./public-page-context-api";

it("loads a validated anonymous public search context", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ type: "search", query: "shoes", state: "none", resultCount: 0, results: [] }), { status: 200 }));
  await expect(loadPublicSearchPageContext({ baseUrl: "http://localhost:3001", storeId: "store-a", query: "shoes", fetch: fetcher })).resolves.toMatchObject({ type: "search", state: "none" });
  expect(fetcher).toHaveBeenCalledWith("http://localhost:3001/api/public/stores/store-a/storefront/context/search?q=shoes", expect.objectContaining({ cache: "no-store" }));
});
