import type { PublicProduct } from "@jelly/storefront-renderer";

export interface PublicCollectionContextResource {
  id: string;
  handle: string;
  title: string;
  visible: boolean;
}

export type StorefrontPageContext =
  | { type: "collection"; collection: PublicCollectionContextResource; products: PublicProduct[] }
  | { type: "search"; query: string; results: Array<{ id: string }>; state: "empty" | "results" | "none" | "error" };

export interface CollectionPageContextReader {
  findCollection(handle: string): Promise<PublicCollectionContextResource | null>;
  listProducts(collectionId: string): Promise<PublicProduct[]>;
}

export async function loadCollectionPageContext(
  reader: CollectionPageContextReader,
  handle: string,
): Promise<Extract<StorefrontPageContext, { type: "collection" }> | null> {
  const collection = await reader.findCollection(handle);
  if (!collection?.visible) return null;
  return { type: "collection", collection, products: await reader.listProducts(collection.id) };
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
