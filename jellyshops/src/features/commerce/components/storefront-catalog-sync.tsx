"use client";

import { useEffect, useState } from "react";
import { useShop } from "@/contexts/shop-context";
import { createCommerceApi } from "@/features/commerce/api/client";
import { commerceStoreId } from "@/features/commerce/commerce-store-id";

/** Loads the published catalog into the local cart repository. Cart state stays client-side; products do not. */
export function StorefrontCatalogSync({ storeSlug }: { storeSlug: string }) {
  const { repository } = useShop();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const api = createCommerceApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001" });
    api.getPublicCatalog(commerceStoreId(storeSlug)).then((products) => {
      if (!cancelled) {
        const localStore = repository.getStoreBySlug(storeSlug);
        if (!localStore) return;
        repository.replaceCatalog(localStore.id, products.map((product) => ({ ...product, storeId: localStore.id })));
        setFailed(false);
      }
    }).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => { cancelled = true; };
  }, [repository, storeSlug]);

  if (!failed) return null;
  return <p className="store-catalog-error" role="status">We couldn’t refresh the catalog. Please try again shortly.</p>;
}
