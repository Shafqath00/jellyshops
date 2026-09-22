import { describe, expect, it, vi } from "vitest";
import { createEditorPreviewPageContext } from "./preview-context";
import type { Product } from "@/lib/domain";
import { createCollectionPageContext } from "@/features/storefront/page-context-loaders";

const catalog = {
  products: [{ id: "product-1", slug: "classic-cake", name: "Classic Cake", imageUrl: "cake.jpg", priceMinor: 2500, currency: "USD" as const }],
  collections: [{ id: "collection-1", slug: "cakes", name: "Cakes", imageUrl: "", productIds: ["product-1"] }],
};

const content = {
  pages: [{ id: "page-1", title: "Our story", handle: "our-story", content: { blocks: [{ text: "Made locally" }] }, seoTitle: null, seoDescription: null, socialMediaId: null, noindex: false, canonicalOverride: null }],
  blogs: [{ id: "blog-1", title: "Journal", handle: "journal" }],
  articles: [{ id: "article-1", blogId: "blog-1", title: "Baking notes", handle: "baking-notes", excerpt: "Fresh ideas", content: { text: "Mix gently" }, seoTitle: null, seoDescription: null, socialMediaId: null, noindex: false, canonicalOverride: null }],
};

const productDetail: Product = {
  id: "product-1", storeId: "store-a", name: "Classic Cake", slug: "classic-cake", description: "Made locally", category: "Cake", imageUrl: "cake.jpg", media: [{ id: "cake-image", url: "cake.jpg" }], vendor: "Jelly Bakery", published: true, archived: false, featured: false,
  options: [{ id: "size", name: "Size", type: "variant", display: "buttons", required: true, position: 0, values: [{ id: "small", label: "Small", priceAdjustmentMinor: 0, position: 0 }, { id: "large", label: "Large", priceAdjustmentMinor: 0, position: 1 }] }], inventoryOptionIds: ["size"],
  variants: [{ id: "small", name: "Small", sku: "CAKE-S", priceMinor: 2500, compareAtPriceMinor: 3000, stock: 3, options: { size: "small" } }, { id: "large", name: "Large", sku: "CAKE-L", priceMinor: 3500, stock: 0, options: { size: "large" } }],
};

