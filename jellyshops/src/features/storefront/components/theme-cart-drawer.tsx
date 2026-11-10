"use client";

import { useEffect, useRef } from "react";
import { formatMoney } from "@/lib/domain";
import { cartProductImage } from "@/lib/product-media";
import { useCartLines } from "../use-cart-lines";
import { cartLineKey, personalisationLabels } from "../personalisation-display";
import { canDecreaseCartQuantity, canIncreaseCartQuantity } from "../cart-quantity";

/** Events the storefront uses to open the slide-out cart. */
export const CART_OPEN_EVENT = "jelly:cart-open";

/**
 * The theme's slide-out cart (theme settings > Cart > "Slide-out cart"). It is
 * drawn inside the store wrapper, so it uses the theme's colours, fonts and
 * corners. Escape, the close button and the dimmed page close it; focus moves
 * into it on open and back to where it was on close.
 */
export function ThemeCartDrawer({ storeSlug, open, onClose, variant = "drawer", freeDeliveryFromMinor = null }: { storeSlug: string; open: boolean; onClose(): void; variant?: "drawer" | "sheet"; freeDeliveryFromMinor?: number | null }) {
  const { store, lines, staleItems, subtotalMinor, itemCount, setQuantity } = useCartLines(storeSlug);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      // Keep Tab inside the cart while it is open.
      if (event.key === "Tab" && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
        if (!items.length) return;
        const [first, last] = [items[0], items[items.length - 1]];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = overflow; before?.focus?.(); };
  }, [open, onClose]);
  if (!open || !store) return null;
  const money = (minor: number) => formatMoney(minor, store.currency);
  const remaining = freeDeliveryFromMinor ? Math.max(0, freeDeliveryFromMinor - subtotalMinor) : 0;
  return <div className="jelly-cart-drawer" data-open="true" data-variant={variant}>
    <button type="button" className="jelly-cart-drawer-backdrop" aria-label="Close cart" tabIndex={-1} onClick={onClose} />
    <div ref={panel} className="jelly-cart-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="jelly-cart-drawer-title" tabIndex={-1}>
      <header className="jelly-cart-drawer-header">
        <h2 id="jelly-cart-drawer-title">Your bag{itemCount ? <span> ({itemCount})</span> : null}</h2>
        <button type="button" className="jelly-cart-drawer-close" aria-label="Close cart" onClick={onClose}>×</button>
      </header>
      {freeDeliveryFromMinor && lines.length > 0 && <div className="jelly-cart-drawer-progress">
        <p>{remaining > 0 ? <>Spend <strong>{money(remaining)}</strong> more for free delivery</> : <strong>Your order has free delivery</strong>}</p>
        <progress max={freeDeliveryFromMinor} value={Math.min(subtotalMinor, freeDeliveryFromMinor)} aria-label="Progress towards free delivery" />
      </div>}
      {staleItems > 0 && <p className="jelly-cart-drawer-note" role="status">{staleItems} item{staleItems === 1 ? " is" : "s are"} no longer available and won&apos;t be ordered.</p>}
      {lines.length === 0
        ? <div className="jelly-cart-drawer-empty"><p>Your bag is empty.</p><a className="jelly-button" href={`/${store.slug}/shop`} onClick={onClose}>Continue shopping</a></div>
        : <>
          <ul className="jelly-cart-drawer-lines">{lines.map((line) => {
            const options = line.item.configurationSelections?.flatMap((selection) => {
              const option = line.product.options?.find((item) => item.id === selection.optionId);
              const value = option?.values.find((item) => item.id === selection.valueId);
              return option && value ? [`${option.name}: ${value.label}`] : [];
            }) ?? [];
            const image = cartProductImage(line.product, line.variant, line.item.configurationSelections);
            const detail = [line.variant.name && line.variant.name !== "Default" ? line.variant.name : "", ...options, ...personalisationLabels(line.product, line.item)].filter(Boolean).join(" · ");
            return <li key={cartLineKey(line.variant.id, line.item)}>
              {/* Merchant media may be served by the local API, not as Next Image assets. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {image ? <img src={image} alt="" /> : <span className="jelly-cart-drawer-thumb" aria-hidden="true" />}
              <div>
                <a href={`/${store.slug}/products/${line.product.slug}`} onClick={onClose}>{line.product.name}</a>
                {detail && <p>{detail}</p>}
                <div className="jelly-cart-drawer-quantity">
                  <button type="button" aria-label={`Remove one ${line.product.name}`} disabled={!canDecreaseCartQuantity(line.product, line.variant, line.item.quantity)} onClick={() => setQuantity(line, line.item.quantity - 1)}>−</button>
                  <span aria-label={`Quantity ${line.item.quantity}`}>{line.item.quantity}</span>
                  <button type="button" aria-label={`Add one more ${line.product.name}`} disabled={!canIncreaseCartQuantity(line.product, line.variant, line.item.quantity)} onClick={() => setQuantity(line, line.item.quantity + 1)}>+</button>
                  <button type="button" className="jelly-cart-drawer-remove" onClick={() => setQuantity(line, 0)}>Remove</button>
                </div>
              </div>
              <strong>{money((line.item.unitPriceMinor ?? line.variant.priceMinor) * line.item.quantity)}</strong>
            </li>;
          })}</ul>
          <footer className="jelly-cart-drawer-footer">
            <p><span>Subtotal</span><strong>{money(subtotalMinor)}</strong></p>
            <small>Shipping and taxes are worked out at checkout.</small>
            <a className="jelly-button" href={`/${store.slug}/checkout`}>Check out</a>
            <a className="jelly-cart-drawer-view" href={`/${store.slug}/cart`} onClick={onClose}>View bag</a>
          </footer>
        </>}
    </div>
  </div>;
}
