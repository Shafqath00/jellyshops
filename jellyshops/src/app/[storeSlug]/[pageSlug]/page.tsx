"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { migrateStorefrontDocument } from "@jelly/storefront-schema";
import { useShop } from "@/contexts/shop-context";
import { PublishedRuntimeStorefront, PublishedStorefront } from "@/features/storefront/storefront-page";
import { useThemePresentation } from "@/components/storefront-shell";
import { loadPublicStorefrontPublication, type PublicStorefrontPublication } from "@/features/storefront/public-storefront-api";
import { loadPublicPageContext, type PublicPageContext } from "@/features/storefront/public-page-context-api";
import { resolveStorefrontRoute, type ResolvedStorefrontRoute } from "@/features/storefront/resource-loader";
import { isReservedStorefrontPath } from "@/features/storefront/reserved-paths";

const apiBaseUrl = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

export default function CustomStorePage() {
  const { storeSlug, pageSlug } = useParams<{
    storeSlug: string;
    pageSlug: string;
  }>();
  const { shell, settings } = useThemePresentation();
  const { repository } = useShop();
  const store = repository.getStoreBySlug(storeSlug);
  const [publication, setPublication] = useState<PublicStorefrontPublication | null>(null);
  const [context, setContext] = useState<PublicPageContext | null>(null);
  const [route, setRoute] = useState<ResolvedStorefrontRoute | null>(null);
  const legacyPublication = store
    ? repository.getPublishedStoreDesign(store.id)
    : undefined;

  useEffect(() => {
    if (!store || isReservedStorefrontPath(pageSlug)) return;
    let active = true;
    void Promise.all([
      loadPublicStorefrontPublication({ baseUrl: apiBaseUrl, storeId: store.id }),
      loadPublicPageContext({ baseUrl: apiBaseUrl, storeId: store.id, handle: pageSlug }),
    ]).then(([nextPublication, nextContext]) => {
      if (!active) return;
      setPublication(nextPublication);
      setContext(nextContext);
    });
    return () => { active = false; };
  }, [store, pageSlug]);

  useEffect(() => {
    if (!publication || publication.kind !== "v4" || !context) {
      setRoute(null);
      return;
    }
    const resource = { type: "page" as const, id: context.page.id, handle: context.page.handle, visible: true, data: context.page };
    let active = true;
    void resolveStorefrontRoute(publication.snapshot, { type: "page", handle: context.page.handle }, {
      findByHandle: async () => resource,
      findById: async () => resource,
    }).then((next) => { if (active) setRoute(next); });
    return () => { active = false; };
  }, [publication, context]);

  if (!store || isReservedStorefrontPath(pageSlug)) {
    return (
      <main className="grid min-h-[70vh] place-items-center px-6 text-center">
        <div>
          <h1 className="font-[var(--store-display,Georgia)] text-5xl">
            Page not found
          </h1>
          <Link className="mt-5 inline-block border-b text-sm font-bold" href={`/${storeSlug}`}>
            Return home
          </Link>
        </div>
      </main>
    );
  }

  if (publication?.kind === "v4") {
    if (route?.status === "ready") {
      return <PublishedRuntimeStorefront snapshot={publication.snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={repository.listProducts(storeSlug).filter((product) => product.published && !product.archived)} />;
    }
    return null;
  }

  if (!legacyPublication) {
    return (
      <main className="grid min-h-[70vh] place-items-center px-6 text-center">
        <div><h1 className="font-[var(--store-display,Georgia)] text-5xl">Page not found</h1><Link className="mt-5 inline-block border-b text-sm font-bold" href={`/${storeSlug}`}>Return home</Link></div>
      </main>
    );
  }

  const document = migrateStorefrontDocument(
    legacyPublication.document,
    store.id,
  );
  const page = document.pages.find(
    (entry) =>
      entry.type === "custom" &&
      entry.slug === pageSlug,
  );

  if (!page) {
    return (
      <main className="grid min-h-[70vh] place-items-center px-6 text-center">
        <div>
          <h1 className="font-[var(--store-display,Georgia)] text-5xl">
            Page not found
          </h1>
          <Link className="mt-5 inline-block border-b text-sm font-bold" href={`/${store.slug}`}>
            Return home
          </Link>
        </div>
      </main>
    );
  }

  const products = repository
    .listProducts(storeSlug)
    .filter((product) => product.published && !product.archived);

  const ContentPage = shell.ContentPage;
  return <ContentPage store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} pageSlug={pageSlug}>
    <PublishedStorefront
      document={document}
      storeSlug={store.slug}
      currency={store.currency}
      products={products}
      pageId={page.id}
    />
  </ContentPage>;
}
