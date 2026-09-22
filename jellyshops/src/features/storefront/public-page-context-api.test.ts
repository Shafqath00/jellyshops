import { expect, it, vi } from "vitest";
import { loadPublicArticleContext, loadPublicBlogContext, loadPublicPageContext, loadPublicSearchPageContext } from "./public-page-context-api";

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

it("loads a validated Blog with only its public Article summaries", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ type: "blog", blog: { id: "blog-a", handle: "news", title: "News" }, articles: [{ id: "article-a", handle: "opening", title: "Opening", excerpt: "We opened", publishedAt: "2026-09-20T00:00:00.000Z" }] }), { status: 200 }));
  await expect(loadPublicBlogContext({ baseUrl: "http://localhost:3001", storeId: "store-a", handle: "news", fetch: fetcher })).resolves.toMatchObject({ type: "blog", blog: { id: "blog-a" }, articles: [{ id: "article-a" }] });
  expect(fetcher).toHaveBeenCalledWith("http://localhost:3001/api/public/stores/store-a/storefront/context/blogs/news", expect.objectContaining({ cache: "no-store" }));
});

it("loads a validated Article only through its current-store Blog path", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ type: "article", blog: { id: "blog-a", handle: "news", title: "News" }, article: { id: "article-a", handle: "opening", title: "Opening", excerpt: "We opened", content: { text: "Hello" }, publishedAt: "2026-09-20T00:00:00.000Z" } }), { status: 200 }));
  await expect(loadPublicArticleContext({ baseUrl: "http://localhost:3001", storeId: "store-a", blogHandle: "news", articleHandle: "opening", fetch: fetcher })).resolves.toMatchObject({ type: "article", blog: { id: "blog-a" }, article: { id: "article-a" } });
  expect(fetcher).toHaveBeenCalledWith("http://localhost:3001/api/public/stores/store-a/storefront/context/blogs/news/articles/opening", expect.objectContaining({ cache: "no-store" }));
});
