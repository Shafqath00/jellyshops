import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { loadPublicSearchPageContext } from "@/features/storefront/public-page-context-api";
import { serverRouteValues } from "@/features/storefront/server-route-values";
import { resolveMediaUrls } from "@/lib/media-urls";
import SearchPageClient from "./search-client";
import { searchFromParams } from "@/features/storefront/list-search";
import { fetchCatalogPage } from "@/features/storefront/catalog-browse-fetch";

const apiBaseUrl = process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

export default async function SearchPage({ params, searchParams }: { params: Promise<{ storeSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { storeSlug } = await params;
  const allParams = await searchParams;
  const raw = allParams.q;
  const query = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  const data = await getServerStorefront(storeSlug);
  if (!data) notFound();
  const listSearch = searchFromParams(allParams);
  // The first 48 matches come from the catalogue browse, with the filter data each result needs: a search section
  // with a toolbar applies the address's sort and filters to them (on the server too) and then pages and filters
  // through the same backend; one without a toolbar shows them as they are. Fails soft: the search service's own
  // results are used instead.
  const firstPage = query.trim()
    ? fetchCatalogPage(data.store.id, data.store.slug, data.store.currency, { query, offset: 0, limit: 48 }, fetch, apiBaseUrl).catch(() => null)
    : Promise.resolve(null);
  const [rawContext, routeValues, browsed] = await Promise.all([
    loadPublicSearchPageContext({ baseUrl: apiBaseUrl, storeId: data.store.id, query }),
    serverRouteValues(data.publication, { type: "search", context: { type: "search", query, state: "empty", resultCount: 0, results: [] } }, null),
    firstPage,
  ]);
  // Result photos come back API-relative ("/api/public/media/…"); the store runs on another address.
  const searchContext = rawContext ? resolveMediaUrls(rawContext, apiBaseUrl) : null;
  // A new query is a new server render, so the client never shows results for an old query.
  return <SearchPageClient key={query} searchContext={searchContext} routeValues={routeValues} listSearch={listSearch} serverResults={browsed ? { products: browsed.products, total: browsed.total } : null} />;
}
