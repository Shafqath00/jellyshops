"use client";

import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useThemePresentation } from "@/features/storefront/components/storefront-shell";
import { useShop } from "@/contexts/shop-context";
import { formatMoney } from "@/lib/domain";
import type { PublicSearchPageContext } from "@/features/storefront/public-page-context-api";
import { createSearchPageContext } from "@/features/storefront/page-context-loaders";
import { buildStorefrontRoute, deserializeRouteValues } from "@/features/storefront/resource-loader";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";
import { isVariantBuyable } from "@/lib/variant-stock";

export default function SearchPage({ searchContext, routeValues }: { searchContext: PublicSearchPageContext | null; routeValues?: Array<[string, unknown]> }) {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const query = useSearchParams().get("q") ?? "";
  const { repository, state } = useShop();
  const { shell, settings } = useThemePresentation();
  const store = repository.getStoreBySlug(storeSlug);
  // The published design and the search results arrive with the page from the server.
  const publication = useInitialStorefrontPublication();
  const values = useMemo(() => deserializeRouteValues(routeValues), [routeValues]);
  // When the search service is down, the page still draws with "no results" rather than staying blank.
  const searchRouteContext = store ? (searchContext ? createSearchPageContext(searchContext, store.slug, store.currency) : { type: "search" as const, query: query.trim(), state: query.trim() ? "none" as const : "empty" as const, resultCount: 0, results: [] }) : null;
  const route = store && publication?.kind === "v4" && searchRouteContext
    ? buildStorefrontRoute(publication.snapshot, { type: "search", context: { ...searchRouteContext, searchHref: `/${store.slug}/search` } }, null, values)
    : null;

  if (!store) return null;
  if (publication?.kind === "v4" && route?.status === "ready") {
    return <PublishedRuntimeStorefront snapshot={publication.snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={state.products.filter((product) => product.published && !product.archived)} />;
  }

  const normalized = query.toLowerCase();
  const results = repository.listProducts(storeSlug).filter((product) => product.published && !product.archived && (!normalized || `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(normalized))).map((product) => {
    const variant = product.variants[0];
    return { id: product.id, name: product.name, slug: product.slug, category: product.category, imageUrl: product.imageUrl, price: formatMoney(variant?.priceMinor ?? 0, store.currency), soldOut: !isVariantBuyable(variant), lowStock: Boolean(variant && variant.stock > 0 && variant.stock <= 3), href: `/${store.slug}/products/${product.slug}` };
  });
  const Search = shell.SearchPage;
  return <Search store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} query={query.trim()} results={results} shopHref={`/${store.slug}/shop`} />;
}
