"use client";

import { useParams } from "next/navigation";
import { useShop } from "@/contexts/shop-context";
import { MAX_COMPARE, useCompareList } from "../compare-list";
import { compareItem } from "../compare-table";
import { ComparePageView } from "./compare-view";
import { StorefrontPageLoading } from "./storefront-page-loading";

/** /[store]/compare: the products in the shopper's compare list side by side. */
export function ComparePage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { repository, state, hydrated } = useShop();
  const { access, ids } = useCompareList(storeSlug);
  const store = repository.getStoreBySlug(storeSlug);
  if (!store) return null;
  if (!hydrated) return <StorefrontPageLoading label="Loading your comparison…" />;
  const items = ids.flatMap((id) => {
    const product = state.products.find((item) => item.id === id && item.published && !item.archived);
    return product ? [compareItem(product, storeSlug, store.currency)] : [];
  });
  return <ComparePageView items={items} max={MAX_COMPARE} shopHref={`/${storeSlug}/shop`} onRemove={(id) => access.remove(id)} />;
}
