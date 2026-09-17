"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { CartPanel } from "./cart-panel";
import { StoreHeader } from "./store-header";
import { useShop } from "@/contexts/shop-context";

export function StorefrontFrame({ storeSlug, children }: { storeSlug: string; children: React.ReactNode }) {
  const { repository } = useShop();
  const [cartOpen, setCartOpen] = useState(false);
  const store = repository.getStoreBySlug(storeSlug);
  if (!store) return <main className="store-missing"><span>404</span><h1>This Jelly Shop isn’t here.</h1><p>Try one of our storefronts instead.</p><Link className="button button-primary" href="/sweet-bakes">Visit Sweet Bakes</Link></main>;
  const style = {
    "--store-bg": store.theme.background,
    "--store-surface": store.theme.surface,
    "--store-text": store.theme.text,
    "--store-accent": store.theme.accent,
    "--store-accent-soft": store.theme.accentSoft,
    "--store-display": store.theme.displayFont === "serif" ? "Georgia" : "Arial Rounded MT Bold"
  } as CSSProperties;
  return <div className="storefront" style={style}><StoreHeader storeSlug={storeSlug} onCartOpen={() => setCartOpen(true)} />{children}<footer className="store-footer"><div><b>{store.name}</b><p>{store.tagline}</p></div><div><span>Shipping & returns</span><span>Care guide</span><span>Instagram</span></div><Link href="/admin">Made with Jelly Shop ↗</Link></footer><CartPanel storeSlug={storeSlug} open={cartOpen} onClose={() => setCartOpen(false)} /></div>;
}
