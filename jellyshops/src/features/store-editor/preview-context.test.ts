import { describe, expect, it } from "vitest";
import { createEditorPreviewPageContext } from "./preview-context";

const catalog = {
  products: [{ id: "product-1", slug: "classic-cake", name: "Classic Cake", imageUrl: "cake.jpg", priceMinor: 2500, currency: "USD" as const }],
  collections: [{ id: "collection-1", slug: "cakes", name: "Cakes", imageUrl: "", productIds: ["product-1"] }],
};

const content = {
  pages: [{ id: "page-1", title: "Our story", handle: "our-story", content: { blocks: [{ text: "Made locally" }] }, seoTitle: null, seoDescription: null, socialMediaId: null, noindex: false, canonicalOverride: null }],
  blogs: [{ id: "blog-1", title: "Journal", handle: "journal" }],
  articles: [{ id: "article-1", blogId: "blog-1", title: "Baking notes", handle: "baking-notes", excerpt: "Fresh ideas", content: { text: "Mix gently" }, seoTitle: null, seoDescription: null, socialMediaId: null, noindex: false, canonicalOverride: null }],
};

describe("createEditorPreviewPageContext", () => {
  it("builds page, blog, and article contexts from current-store content", () => {
    expect(createEditorPreviewPageContext({ type: "page", resourceId: "page-1", storeId: "store-a", catalog, content, searchQuery: "cake" })).toMatchObject({
      pageType: "page", resource: { id: "page-1", handle: "our-story", data: { title: "Our story" } },
    });
    expect(createEditorPreviewPageContext({ type: "blog", resourceId: "blog-1", storeId: "store-a", catalog, content, searchQuery: "cake" })).toMatchObject({
      pageType: "blog", resource: { id: "blog-1", data: { blog: { title: "Journal" }, articles: [{ id: "article-1" }] } },
    });
    expect(createEditorPreviewPageContext({ type: "article", resourceId: "article-1", storeId: "store-a", catalog, content, searchQuery: "cake" })).toMatchObject({
      pageType: "article", resource: { id: "article-1", data: { blog: { id: "blog-1" }, article: { title: "Baking notes" } } },
    });
  });

  it("uses draft-only search query state without a persisted resource", () => {
    expect(createEditorPreviewPageContext({ type: "search", storeId: "store-a", catalog, content, searchQuery: "cake" })).toEqual({
      pageType: "search", resource: null, data: expect.objectContaining({ query: "cake", state: "results", resultCount: 1, results: expect.arrayContaining([expect.objectContaining({ id: "product-1", name: "Classic Cake" })]) }),
    });
  });

  it("covers Home, Product, Collection, and Cart with shared renderer contexts", () => {
    expect(createEditorPreviewPageContext({ type: "home", storeId: "store-a", catalog, content, searchQuery: "cake" })).toEqual({ pageType: "home", resource: null });
    expect(createEditorPreviewPageContext({ type: "cart", storeId: "store-a", catalog, content, searchQuery: "cake" })).toEqual({ pageType: "cart", resource: null });
    expect(createEditorPreviewPageContext({ type: "product", resourceId: "product-1", storeId: "store-a", catalog, content, searchQuery: "cake" })).toMatchObject({
      pageType: "product", resource: { id: "product-1", handle: "classic-cake", data: { title: "Classic Cake" } },
    });
    expect(createEditorPreviewPageContext({ type: "collection", resourceId: "collection-1", storeId: "store-a", catalog, content, searchQuery: "cake" })).toMatchObject({
      pageType: "collection", resource: { id: "collection-1", handle: "cakes", data: { collection: { storeId: "store-a", name: "Cakes" }, products: [expect.objectContaining({ id: "product-1" })] } },
    });
  });

  it("returns no context for a resource template without a current-store selection", () => {
    expect(createEditorPreviewPageContext({ type: "article", resourceId: "missing", storeId: "store-a", catalog, content, searchQuery: "cake" })).toBeNull();
  });
});
