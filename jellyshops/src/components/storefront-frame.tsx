"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CartPanel } from "./cart-panel";
import { SharedCartPresentation, ThemedStorefrontShell } from "./storefront-shell";
import { useShop } from "@/contexts/shop-context";
import { loadPublicStorefrontPublication } from "@/features/storefront/public-storefront-api";
import { resolveStorefrontThemeTokens, resolveTheme, resolveThemeShellComponent } from "@jelly/storefront-themes";

export function StorefrontFrame({ storeSlug, children }: { storeSlug: string; children: React.ReactNode }) {
  const { repository, state } = useShop();
  const [cartOpen, setCartOpen] = useState(false);
  const store = repository.getStoreBySlug(storeSlug);
  const storeId = store?.id;
  const [publishedTheme, setPublishedTheme] = useState<{ id: string; version?: string; settings: Record<string, unknown> }>();
  useEffect(() => {
    if (!storeId) return;
    let active = true;
    void loadPublicStorefrontPublication({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001", storeId })
      .then((publication) => {
        if (!active || !publication) return;
        if (publication.kind === "v4") setPublishedTheme({ id: publication.snapshot.theme.id ?? publication.snapshot.theme.presetId, version: publication.snapshot.theme.version, settings: publication.snapshot.theme.settings });
        else setPublishedTheme({ id: publication.document.theme.presetId, settings: publication.document.theme.settings as unknown as Record<string, unknown> });
      });
    return () => { active = false; };
  }, [storeId]);
  if (!store) return <main className="store-missing"><span>404</span><h1>This Jelly Shop isn’t here.</h1><p>Check the storefront URL and try again.</p><Link className="button button-primary" href="/">Back to Jelly Shop</Link></main>;
  const resolvedTheme = resolveTheme(publishedTheme?.id, publishedTheme?.settings ?? {}, publishedTheme?.version);
  const cart = repository.getCartForStore(storeSlug);
  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const style = resolveStorefrontThemeTokens(resolvedTheme.id, resolvedTheme.settings, store.theme) as CSSProperties;
  const CartPresentation = resolveThemeShellComponent(resolvedTheme.id, "CartPanel", SharedCartPresentation);
  return <div style={style}><ThemedStorefrontShell themeId={resolvedTheme.id} settings={resolvedTheme.settings} store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} navigation={[{ label: "Home", href: `/${store.slug}` }, { label: "Shop all", href: `/${store.slug}/shop` }, { label: "Search", href: `/${store.slug}/search` }, { label: "Cart", href: `/${store.slug}/cart` }]} cartCount={cartCount} onCartOpen={() => setCartOpen(true)} cart={<CartPanel storeSlug={storeSlug} open={cartOpen} onClose={() => setCartOpen(false)} Presentation={CartPresentation} />}>{children}<span hidden>{state.version}</span></ThemedStorefrontShell></div>;
}
