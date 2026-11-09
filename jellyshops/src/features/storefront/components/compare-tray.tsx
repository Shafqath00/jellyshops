"use client";

import { useOptionalShop } from "@/contexts/shop-context";
import { MAX_COMPARE, useCompareList } from "../compare-list";
import { compareItem } from "../compare-table";
import { CompareTrayView } from "./compare-view";

/**
 * The live store's compare tray (theme setting Product cards > "Let shoppers compare products"), mounted by the
 * storefront frame. It docks once a product is ticked; products no longer for sale drop out of it.
 */
export function CompareTray({ storeSlug }: { storeSlug: string }) {
  const shop = useOptionalShop();
  const { access, ids } = useCompareList(storeSlug);
  const store = shop?.repository.getStoreBySlug(storeSlug);
  if (!shop || !store) return null;
  const items = ids.flatMap((id) => {
    const product = shop.state.products.find((item) => item.id === id && item.published && !item.archived);
    return product ? [compareItem(product, storeSlug, store.currency)] : [];
  });
  return <CompareTrayView items={items} max={MAX_COMPARE} compareHref={`/${storeSlug}/compare`} onRemove={(id) => access.remove(id)} onClear={() => access.clear()} />;
}
