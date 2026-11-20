"use client";

import { useEffect, useRef } from "react";
import { useShop } from "@/contexts/shop-context";

/**
 * Empties the store's bag once, after a payment that came back through a
 * Stripe redirect (bank or wallet methods). In-page card payments empty it
 * before leaving checkout. Then the payment words (?paid=1, Stripe's
 * payment_intent and its client secret) are taken out of the address, so a
 * refresh later never empties a bag the shopper has filled again.
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
    try {
      const url = new URL(window.location.href);
      for (const key of ["paid", "payment_intent", "payment_intent_client_secret", "redirect_status"]) url.searchParams.delete(key);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch { /* leave the address as it is */ }
  }, [paid, hydrated, repository, storeSlug]);
}
