import type { QuickViewProduct, StorefrontQuickViewAccess } from "@jelly/storefront-renderer";
import type { Currency, Product } from "@/lib/domain";
import { productCardData, setChoicesFor } from "./product-card-data";

const PHOTO_URL = /^(https:\/\/|\/)[^\s"'<>]+$/;

/** A product's photos in order: its media by position, else its main photo. */
export function quickViewImages(product: Pick<Product, "imageUrl" | "media">): string[] {
  const media = [...(product.media ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((item) => item.url).filter((url): url is string => typeof url === "string" && PHOTO_URL.test(url));
  const all = media.length ? media : product.imageUrl ? [product.imageUrl] : [];
  return [...new Set(all)].slice(0, 6);
}

/** The first paragraph of the description, cut to about 220 characters on a word. */
export function quickViewSummary(description: string | undefined): string | undefined {
  const paragraph = (description ?? "").split(/\n\s*\n/).map((part) => part.replace(/\s+/g, " ").trim()).find(Boolean);
  if (!paragraph) return undefined;
  if (paragraph.length <= 220) return paragraph;
  return `${paragraph.slice(0, 220).replace(/\s+\S*$/, "")}…`;
}

/** Quick view data for the live store, built from the store's published products already in the browser. */
export function quickViewAccess(products: Product[], storeSlug: string, currency: Currency, ratings?: Record<string, { average: number; count: number }>): StorefrontQuickViewAccess {
  return {
    load(productId) {
      const product = products.find((item) => item.id === productId && item.published && !item.archived);
      if (!product) return null;
      const card = productCardData(product, `/${storeSlug}/products/${product.slug}`, currency);
      const view: QuickViewProduct = { ...card, ...setChoicesFor(product, currency), images: quickViewImages(product), summary: quickViewSummary(product.description) };
      if (!view.rating && ratings?.[product.id]) view.rating = ratings[product.id];
      return view;
    },
  };
}
