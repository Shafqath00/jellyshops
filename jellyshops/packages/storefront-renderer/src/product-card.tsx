import { createContext, useContext, useState } from "react";
import { StorefrontProductCard } from "@jelly/storefront-ui";
import type { PublicProduct, StorefrontCartAccess } from "./types";

/** The shopper's cart for quick add; provided per section by RegistrySectionRenderer (not in the editor). */
export const CardCartContext = createContext<StorefrontCartAccess | undefined>(undefined);

/**
 * Quick add (template programme card archetype C3): "Add", then a − 1 + stepper showing how many are in the bag.
 * Only for products that can go straight into the cart (one variant, no options, in stock). Drawn for every such
 * card; storefront-base.css shows it only with the "Quick add" card style.
 */
export function QuickAdd({ product, cart }: { product: PublicProduct & { quickAdd: NonNullable<PublicProduct["quickAdd"]> }; cart: StorefrontCartAccess }) {
  const { variantId, max } = product.quickAdd;
  const [pending, setPending] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const quantity = pending ?? cart.quantity(variantId);
  const change = async (next: number) => {
    const target = Math.max(0, Math.min(max, next));
    setPending(target);
    setMessage("");
    const result = await cart.setQuantity(variantId, target).catch(() => ({ ok: false, message: undefined }));
    setPending(null);
    if (!result.ok) setMessage(result.message ?? "Could not update your bag.");
    else if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("jelly:cart-changed"));
  };
  return <div className="jelly-quick-add" data-in-bag={quantity > 0 ? "true" : undefined}>
    {quantity === 0
      ? <button type="button" className="jelly-quick-add-button" onClick={() => void change(1)} aria-label={`Add ${product.name} to your bag`}>Add</button>
      : <div className="jelly-quick-add-stepper" role="group" aria-label={`${product.name} in your bag`}>
        <button type="button" onClick={() => void change(quantity - 1)} aria-label={quantity === 1 ? `Remove ${product.name}` : `One fewer ${product.name}`}>−</button>
        <span aria-live="polite">{quantity}</span>
        <button type="button" onClick={() => void change(quantity + 1)} disabled={quantity >= max} aria-label={`One more ${product.name}`}>+</button>
      </div>}
    {message && <p className="jelly-quick-add-message" role="alert">{message}</p>}
  </div>;
}

/** The product card used by every renderer product list: the shared card plus quick add when the cart allows it. */
export function ProductCard({ product, editorProps }: { product: PublicProduct; editorProps?: Record<string, string> }) {
  const cart = useContext(CardCartContext);
  const quickAdd = cart && product.quickAdd && product.available !== false ? product.quickAdd : undefined;
  return <StorefrontProductCard product={product} editorProps={editorProps} actions={cart && quickAdd ? <QuickAdd product={{ ...product, quickAdd }} cart={cart} /> : undefined} />;
}
