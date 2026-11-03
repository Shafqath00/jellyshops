import type { PublicProduct, StorefrontPageContext } from "@jelly/storefront-renderer";
import type { PageType } from "@jelly/storefront-schema";

/**
 * Sample store data for previews and tests: a few products and a page context for each page type,
 * so sections that need a product, a collection, a cart or an article have something to draw.
 */
export interface SampleOptions {
  /** Address of the n-th sample picture (1-based). Defaults to example.com addresses. */
  image?: (n: number) => string;
}

const defaultImage = (n: number) => `https://images.example.com/p${n}.jpg`;

export function sampleProducts(options: SampleOptions = {}): PublicProduct[] {
  const image = options.image ?? defaultImage;
  return [1, 2, 3, 4].map((n) => ({ id: `p${n}`, name: `Product ${n}`, href: `#product-${n}`, imageUrl: image(n), price: `£${10 * n}.00`, ...(n === 2 ? { compareAtPrice: "£30.00" } : {}) }));
}

export function samplePageContext(pageType: PageType, options: SampleOptions = {}): StorefrontPageContext {
  const image = options.image ?? defaultImage;
  const products = sampleProducts(options);
  const product = {
    id: "p1", title: "Sample product", vendor: "Sample Store", description: "A sample product for previews.",
    imageUrl: image(1), media: [1, 2, 3].map((n) => ({ id: `m${n}`, url: image(n), altText: `Sample product view ${n}` })),
    specifications: { Material: "Cotton", Origin: "Portugal" }, shippingCopy: "Free delivery on orders over £50.",
    options: [{ id: "size", name: "Size", required: true, values: [{ id: "s", label: "Small", selected: false, available: true }, { id: "m", label: "Medium", selected: false, available: true }, { id: "l", label: "Large", selected: false, available: false }] }],
  };
  const none = { pageType, resource: null } as StorefrontPageContext;
  switch (pageType) {
    case "product":
      return { pageType, resource: { id: "p1", handle: "sample", data: { title: product.title, productPresentation: { product, selection: [], quantity: 1, pricing: { price: "£10.00" }, availability: { state: "selection-required", message: "Choose a size" }, canAddToCart: false, selectOption() {}, setQuantity() {}, addToCart: async () => ({ ok: true }), buyNow: async () => ({ ok: true }), relatedProducts: products } } } } as unknown as StorefrontPageContext;
    case "collection":
      return { pageType, resource: { id: "c1", handle: "sample", data: { collectionPresentation: { collection: { id: "c1", title: "Sample collection", description: "A sample collection.", imageUrl: image(2) }, products, totalProducts: products.length } } } } as unknown as StorefrontPageContext;
    case "search":
      return { pageType, resource: null, data: { query: "shirt", state: "results", resultCount: products.length, results: products, searchHref: "#search" } } as unknown as StorefrontPageContext;
    case "cart":
      return { pageType, resource: null, data: { lines: [], subtotal: "£0.00", shippingNote: "", checkoutHref: "#checkout", shopHref: "#shop" } } as unknown as StorefrontPageContext;
    case "page":
      return { pageType, resource: { id: "about", handle: "about", data: { title: "About", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "About this store." }] }] } } } } as unknown as StorefrontPageContext;
    case "blog":
      return { pageType, resource: { id: "news", handle: "news", data: { storeSlug: "sample", blog: { title: "Journal", handle: "news" }, articles: [{ id: "a1", title: "Spring edit", handle: "spring", excerpt: "New colours.", publishedAt: "2026-03-12T00:00:00Z" }] } } } as unknown as StorefrontPageContext;
    case "article":
      return { pageType, resource: { id: "a1", handle: "spring", data: { article: { title: "Spring edit", excerpt: "New colours.", content: { text: "Body" }, publishedAt: "2026-03-12T00:00:00Z" } } } } as unknown as StorefrontPageContext;
    default:
      return none;
  }
}
