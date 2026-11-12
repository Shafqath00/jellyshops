import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { loadPublicSearchPageContext } from "@/features/storefront/public-page-context-api";
import { serverRouteValues } from "@/features/storefront/server-route-values";
import { resolveMediaUrls } from "@/lib/media-urls";
import SearchPageClient from "./search-client";

const apiBaseUrl = process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

export default async function SearchPage({ params, searchParams }: { params: Promise<{ storeSlug: string }>; searchParams: Promise<{ q?: string | string[] }> }) {
  const { storeSlug } = await params;
  const raw = (await searchParams).q;
  const query = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  const data = await getServerStorefront(storeSlug);
  if (!data) notFound();
  const [rawContext, routeValues] = await Promise.all([
    loadPublicSearchPageContext({ baseUrl: apiBaseUrl, storeId: data.store.id, query }),
    serverRouteValues(data.publication, { type: "search", context: { type: "search", query, state: "empty", resultCount: 0, results: [] } }, null),
  ]);
  // Result photos come back API-relative ("/api/public/media/…"); the store runs on another address.
  const searchContext = rawContext ? resolveMediaUrls(rawContext, apiBaseUrl) : null;
  // A new query is a new server render, so the client never shows results for an old query.
  return <SearchPageClient key={query} searchContext={searchContext} routeValues={routeValues} />;
}