const productRuntime = { selections: [{ optionId: "size", valueId: "small" }], quantity: 2, onSelectionsChange: () => undefined, onQuantityChange: () => undefined };

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
    expect(createEditorPreviewPageContext({ type: "product", resourceId: "product-1", storeId: "store-a", catalog, content, searchQuery: "cake", productDetail, productRuntime })).toMatchObject({
      pageType: "product", resource: { id: "product-1", handle: "classic-cake", data: { title: "Classic Cake", productPresentation: { product: { title: "Classic Cake", media: [{ id: "cake-image" }] }, selection: [{ valueId: "small" }], quantity: 2, pricing: { compareAtPrice: "$30.00" }, availability: { state: "available" } } } },
    });
    expect(createEditorPreviewPageContext({ type: "collection", resourceId: "collection-1", storeId: "store-a", catalog, content, searchQuery: "cake" })).toBeNull();
  });

  it("uses the shared live Product contract for option selection, unavailable variants, quantity, and safe preview purchase", async () => {
    const onSelectionsChange = vi.fn();
    const onQuantityChange = vi.fn();
    const context = createEditorPreviewPageContext({
      type: "product", resourceId: "product-1", storeId: "store-a", catalog, content, searchQuery: "cake", productDetail,
      productRuntime: { selections: [{ optionId: "size", valueId: "large" }], quantity: 9, onSelectionsChange, onQuantityChange },
    });
    const presentation = context?.pageType === "product" ? context.resource.data.productPresentation as { availability: { state: string }; quantity: number; selectOption(id: string, value: string): void; setQuantity(quantity: number): void; addToCart(): Promise<{ ok: boolean; message?: string }> } : null;

    expect(presentation).toMatchObject({ availability: { state: "out-of-stock" }, quantity: 1 });
    presentation?.selectOption("size", "small");
    presentation?.setQuantity(99);
    expect(onSelectionsChange).toHaveBeenCalledWith([{ optionId: "size", valueId: "small" }]);
    expect(onQuantityChange).toHaveBeenCalledWith(1);
    await expect(presentation?.addToCart()).resolves.toEqual({ ok: false, message: "Out of stock" });

    const available = createEditorPreviewPageContext({ type: "product", resourceId: "product-1", storeId: "store-a", catalog, content, searchQuery: "cake", productDetail, productRuntime });
    expect(available?.pageType).toBe("product");
    const availablePresentation = (available as unknown as { resource: { data: { productPresentation: { addToCart(): Promise<{ ok: boolean; message?: string }> } } } }).resource.data.productPresentation;
    await expect(availablePresentation.addToCart()).resolves.toEqual({ ok: false, message: "Cart changes are disabled in editor preview" });
  });

  it("returns no context for a resource template without a current-store selection", () => {
    expect(createEditorPreviewPageContext({ type: "article", resourceId: "missing", storeId: "store-a", catalog, content, searchQuery: "cake" })).toBeNull();
  });

  it("uses selected current-store Collection detail with live products and no fabricated image", () => {
    const context = createEditorPreviewPageContext({
      type: "collection", resourceId: "collection-1", storeId: "store-a", catalog, content, searchQuery: "cake",
      collectionDetail: { id: "collection-1", storeId: "store-a", handle: "cakes", title: "Real cakes", description: "Fresh every day", productIds: ["product-1"], products: [
        { id: "product-1", storeId: "store-a", handle: "classic-cake", title: "Classic Cake", description: "", productType: "Cake", status: "ACTIVE", media: [{ id: "image", url: "/real-cake.jpg", altText: null, position: 0 }], variants: [{ id: "variant-1", title: "Standard", sku: null, priceMinor: 2500, quantity: 3, available: true }], available: true },
      ] },
    });

    expect(context).toMatchObject({ pageType: "collection", resource: { id: "collection-1", data: { collectionPresentation: {
      collection: { id: "collection-1", title: "Real cakes", description: "Fresh every day" },
      products: [{ id: "product-1", name: "Classic Cake", imageUrl: "/real-cake.jpg", price: "$25.00" }], totalProducts: 1,
    } } } });
    const presentation = context?.pageType === "collection" ? context.resource.data.collectionPresentation as { collection: { imageUrl?: string } } : null;
    expect(presentation?.collection.imageUrl).toBeUndefined();
  });

  it("matches public Collection presentation semantics for the same live catalog facts", () => {
    const detail = { id: "collection-1", storeId: "store-a", handle: "cakes", title: "Real cakes", description: "Fresh every day", productIds: ["product-1"], products: [
      { id: "product-1", storeId: "store-a", handle: "classic-cake", title: "Classic Cake", description: "", productType: "Cake", status: "ACTIVE" as const, media: [{ id: "image", url: "/real-cake.jpg", altText: null, position: 0 }], variants: [{ id: "variant-1", title: "Standard", sku: null, priceMinor: 2500, quantity: 3, available: true }], available: true },
    ] };
    const preview = createEditorPreviewPageContext({ type: "collection", resourceId: detail.id, storeId: "store-a", catalog, content, searchQuery: "", collectionDetail: detail });
    const previewPresentation = preview?.pageType === "collection" ? preview.resource.data.collectionPresentation : null;
    const publicContext = createCollectionPageContext(
      { id: detail.id, storeId: detail.storeId, name: detail.title, slug: detail.handle, description: detail.description },
      [{ id: "product-1", storeId: "store-a", name: "Classic Cake", slug: "classic-cake", description: "", category: "Cake", imageUrl: "/real-cake.jpg", published: true, archived: false, featured: false, collectionIds: ["collection-1"], variants: [{ id: "variant-1", name: "Standard", sku: "", priceMinor: 2500, stock: 3 }] }],
      "USD",
    );
    expect(previewPresentation).toMatchObject({
      collection: { id: publicContext.collection.id, title: publicContext.collection.name, description: publicContext.collection.description },
      products: publicContext.products, totalProducts: publicContext.products.length,
    });
  });

  it("keeps absent authoritative Collection metadata compatible in editor and public contexts", () => {
    const detail = { id: "collection-1", storeId: "store-a", handle: "cakes", title: "Cakes", description: "", productIds: [], products: [] };
    const preview = createEditorPreviewPageContext({ type: "collection", resourceId: detail.id, storeId: "store-a", catalog, content, searchQuery: "", collectionDetail: detail });
    const editorCollection = preview?.pageType === "collection" ? (preview.resource.data.collectionPresentation as { collection: Record<string, unknown> }).collection : null;
    const publicContext = createCollectionPageContext({ id: detail.id, storeId: detail.storeId, name: detail.title, slug: detail.handle }, [], "USD");

    expect(publicContext.collection).not.toHaveProperty("description");
    expect(publicContext.collection).not.toHaveProperty("imageUrl");
    expect(editorCollection).toEqual({ id: publicContext.collection.id, title: publicContext.collection.name, description: "" });
  });
});
