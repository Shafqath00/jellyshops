// The live product list's backend calls (`GET /api/public/stores/:id/catalog/browse`), usable on the server (the
// search page draws its first page there) and in the browser (catalog-browse-api.ts wraps them in a hook).
import type { CatalogBrowsePage } from "@jelly/storefront-renderer";
import type { CatalogFacet, CatalogQuery } from "@jelly/storefront-schema";
import { catalogProductToStorefrontProduct, type PublicCatalogResponse } from "@/features/commerce/api/client";
import { resolveMediaUrls } from "@/lib/media-urls";
import type { Currency } from "@/lib/domain";
import { productCardData } from "./product-card-data";

const apiOrigin = () => process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

export type BrowseInput = CatalogQuery & { collectionId?: string; query?: string };
interface BrowseResponse { nodes: PublicCatalogResponse["nodes"]; total: number; facets: CatalogFacet[]; price: CatalogBrowsePage["price"]; filtered: boolean }

/** The address of one page of the live product list (`GET /api/public/stores/:id/catalog/browse`). */
export function browseUrl(origin: string, storeId: string, input: BrowseInput): string {
  const params = new URLSearchParams();
  if (input.collectionId) params.set("collectionId", input.collectionId);
  if (input.query?.trim()) params.set("q", input.query.trim());
  if (input.sort && input.sort !== "featured") params.set("sort", input.sort);
  if (input.inStock) params.set("inStock", "true");
  if (typeof input.minPriceMinor === "number") params.set("min", String(input.minPriceMinor));
  if (typeof input.maxPriceMinor === "number") params.set("max", String(input.maxPriceMinor));
  const filters = Object.fromEntries(Object.entries(input.filters ?? {}).filter(([, values]) => values.length > 0));
  if (Object.keys(filters).length) params.set("filter", JSON.stringify(filters));
  if (input.filterNames?.length) params.set("filterNames", input.filterNames.join(","));
  if (input.offset) params.set("offset", String(input.offset));
  params.set("limit", String(input.limit ?? 12));
  return `${origin.replace(/\/$/, "")}/api/public/stores/${encodeURIComponent(storeId)}/catalog/browse?${params}`;
}

/** Asks the store's backend for one page and turns its products into cards. */
export async function fetchCatalogPage(storeId: string, storeSlug: string, currency: Currency, input: BrowseInput, fetcher: typeof fetch = fetch, origin: string = apiOrigin()): Promise<CatalogBrowsePage> {
  const response = await fetcher(browseUrl(origin, storeId, input), { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error("Products are temporarily unavailable.");
  const body = resolveMediaUrls(await response.json() as BrowseResponse, origin);
  return {
    products: body.nodes.map(catalogProductToStorefrontProduct).map((product) => productCardData(product, `/${storeSlug}/products/${product.slug}`, currency)),
    total: body.total,
    facets: body.facets,
    price: body.price,
    filtered: body.filtered,
  };
}
