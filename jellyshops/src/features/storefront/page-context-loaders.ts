import type { PublicProduct } from "@jelly/storefront-renderer";
import type { Product } from "@/lib/domain";
import type { Collection } from "@/lib/domain";

export type StorefrontPageContext =
  | { type: "collection"; collection: Collection; products: PublicProduct[] }
  | { type: "search"; query: string; results: Array<{ id: string }>; state: "empty" | "results" | "none" | "error" };

export interface CollectionPageContextReader {
  findCollection(handle: string): Promise<Collection | null>;
  listProducts(collectionId: string): Promise<Product[]>;
}

export function createCollectionPageContext(
  collection: Collection,
  catalogProducts: Product[],
): Extract<StorefrontPageContext, { type: "collection" }> {
  const products = catalogProducts
    .filter((product) => product.published && !product.archived && product.collectionIds?.includes(collection.id))
    .map((product): PublicProduct => ({
      id: product.id,
      name: product.name,
      href: `/products/${product.slug}`,
      imageUrl: product.imageUrl,
      price: String(product.variants[0]?.priceMinor ?? 0),
    }));
  return { type: "collection", collection, products };
}

export async function loadCollectionPageContext(
  reader: CollectionPageContextReader,
  handle: string,
): Promise<Extract<StorefrontPageContext, { type: "collection" }> | null> {
  const collection = await reader.findCollection(handle);
  if (!collection) return null;
  return createCollectionPageContext(collection, await reader.listProducts(collection.id));
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
