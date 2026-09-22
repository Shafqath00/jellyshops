import type { CollectionPresentationContext, ProductPresentationContext, PublicProduct, StorefrontPageContext } from "@jelly/storefront-renderer";
import type { StorefrontTemplateType, ArticleResource, BlogResource, CatalogAdminCollectionDetail, DemoCatalog, PageResource } from "./api/types";
import type { ConfiguredOptionSelection, Product } from "@/lib/domain";
import { createProductPresentationContext } from "@/features/storefront/product-presentation";

function collectionPresentation(detail: CatalogAdminCollectionDetail): CollectionPresentationContext {
  const products = detail.products.filter((product) => product.storeId === detail.storeId).map((product): PublicProduct => {
    const priceMinor = product.variants[0]?.priceMinor;
    return {
      id: product.id, name: product.title, href: `/products/${product.handle}`,
      imageUrl: product.media[0]?.url ?? "",
      price: priceMinor === undefined ? "" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(priceMinor / 100),
    };
  });
  return { collection: { id: detail.id, title: detail.title, description: detail.description }, products, totalProducts: products.length };
}

export interface EditorPreviewContent {
  pages: PageResource[];
  blogs: BlogResource[];
  articles: ArticleResource[];
}

function publicProducts(catalog: DemoCatalog): PublicProduct[] {
  return catalog.products.map((product) => ({
    id: product.id,
    name: product.name,
    href: `/products/${product.slug}`,
    imageUrl: product.imageUrl,
    price: new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency }).format(product.priceMinor / 100),
  }));
}

export interface EditorProductPreviewRuntime {
  selections: ConfiguredOptionSelection[];
  quantity: number;
  onSelectionsChange(selections: ConfiguredOptionSelection[]): void;
  onQuantityChange(quantity: number): void;
}

function previewProductPresentation(product: Product, runtime: EditorProductPreviewRuntime, relatedProducts: PublicProduct[]): ProductPresentationContext {
  return createProductPresentationContext({
    product, currency: "USD", selections: runtime.selections, quantity: runtime.quantity,
    onSelectionsChange: runtime.onSelectionsChange, onQuantityChange: runtime.onQuantityChange,
    // Editor preview deliberately exercises the same delegated contract without mutating a shopper cart.
    onAddToCart: async () => ({ ok: false, message: "Cart changes are disabled in editor preview" }),
    relatedProducts,
  });
}

function resource<T extends { id: string }>(items: T[], id: string | undefined): T | null {
  if (id) return items.find((item) => item.id === id) ?? null;
  return items[0] ?? null;
}

export function editorPreviewResourceOptions(
  type: StorefrontTemplateType | undefined,
  catalog: DemoCatalog,
  content: EditorPreviewContent,
): Array<{ id: string; label: string }> {
  switch (type) {
    case "product": return catalog.products.map((product) => ({ id: product.id, label: product.name }));
    case "collection": return catalog.collections.map((collection) => ({ id: collection.id, label: collection.name }));
    case "page": return content.pages.map((page) => ({ id: page.id, label: page.title }));
    case "blog": return content.blogs.map((blog) => ({ id: blog.id, label: blog.title }));
    case "article": return content.articles.flatMap((article) => {
      const blog = content.blogs.find((entry) => entry.id === article.blogId);
      return blog ? [{ id: article.id, label: `${article.title} — ${blog.title}` }] : [];
    });
    default: return [];
  }
}

export function createEditorPreviewPageContext({
  type,
  resourceId,
  storeId,
  catalog,
  content,
  searchQuery,
  productDetail,
  productRuntime,
  collectionDetail,
}: {
  type: StorefrontTemplateType;
  resourceId?: string;
  storeId: string;
  catalog: DemoCatalog;
  content: EditorPreviewContent;
  searchQuery: string;
  productDetail?: Product | null;
  productRuntime?: EditorProductPreviewRuntime;
  collectionDetail?: CatalogAdminCollectionDetail | null;
}): StorefrontPageContext | null {
  if (type === "home") return { pageType: "home", resource: null };
  if (type === "cart") return { pageType: "cart", resource: null };
  if (type === "search") {
    const query = searchQuery.trim();
    const results = publicProducts(catalog).filter((product) => product.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    return {
      pageType: "search",
      resource: null,
      data: { query, state: !query ? "empty" : results.length ? "results" : "none", resultCount: results.length, results },
    };
  }
  if (type === "product") {
    if (!productDetail || !productRuntime || productDetail.id !== resourceId) return null;
    return { pageType: "product", resource: { id: productDetail.id, handle: productDetail.slug, data: { title: productDetail.name, product: productDetail, productPresentation: previewProductPresentation(productDetail, productRuntime, publicProducts(catalog).filter((product) => product.id !== productDetail.id)) } } };
  }
  if (type === "collection") {
    if (!collectionDetail || collectionDetail.id !== resourceId || collectionDetail.storeId !== storeId) return null;
    const presentation = collectionPresentation(collectionDetail);
    return {
      pageType: "collection",
      resource: {
        id: collectionDetail.id,
        handle: collectionDetail.handle,
        data: {
          collectionPresentation: presentation,
          collection: { id: collectionDetail.id, storeId, name: collectionDetail.title, slug: collectionDetail.handle },
          products: presentation.products,
        },
      },
    };
  }
  if (type === "page") {
    const page = resource(content.pages, resourceId);
    return page ? { pageType: "page", resource: { id: page.id, handle: page.handle, data: { title: page.title, content: page.content ?? {} } } } : null;
  }
  if (type === "blog") {
    const blog = resource(content.blogs, resourceId);
    return blog ? {
      pageType: "blog",
      resource: {
        id: blog.id,
        handle: blog.handle,
        data: { blog, articles: content.articles.filter((article) => article.blogId === blog.id) },
      },
    } : null;
  }
  const article = resource(content.articles, resourceId);
  const blog = article ? content.blogs.find((entry) => entry.id === article.blogId) : undefined;
  return article && blog
    ? { pageType: "article", resource: { id: article.id, handle: article.handle, data: { blog, article } } }
    : null;
}
