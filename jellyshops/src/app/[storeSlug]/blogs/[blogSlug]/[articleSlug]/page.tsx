"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useShop } from "@/contexts/shop-context";
import { loadPublicArticleContext, type PublicArticleContext } from "@/features/storefront/public-page-context-api";
import { loadPublicStorefrontPublication, type PublicStorefrontPublication } from "@/features/storefront/public-storefront-api";
import { resolveStorefrontRoute, type ResolvedStorefrontRoute } from "@/features/storefront/resource-loader";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";

const apiBaseUrl = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

export default function ArticlePage() {
  const { storeSlug, blogSlug, articleSlug } = useParams<{ storeSlug: string; blogSlug: string; articleSlug: string }>();
  const { repository, state } = useShop();
  const store = repository.getStoreBySlug(storeSlug);
  const [publication, setPublication] = useState<PublicStorefrontPublication | null>(null);
  const [context, setContext] = useState<PublicArticleContext | null>(null);
  const [route, setRoute] = useState<ResolvedStorefrontRoute | null>(null);

  useEffect(() => {
    if (!store) return;
    let active = true;
    void Promise.all([
      loadPublicStorefrontPublication({ baseUrl: apiBaseUrl, storeId: store.id }),
      loadPublicArticleContext({ baseUrl: apiBaseUrl, storeId: store.id, blogHandle: blogSlug, articleHandle: articleSlug }),
    ]).then(([nextPublication, nextContext]) => {
      if (!active) return;
      setPublication(nextPublication);
      setContext(nextContext);
    });
    return () => { active = false; };
  }, [store, blogSlug, articleSlug]);

  useEffect(() => {
    if (publication?.kind !== "v4" || !context) {
      setRoute(null);
      return;
    }
    const resource = { type: "article" as const, id: context.article.id, handle: context.article.handle, visible: true, data: context };
    let active = true;
    void resolveStorefrontRoute(publication.snapshot, { type: "article", handle: context.article.handle }, {
      findByHandle: async () => resource,
      findById: async () => resource,
    }).then((next) => { if (active) setRoute(next); });
    return () => { active = false; };
  }, [publication, context]);

  if (!store || publication?.kind !== "v4" || route?.status !== "ready") return null;
  return <PublishedRuntimeStorefront snapshot={publication.snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={state.products.filter((product) => product.published && !product.archived)} />;
}
