"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useShop } from "@/contexts/shop-context";
import { useStorefrontCatalogStatus } from "@/features/commerce/components/storefront-catalog-sync";
import { collectionResource, createCollectionPageContext } from "@/features/storefront/page-context-loaders";
import { buildStorefrontRoute, deserializeRouteValues } from "@/features/storefront/resource-loader";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";
import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";

export default function CollectionPage({ routeValues }: { routeValues?: Array<[string, unknown]> }) {
  const { storeSlug, collectionSlug } = useParams<{ storeSlug: string; collectionSlug: string }>();
  const decodedCollectionSlug = decodeURIComponent(collectionSlug);
  const { repository } = useShop();
  const catalogStatus = useStorefrontCatalogStatus();
  const store = repository.getStoreBySlug(storeSlug);
  // The published design and the catalogue arrive with the page from the server.
  const publication = useInitialStorefrontPublication();
  const values = useMemo(() => deserializeRouteValues(routeValues), [routeValues]);
  const collection = store ? repository.getCollections(store.id).find((item) => item.slug === decodedCollectionSlug) : undefined;
  const pageContext = collection && store ? createCollectionPageContext(collection, repository.listProducts(store.slug), store.currency) : null;
  // Laid out during render (not in an effect), so the server sends the finished page.
  const resolvedRoute = store && pageContext && publication?.kind === "v4"
    ? buildStorefrontRoute(publication.snapshot, { type: "collection", handle: pageContext.collection.slug }, collectionResource(pageContext.collection, pageContext.products, store.slug), values)
    : null;

  if (catalogStatus === "loading") return <main className="flex min-h-[75vh] items-center justify-center" role="status">Loading collection…</main>;
  if (store && publication?.kind === "v4" && resolvedRoute?.status === "ready") {
    return <PublishedRuntimeStorefront
      snapshot={publication.snapshot}
      route={resolvedRoute}
      storeSlug={store.slug}
      currency={store.currency}
      products={repository.listProducts(store.slug).filter((product) => product.published && !product.archived)}
    />;
  }

  return <main className="flex min-h-[75vh] flex-col items-center justify-center"><h1>Collection not found</h1><Link href={`/${storeSlug}/shop`}>Back to shop</Link></main>;
}
