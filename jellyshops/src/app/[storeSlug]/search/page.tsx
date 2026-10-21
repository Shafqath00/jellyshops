"use client";
import { CatalogBrowser } from "@/features/storefront/catalog-browser";
import { isCompleteStorefrontTheme } from "@jelly/storefront-themes";

import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useThemePresentation } from "@/components/storefront-shell";
import { useShop } from "@/contexts/shop-context";
import { formatMoney } from "@/lib/domain";
import { loadPublicSearchPageContext, type PublicSearchPageContext } from "@/features/storefront/public-page-context-api";
import { loadPublicStorefrontPublication, type PublicStorefrontPublication } from "@/features/storefront/public-storefront-api";
import { createSearchPageContext } from "@/features/storefront/page-context-loaders";
import { resolveStorefrontRoute, type ResolvedStorefrontRoute } from "@/features/storefront/resource-loader";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";

const apiBaseUrl = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

export default function SearchPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const query = useSearchParams().get("q") ?? "";
  const { repository, state } = useShop();
  const { shell, settings } = useThemePresentation();
  const store = repository.getStoreBySlug(storeSlug);
  const initialPublication = useInitialStorefrontPublication();
  const [publication, setPublication] = useState<PublicStorefrontPublication | null>(initialPublication);
  const [context, setContext] = useState<PublicSearchPageContext | null>(null);
  const [route, setRoute] = useState<ResolvedStorefrontRoute | null>(null);

  useEffect(() => {
    if (!store) return;
    let active = true;
    void Promise.all([
      loadPublicStorefrontPublication({ baseUrl: apiBaseUrl, storeId: store.id }),
      loadPublicSearchPageContext({ baseUrl: apiBaseUrl, storeId: store.id, query }),
    ]).then(([nextPublication, nextContext]) => {
      if (!active) return;
      setPublication(nextPublication);
      setContext(nextContext);
    });
    return () => { active = false; };
  }, [store, query]);

  useEffect(() => {
    if (!store || publication?.kind !== "v4" || !context) {
      return;
    }
    let active = true;
    void resolveStorefrontRoute(
      publication.snapshot,
      { type: "search", context: { ...createSearchPageContext(context, store.slug, store.currency), searchHref: `/${store.slug}/search` } },
      { findByHandle: async () => null, findById: async () => null },
    ).then((next) => { if (active) setRoute(next); });
    return () => { active = false; };
  }, [store, publication, context]);

  if (!store) return null;
  if (store && publication?.kind === "v4" && isCompleteStorefrontTheme(publication.snapshot.theme.id ?? publication.snapshot.theme.presetId)) return <main className="signature-page"><header className="signature-page-heading"><h1>Find your next favourite</h1></header><CatalogBrowser key={query} storeSlug={store.slug} initialQuery={query} /></main>;
  if (publication?.kind === "v4") {
    if (route?.status === "ready") {
      return <PublishedRuntimeStorefront snapshot={publication.snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={state.products.filter((product) => product.published && !product.archived)} />;
    }
    return null;
  }

  const normalized = query.toLowerCase();
  const results = repository.listProducts(storeSlug).filter((product) => product.published && !product.archived && (!normalized || `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(normalized))).map((product) => {
    const variant = product.variants[0];
    return { id: product.id, name: product.name, slug: product.slug, category: product.category, imageUrl: product.imageUrl, price: formatMoney(variant?.priceMinor ?? 0, store.currency), soldOut: !variant || variant.stock <= 0, lowStock: Boolean(variant && variant.stock > 0 && variant.stock <= 3), href: `/${store.slug}/products/${product.slug}` };
  });
  const Search = shell.SearchPage;
  return <Search store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} query={query.trim()} results={results} shopHref={`/${store.slug}/shop`} />;
}
