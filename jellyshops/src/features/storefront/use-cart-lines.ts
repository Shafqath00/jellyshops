"use client";

import { useShop } from "@/contexts/shop-context";
import type { Cart, Product, ProductVariant, Store } from "@/lib/domain";

export interface CartLine { item: Cart["items"][number]; product: Product; variant: ProductVariant }

/**
 * The shopper's cart for a store as lines with their product and variant,
 * plus the subtotal and how many saved items are no longer for sale.
 * Used by the default cart drawer and the theme's slide-out cart.
 */
export function useCartLines(storeSlug: string): {
  store: Store | undefined;
  cart: Cart | undefined;
  lines: CartLine[];
  staleItems: number;
  subtotalMinor: number;
  itemCount: number;
  setQuantity(line: CartLine, quantity: number): void;
} {
  const { repository, state } = useShop();
  const store = repository.getStoreBySlug(storeSlug);
  const cart = repository.getCartForStore(storeSlug);
  const lines = (cart?.items ?? []).flatMap((item) => {
    const product = state.products.find((entry) => entry.variants.some((variant) => variant.id === item.variantId));
    const variant = product?.variants.find((entry) => entry.id === item.variantId);
    return product && variant ? [{ item, product, variant }] : [];
  });
  return {
    store,
    cart,
    lines,
    staleItems: (cart?.items.length ?? 0) - lines.length,
    subtotalMinor: lines.reduce((sum, line) => sum + (line.item.unitPriceMinor ?? line.variant.priceMinor) * line.item.quantity, 0),
    itemCount: cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    setQuantity: (line, quantity) => {
      if (!cart) return;
      repository.updateCartItem(cart.id, line.variant.id, quantity, line.item.configurationSelections, line.item.unitPriceMinor, line.item.personalisation);
    },
  };
}
