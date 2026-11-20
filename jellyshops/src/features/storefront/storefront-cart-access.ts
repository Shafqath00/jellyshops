"use client";

import { useMemo } from "react";
import type { StorefrontCartAccess } from "@jelly/storefront-renderer";
import { useOptionalShop } from "@/contexts/shop-context";
import type { ConfiguredOptionSelection, Product } from "@/lib/domain";
import { isUntrackedStock, variantMaxQuantity } from "@/lib/variant-stock";

/**
 * The choices a variant stands for (its stock options, such as Size: King), recorded on the bag line as the product
 * page does: checkout refuses a line of a product with a required stock option that has no choice for it.
 */
export function variantSelections(product: Pick<Product, "options"> | undefined, variant: Product["variants"][number]): ConfiguredOptionSelection[] {
  return (product?.options ?? []).flatMap((option) => {
    const valueId = option.type === "variant" ? variant.options?.[option.id] : undefined;
    return valueId ? [{ optionId: option.id, valueId }] : [];
  });
}

const sameSelections = (a: ConfiguredOptionSelection[] | undefined, b: ConfiguredOptionSelection[]) => {
  const key = (list: ConfiguredOptionSelection[]) => list.map((entry) => `${entry.optionId}=${entry.valueId}`).sort().join("&");
  return key(a ?? []) === key(b);
};

/**
 * Quick add on product cards: reads and sets the quantity of a plain variant (no chosen options) in the shopper's
 * bag for this store. Refuses more than the stock and products that are no longer for sale. Undefined (no quick add)
 * where the page has no shop state.
 */
/** How many items are in the shopper's bag for this store (0 outside the shop state). Updates when the bag changes. */
export function useBagCount(storeSlug: string): number {
  const shop = useOptionalShop();
  if (!shop) return 0;
  return (shop.repository.getCartForStore(storeSlug)?.items ?? []).reduce((sum, item) => sum + item.quantity, 0);
}

export function useStorefrontCartAccess(storeSlug: string): StorefrontCartAccess | undefined {
  const shop = useOptionalShop();
  return useMemo<StorefrontCartAccess | undefined>(() => {
    if (!shop) return undefined;
    const { repository, state } = shop;
    return {
      quantity(variantId) {
        const cart = repository.getCartForStore(storeSlug);
        const product = state.products.find((entry) => entry.variants.some((item) => item.id === variantId));
        const variant = product?.variants.find((item) => item.id === variantId);
        const selections = variant ? variantSelections(product, variant) : [];
        return (cart?.items ?? []).filter((item) => item.variantId === variantId && sameSelections(item.configurationSelections, selections) && !item.personalisation?.length).reduce((sum, item) => sum + item.quantity, 0);
      },
      async setQuantity(variantId, quantity) {
        const product = state.products.find((entry) => entry.variants.some((item) => item.id === variantId));
        const variant = product?.variants.find((item) => item.id === variantId);
        if (!variant || variant.sellable === false) return { ok: false, message: "This product is no longer available." };
        const max = variantMaxQuantity(variant);
        if (quantity > max) return { ok: false, message: max === 0 ? "This product is out of stock." : isUntrackedStock(variant) ? `You can add up to ${max} at a time.` : `Only ${variant.stock} left.` };
        const cart = repository.getCartForStore(storeSlug) ?? repository.createCart(storeSlug);
        repository.updateCartItem(cart.id, variantId, Math.max(0, quantity), variantSelections(product, variant), variant.priceMinor);
        return { ok: true };
      },
    };
  }, [shop, storeSlug]);
}
