"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useShop } from "@/contexts/shop-context";
import { loadPublicBlogContext, type PublicBlogContext } from "@/features/storefront/public-page-context-api";
import { loadPublicStorefrontPublication, type PublicStorefrontPublication } from "@/features/storefront/public-storefront-api";
import { resolveStorefrontRoute, type ResolvedStorefrontRoute } from "@/features/storefront/resource-loader";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";

const apiBaseUrl = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

export default function BlogPage() {
  const { storeSlug, blogSlug } = useParams<{ storeSlug: string; blogSlug: string }>();
  const { repository, state } = useShop();
  const store = repository.getStoreBySlug(storeSlug);
  const [publication, setPublication] = useState<PublicStorefrontPublication | null>(null);
  const [context, setContext] = useState<PublicBlogContext | null>(null);
  const [route, setRoute] = useState<ResolvedStorefrontRoute | null>(null);

  useEffect(() => {
    if (!store) return;
    let active = true;
    void Promise.all([
      loadPublicStorefrontPublication({ baseUrl: apiBaseUrl, storeId: store.id }),
      loadPublicBlogContext({ baseUrl: apiBaseUrl, storeId: store.id, handle: blogSlug }),
    ]).then(([nextPublication, nextContext]) => {
      if (!active) return;
      setPublication(nextPublication);
      setContext(nextContext);
    });
    return () => { active = false; };
  }, [store, blogSlug]);

  useEffect(() => {
    if (publication?.kind !== "v4" || !context) {
      setRoute(null);
      return;
    }
    const resource = { type: "blog" as const, id: context.blog.id, handle: context.blog.handle, visible: true, data: { ...context, storeSlug } };
    let active = true;
    void resolveStorefrontRoute(publication.snapshot, { type: "blog", handle: context.blog.handle }, {
      findByHandle: async () => resource,
      findById: async () => resource,
    }).then((next) => { if (active) setRoute(next); });
    return () => { active = false; };
  }, [publication, context, storeSlug]);

  if (!store || publication?.kind !== "v4" || route?.status !== "ready") return null;
  return <PublishedRuntimeStorefront snapshot={publication.snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={state.products.filter((product) => product.published && !product.archived)} />;
}
