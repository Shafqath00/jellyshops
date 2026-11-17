"use client";

import { useEffect, useRef } from "react";
import { useShop } from "@/contexts/shop-context";

/**
 * Empties the store's bag once, after a payment that came back through a
 * Stripe redirect (bank or wallet methods). In-page card payments empty it
 * before leaving checkout.
 */
export function useClearBagAfterPayment(storeSlug: string, paid: boolean) {
  const { repository, hydrated } = useShop();
  const done = useRef(false);
  useEffect(() => {
    if (!paid || !hydrated || done.current) return;
    done.current = true;
    const cart = repository.getCartForStore(storeSlug);
    for (const item of cart?.items ?? []) {
      try { repository.updateCartItem(cart!.id, item.variantId, 0, item.configurationSelections, undefined, item.personalisation); } catch { /* already gone */ }
    }
  }, [paid, hydrated, repository, storeSlug]);
}
