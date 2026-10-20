"use client";

import Link from "next/link";
import { CatalogBrowser } from "@/features/storefront/catalog-browser";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useShop } from "@/contexts/shop-context";
import { useStorefrontCatalogStatus } from "@/features/commerce/components/storefront-catalog-sync";
import { createCollectionPageContext, loadCollectionPageContext, type StorefrontPageContext } from "@/features/storefront/page-context-loaders";
import { loadPublicStorefrontPublication, type PublicStorefrontPublication } from "@/features/storefront/public-storefront-api";
import { resolveStorefrontRoute, type PublicResourceReader } from "@/features/storefront/resource-loader";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";
import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";

export default function CollectionPage() {
  const { storeSlug, collectionSlug } = useParams<{ storeSlug: string; collectionSlug: string }>();
  const decodedCollectionSlug = decodeURIComponent(collectionSlug);
  const { repository } = useShop();
  const catalogStatus = useStorefrontCatalogStatus();
  const store = repository.getStoreBySlug(storeSlug);
  const initialPublication = useInitialStorefrontPublication();
  const [publication, setPublication] = useState<PublicStorefrontPublication | null>(initialPublication);
  const initialCollection = store ? repository.getCollections(store.id).find((collection) => collection.slug === decodedCollectionSlug) : undefined;
  const [pageContext, setPageContext] = useState<Extract<StorefrontPageContext, { type: "collection" }> | null | undefined>(() => initialCollection && store ? createCollectionPageContext(initialCollection, repository.listProducts(store.slug), store.currency) : undefined);
  const [resolvedRoute, setResolvedRoute] = useState<Awaited<ReturnType<typeof resolveStorefrontRoute>> | null>(null);

  useEffect(() => {
    if (!store) return;
    let active = true;
    void loadPublicStorefrontPublication({
      baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001",
      storeId: store.id,
    }).then((next) => { if (active) setPublication(next); });
    return () => { active = false; };
  }, [store]);

  useEffect(() => {
    if (!store) return;
    let active = true;
    void loadCollectionPageContext({
      findCollection: async (handle) => repository.getCollections(store.id).find((collection) => collection.slug === handle) ?? null,
      listProducts: async () => repository.listProducts(store.slug),
    }, decodedCollectionSlug, store.currency).then((context) => {
      if (active) setPageContext(context);
    });
    return () => { active = false; };
  }, [decodedCollectionSlug, repository, store]);

  useEffect(() => {
    if (!store || !pageContext || publication?.kind !== "v4") return;
    const resource = {
      type: "collection" as const,
      id: pageContext.collection.id,
      handle: pageContext.collection.slug,
      visible: true,
      data: {
        collection: pageContext.collection,
        products: pageContext.products.map((product) => ({ ...product, href: `/${store.slug}/products/${product.href.split("/").pop()}` })),
        collectionPresentation: {
          ...(publication.snapshot.theme?.id === "jelly-signature" || publication.snapshot.theme?.presetId === "jelly-signature" ? { interactiveGrid: <CatalogBrowser storeSlug={store.slug} collectionId={pageContext.collection.id} /> } : {}),
          collection: { id: pageContext.collection.id, title: pageContext.collection.name, description: pageContext.collection.description ?? "", ...(pageContext.collection.imageUrl ? { imageUrl: pageContext.collection.imageUrl } : {}) },
          products: pageContext.products.map((product) => ({ ...product, href: `/${store.slug}/products/${product.href.split("/").pop()}` })),
          totalProducts: pageContext.products.length,
        },
      },
    };
    const reader: PublicResourceReader = {
      findByHandle: async (type, handle) => type === "collection" && handle === resource.handle ? resource : null,
      findById: async (type, id) => type === "collection" && id === resource.id ? resource : null,
    };
    void resolveStorefrontRoute(publication.snapshot, { type: "collection", handle: resource.handle }, reader).then(setResolvedRoute);
  }, [pageContext, publication, store]);

  if (catalogStatus === "loading" || pageContext === undefined) return <main className="flex min-h-[75vh] items-center justify-center">Loading collection…</main>;
  if (!store || !pageContext) return <main className="flex min-h-[75vh] flex-col items-center justify-center"><h1>Collection not found</h1><Link href={`/${storeSlug}/shop`}>Back to shop</Link></main>;

  if (publication?.kind === "v4" && resolvedRoute?.status === "ready") {
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
