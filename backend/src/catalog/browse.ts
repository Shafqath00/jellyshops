import { browseCatalog, productFilterValues, type BrowsableProduct, type CatalogFacet, type CatalogQuery } from "@jelly/storefront-schema";
import type { CatalogReader } from "./service.js";
import type { CatalogProduct } from "./types.js";

/** Most products one list reads (20 pages of 100). Larger lists are cut here and say so (`truncated`). */
export const MAX_BROWSE_PRODUCTS = 2000;
const CACHE_MS = 30_000;
const CACHE_ENTRIES = 200;

export interface BrowseInput extends CatalogQuery {
  collectionId?: string;
  query?: string;
}

export interface BrowseResult {
  nodes: CatalogProduct[];
  total: number;
  facets: CatalogFacet[];
  price: { minMinor: number; maxMinor: number } | null;
  filtered: boolean;
  truncated: boolean;
}

/** What a product brings to filtering: its options, tags, brand and type, cheapest price and stock. */
export function browsableProduct(product: CatalogProduct): BrowsableProduct {
  const prices = product.variants.map((variant) => variant.priceMinor).filter((price) => Number.isFinite(price));
  return {
    name: product.title,
    priceMinor: product.priceRange?.minMinor ?? (prices.length ? Math.min(...prices) : 0),
    available: product.available,
    filters: productFilterValues({ options: product.options, variantOptions: product.variants.map((variant) => variant.options), tags: product.tags, vendor: product.vendor, productType: product.productType }),
  };
}

/**
 * The live store's product list (collection pages, Shop all, search): reads the store's active products once (kept
 * for 30 seconds per collection or search), then filters, counts, sorts and pages them with the shared rules, so a
 * shopper's browser only receives one page of products.
 */
export function createCatalogBrowser(reader: Pick<CatalogReader, "listPublicProducts">, now: () => number = Date.now) {
  const cache = new Map<string, { at: number; products: Array<{ product: CatalogProduct; browsable: BrowsableProduct }>; truncated: boolean }>();

  async function load(storeId: string, collectionId: string | undefined, query: string | undefined) {
    const key = JSON.stringify([storeId, collectionId ?? "", query ?? ""]);
    const cached = cache.get(key);
    if (cached && now() - cached.at < CACHE_MS) return cached;
    const products: CatalogProduct[] = [];
    let cursor: string | undefined;
    let truncated = false;
    do {
      const page = await reader.listPublicProducts(storeId, { limit: 100, ...(collectionId ? { collectionId } : {}), ...(query ? { query } : {}), ...(cursor ? { cursor } : {}) });
      products.push(...page.nodes);
      cursor = page.nextCursor ?? undefined;
      if (products.length >= MAX_BROWSE_PRODUCTS) { truncated = Boolean(cursor) || products.length > MAX_BROWSE_PRODUCTS; break; }
    } while (cursor);
    const entry = { at: now(), products: products.slice(0, MAX_BROWSE_PRODUCTS).map((product) => ({ product, browsable: browsableProduct(product) })), truncated };
    if (cache.size >= CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(key, entry);
    return entry;
  }

  return {
    async browse(storeId: string, input: BrowseInput): Promise<BrowseResult> {
      const { collectionId, query, ...catalogQuery } = input;
      const loaded = await load(storeId, collectionId, query?.trim() || undefined);
      const page = browseCatalog(loaded.products, (entry) => entry.browsable, catalogQuery);
      return { nodes: page.items.map((entry) => entry.product), total: page.total, facets: page.facets, price: page.price, filtered: page.filtered, truncated: loaded.truncated };
    },
  };
}
