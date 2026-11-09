"use client";

import { useMemo } from "react";
import type { StorefrontCartAccess } from "@jelly/storefront-renderer";
import { useOptionalShop } from "@/contexts/shop-context";
import { isUntrackedStock, variantMaxQuantity } from "@/lib/variant-stock";

/**
 * Quick add on product cards: reads and sets the quantity of a plain variant (no chosen options) in the shopper's
 * bag for this store. Refuses more than the stock and products that are no longer for sale. Undefined (no quick add)
 * where the page has no shop state.
 */
export function useStorefrontCartAccess(storeSlug: string): StorefrontCartAccess | undefined {
  const shop = useOptionalShop();
  return useMemo<StorefrontCartAccess | undefined>(() => {
    if (!shop) return undefined;
    const { repository, state } = shop;
    return {
      quantity(variantId) {
        const cart = repository.getCartForStore(storeSlug);
        return (cart?.items ?? []).filter((item) => item.variantId === variantId && !item.configurationSelections?.length && !item.personalisation?.length).reduce((sum, item) => sum + item.quantity, 0);
      },
      async setQuantity(variantId, quantity) {
        const variant = state.products.flatMap((product) => product.variants).find((item) => item.id === variantId);
        if (!variant || variant.sellable === false) return { ok: false, message: "This product is no longer available." };
        const max = variantMaxQuantity(variant);
        if (quantity > max) return { ok: false, message: max === 0 ? "This product is out of stock." : isUntrackedStock(variant) ? `You can add up to ${max} at a time.` : `Only ${variant.stock} left.` };
        const cart = repository.getCartForStore(storeSlug) ?? repository.createCart(storeSlug);
        repository.updateCartItem(cart.id, variantId, Math.max(0, quantity), [], variant.priceMinor);
        return { ok: true };
      },
    };
  }, [shop, storeSlug]);
}
