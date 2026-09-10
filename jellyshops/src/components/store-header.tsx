"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useShop } from "@/contexts/shop-context";

export function StoreHeader({ storeSlug, onCartOpen }: { storeSlug: string; onCartOpen: () => void }) {
  const { repository, state } = useShop();
  const store = repository.getStoreBySlug(storeSlug);
  const cart = repository.getCartForStore(storeSlug);
  const count = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  if (!store) return null;
  return (
    <header className="store-header">
      <Link href={`/${store.slug}`} className="store-logo">{store.name}</Link>
      <nav aria-label="Store navigation"><Link href={`/${store.slug}`}>Home</Link><Link href={`/${store.slug}/shop`}>Shop all</Link></nav>
      <button type="button" className="cart-button" onClick={onCartOpen} aria-label={`Open cart with ${count} items`}><ShoppingBag size={19} /><span>Bag</span>{count > 0 ? <b>{count}</b> : null}</button>
      <span hidden>{state.version}</span>
    </header>
  );
}
