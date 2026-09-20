"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useEffect } from "react";
import { useShop } from "@/contexts/shop-context";
import { formatMoney } from "@/lib/domain";
import type { ComponentType } from "react";
import type { StorefrontCartProps } from "@jelly/storefront-themes";

export function CartPanel({ storeSlug, open, onClose, Presentation }: { storeSlug: string; open: boolean; onClose: () => void; Presentation?: ComponentType<StorefrontCartProps> }) {
  const { repository, state } = useShop();
  const store = repository.getStoreBySlug(storeSlug);
  const cart = repository.getCartForStore(storeSlug);
  const lines = cart?.items.map((item) => {
    const product = state.products.find((entry) => entry.variants.some((variant) => variant.id === item.variantId));
    const variant = product?.variants.find((entry) => entry.id === item.variantId);
    return product && variant ? { item, product, variant } : null;
  }).filter(Boolean) ?? [];
  const staleItems = (cart?.items.length ?? 0) - lines.length;
  const subtotal = lines.reduce((sum, line) => sum + (line!.item.unitPriceMinor ?? line!.variant.priceMinor) * line!.item.quantity, 0);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);

  if (!store) return null;
  const content = <>
        <div className="flex items-start justify-between"><div><span className="text-[10px] font-extrabold uppercase tracking-[.11em] text-jelly-ink-soft">Your selection</span><h2 id="cart-title" className="mt-1 text-[30px] tracking-[-.045em]">Your cart</h2></div></div>
        {staleItems > 0 ? <p className="cart-stale" role="status">{staleItems} item{staleItems === 1 ? "" : "s"} in your bag is no longer available.</p> : null}
        {lines.length === 0 ? <div className="cart-empty"><ShoppingBag size={28} /><h3>Your bag is waiting</h3><p>Pick something lovely from the shop.</p><button type="button" className="button button-secondary" onClick={onClose}>Keep browsing</button></div> : (
          <>
            <div className="cart-lines">{lines.map((line) => line && <div className="cart-line" key={`${line.variant.id}-${JSON.stringify(line.item.configurationSelections ?? [])}`}><div className="cart-thumb"><Image src={line.product.imageUrl} alt="" fill sizes="90px" /></div><div className="cart-line-copy"><b>{line.product.name}</b><span>{line.variant.name}</span>{line.item.configurationSelections?.map((selection) => { const option = line.product.options?.find((item) => item.id === selection.optionId); const value = option?.values.find((item) => item.id === selection.valueId); return option && value ? <small key={selection.optionId}>{option.name}: {value.label}</small> : null; })}<div className="quantity-control"><button type="button" aria-label={`Remove one ${line.product.name}`} onClick={() => repository.updateCartItem(cart!.id, line.variant.id, line.item.quantity - 1, line.item.configurationSelections, line.item.unitPriceMinor)}><Minus size={14} /></button><span>{line.item.quantity}</span><button type="button" aria-label={`Add one ${line.product.name}`} disabled={line.item.quantity >= line.variant.stock} onClick={() => repository.updateCartItem(cart!.id, line.variant.id, line.item.quantity + 1, line.item.configurationSelections, line.item.unitPriceMinor)}><Plus size={14} /></button></div></div><strong>{formatMoney((line.item.unitPriceMinor ?? line.variant.priceMinor) * line.item.quantity, store.currency)}</strong></div>)}</div>
            <div className="cart-summary"><div><span>Subtotal</span><b>{formatMoney(subtotal, store.currency)}</b></div><p>Shipping is calculated at checkout.</p><Link href={`/${store.slug}/checkout`} className="button button-primary" onClick={onClose}>Checkout</Link></div>
          </>
        )}
  </>;
  if (!Presentation) return open ? <div className="fixed inset-0 z-[100] flex justify-end bg-jelly-ink/30 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="fixed right-0 top-0 flex min-h-full w-full max-w-[470px] flex-col bg-jelly-paper p-7 shadow-[-24px_0_70px_rgba(20,33,61,.18)]" role="dialog" aria-modal="true" aria-labelledby="cart-title"><button type="button" className="absolute right-7 top-7 grid size-[42px] place-items-center rounded-full border border-jelly-line bg-white" onClick={onClose} aria-label="Close cart"><X /></button>{content}</aside></div> : null;
  return <Presentation open={open} itemCount={cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0} settings={{}} onClose={onClose}>{content}</Presentation>;
}
