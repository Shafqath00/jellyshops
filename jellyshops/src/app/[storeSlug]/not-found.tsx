"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useShop } from "@/contexts/shop-context";
import { resolveStorefrontNotFound } from "@/features/storefront/resource-loader";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";
import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";

/**
 * Every missing page in a store (unknown address, product, collection, page or post) draws the store's own
 * 404 template inside its header and footer. Next sends it with status 404.
 */
export default function StoreNotFound() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { repository } = useShop();
  const publication = useInitialStorefrontPublication();
  const store = repository.getStoreBySlug(storeSlug);
  const route = publication?.kind === "v4" ? resolveStorefrontNotFound(publication.snapshot) : null;

  if (store && publication?.kind === "v4" && route?.status === "ready") {
    return <PublishedRuntimeStorefront
      snapshot={publication.snapshot}
      route={route}
      storeSlug={store.slug}
      currency={store.currency}
      products={repository.listProducts(store.slug).filter((product) => product.published && !product.archived)}
    />;
  }

  return <main className="grid min-h-[70vh] place-items-center px-6 text-center"><div><h1>Page not found</h1><Link className="mt-4 inline-block border-b" href={`/${storeSlug}`}>Return home</Link></div></main>;
}
