import type { PublicProduct } from "@jelly/storefront-renderer";
import type { Product } from "@/lib/domain";
import type { Collection } from "@/lib/domain";
import { formatMoney, type Currency } from "@/lib/domain";
import type { PublicSearchPageContext } from "./public-page-context-api";
import type { SearchRouteContext } from "./resource-loader";

export type StorefrontPageContext =
  | { type: "collection"; collection: Collection; products: PublicProduct[] }
  | { type: "search"; query: string; resultCount?: number; results: Array<{ id: string }>; state: "empty" | "results" | "none" | "error" };

export interface CollectionPageContextReader {
  findCollection(handle: string): Promise<Collection | null>;
  listProducts(collectionId: string): Promise<Product[]>;
}

export function createCollectionPageContext(
  collection: Collection,
  catalogProducts: Product[],
  currency: Currency = "USD",
): Extract<StorefrontPageContext, { type: "collection" }> {
  const products = catalogProducts
    .filter((product) => product.storeId === collection.storeId && product.published && !product.archived && product.collectionIds?.includes(collection.id))
    .map((product): PublicProduct => ({
      id: product.id,
      name: product.name,
      href: `/products/${product.slug}`,
      imageUrl: product.imageUrl,
      price: product.variants[0] ? formatMoney(product.variants[0].priceMinor, currency) : "",
    }));
  return { type: "collection", collection, products };
}

export async function loadCollectionPageContext(
  reader: CollectionPageContextReader,
  handle: string,
  currency: Currency = "USD",
): Promise<Extract<StorefrontPageContext, { type: "collection" }> | null> {
  const collection = await reader.findCollection(handle);
  if (!collection) return null;
  return createCollectionPageContext(collection, await reader.listProducts(collection.id), currency);
}

export interface SearchPageContextReader {
  search(query: string): Promise<Array<{ id: string }>>;
}

export async function loadSearchPageContext(
  reader: SearchPageContextReader,
  rawQuery: string,
): Promise<Extract<StorefrontPageContext, { type: "search" }>> {
  const query = rawQuery.trim();
  if (!query) return { type: "search", query, results: [], state: "empty" };
  try {
    const results = await reader.search(query);
    return { type: "search", query, results, state: results.length ? "results" : "none" };
  } catch {
    return { type: "search", query, results: [], state: "error" };
  }
}

export function createSearchPageContext(
  context: PublicSearchPageContext,
  storeSlug: string,
  currency: Currency,
): SearchRouteContext {
  return {
    type: "search",
    query: context.query,
    state: context.state,
    resultCount: context.resultCount,
    results: context.results.map((product): PublicProduct => ({
      id: product.id,
      name: product.title,
      href: `/${storeSlug}/products/${product.handle}`,
      imageUrl: product.imageUrl ?? "",
      price: formatMoney(product.priceMinor, currency),
    })),
  };
}
