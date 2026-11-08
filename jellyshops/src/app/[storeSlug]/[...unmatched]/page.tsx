"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useShop } from "@/contexts/shop-context";
import { loadPublicStorefrontPublication, type PublicStorefrontPublication } from "@/features/storefront/public-storefront-api";
import { resolveStorefrontNotFound, type ResolvedStorefrontRoute } from "@/features/storefront/resource-loader";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";

const apiBaseUrl = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

export default function UnmatchedStorefrontPathPage() {
  const { storeSlug } = useParams<{ storeSlug: string; unmatched: string[] }>();
  const { repository } = useShop();
  const store = repository.getStoreBySlug(storeSlug);
  const [publication, setPublication] = useState<PublicStorefrontPublication | null>(null);
  const [route, setRoute] = useState<ResolvedStorefrontRoute | null>(null);

  useEffect(() => {
    if (!store) return;
    let active = true;
    void loadPublicStorefrontPublication({ baseUrl: apiBaseUrl, storeId: store.id }).then((current) => {
      if (!active) return;
      setPublication(current);
      setRoute(current?.kind === "v4" ? resolveStorefrontNotFound(current.snapshot) : null);
    });
    return () => { active = false; };
  }, [store]);

  if (!store) {
    return <main className="grid min-h-[70vh] place-items-center px-6 text-center"><h1>Store not found</h1></main>;
  }

  if (publication?.kind === "v4" && route?.status === "ready") {
    return <PublishedRuntimeStorefront
      snapshot={publication.snapshot}
      route={route}
      storeSlug={store.slug}
      currency={store.currency}
      products={repository.listProducts(storeSlug).filter((product) => product.published && !product.archived)}
    />;
  }

  return <main className="grid min-h-[70vh] place-items-center px-6 text-center"><div><h1>Page not found</h1><Link className="mt-4 inline-block border-b" href={`/${store.slug}`}>Return home</Link></div></main>;
}
