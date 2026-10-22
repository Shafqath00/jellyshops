"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useEffect } from "react";
import { useShop } from "@/contexts/shop-context";
import { formatMoney } from "@/lib/domain";
import type { ComponentType } from "react";
import type { StorefrontCartProps } from "@jelly/storefront-themes";
import { CartDrawer, CartItem, CartSummary, EmptyCart } from "@/components/jelly/cart";

/* ──────────────────────────────────────────────────────────────────────
 * CartPanel — connects Jellyshop commerce state to CartDrawer presentation
 *
 * Commerce logic: unchanged (uses useShop / repository)
 * Presentation:   CartDrawer + CartItem + CartSummary + EmptyCart
 * ──────────────────────────────────────────────────────────────────── */

export function CartPanel({
  storeSlug,
  open,
  onClose,
  Presentation,
}: {
  storeSlug: string;
  open: boolean;
  onClose: () => void;
  Presentation?: ComponentType<StorefrontCartProps>;
}) {
  const { repository, state } = useShop();
  const store = repository.getStoreBySlug(storeSlug);
  const cart = repository.getCartForStore(storeSlug);
  const lines = cart?.items.map((item) => {
    const product = state.products.find((entry) =>
      entry.variants.some((variant) => variant.id === item.variantId),
    );
    const variant = product?.variants.find((entry) => entry.id === item.variantId);
    return product && variant ? { item, product, variant } : null;
  }).filter(Boolean) ?? [];
  const staleItems = (cart?.items.length ?? 0) - lines.length;
  const subtotal = lines.reduce(
    (sum, line) =>
      sum + (line!.item.unitPriceMinor ?? line!.variant.priceMinor) * line!.item.quantity,
    0,
  );

  // Keyboard close — handled inside CartDrawer; keep this for Presentation themes
  useEffect(() => {
    if (!open || Presentation) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose, Presentation]);

  if (!store) return null;

  /* ── Cart content shared between default + Presentation themes ─── */
  const content = (
    <>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-[.11em] text-muted-foreground">
            Your selection
          </span>
          <h2
            aria-hidden="true"
            className="mt-1 text-[28px] font-bold leading-none tracking-[-0.045em]"
          >
            Your cart
          </h2>
        </div>
      </div>

      {staleItems > 0 && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive" role="status">
          {staleItems} item{staleItems === 1 ? "" : "s"} in your bag is no longer available.
        </p>
      )}

      {lines.length === 0 ? (
        <EmptyCart onClose={onClose} />
      ) : (
        <>
          {/* Items */}
          <div className="flex flex-col gap-5">
            {lines.map(
              (line) =>
                line && (
                  <CartItem
                    key={`${line.variant.id}-${JSON.stringify(line.item.configurationSelections ?? [])}`}
                    imageUrl={line.product.imageUrl}
                    name={line.product.name}
                    variantName={line.variant.name}
                    options={line.item.configurationSelections?.map((selection) => {
                      const option = line.product.options?.find((o) => o.id === selection.optionId);
                      const value = option?.values.find((v) => v.id === selection.valueId);
                      return option && value ? `${option.name}: ${value.label}` : "";
                    }).filter(Boolean)}
                    quantity={line.item.quantity}
                    lineTotal={formatMoney(
                      (line.item.unitPriceMinor ?? line.variant.priceMinor) * line.item.quantity,
                      store.currency,
                    )}
                    canIncrease={line.item.quantity < line.variant.stock}
                    onDecrease={() =>
                      repository.updateCartItem(
                        cart!.id,
                        line.variant.id,
                        line.item.quantity - 1,
                        line.item.configurationSelections,
                        line.item.unitPriceMinor,
                      )
                    }
                    onIncrease={() =>
                      repository.updateCartItem(
                        cart!.id,
                        line.variant.id,
                        line.item.quantity + 1,
                        line.item.configurationSelections,
                        line.item.unitPriceMinor,
                      )
                    }
                  />
                ),
            )}
          </div>

          {/* Summary */}
          <CartSummary
            subtotal={formatMoney(subtotal, store.currency)}
            checkoutHref={`/${store.slug}/checkout`}
            onClose={onClose}
          />
        </>
      )}
    </>
  );

  /* ── Theme-provided CartPanel (boutique, editorial, etc.) ───────── */
  if (Presentation) {
    return (
      <Presentation
        open={open}
        itemCount={cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0}
        settings={{}}
        onClose={onClose}
      >
        {content}
      </Presentation>
    );
  }

  /* ── Default Jellyshop CartDrawer ──────────────────────────────── */
  return (
    <CartDrawer open={open} onClose={onClose}>
      {content}
    </CartDrawer>
  );
}
