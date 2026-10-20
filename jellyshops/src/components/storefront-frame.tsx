"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CartPanel } from "./cart-panel";
import { SharedCartPresentation, ThemedStorefrontShell } from "./storefront-shell";
import { useShop } from "@/contexts/shop-context";
import { loadPublicStorefrontPublication } from "@/features/storefront/public-storefront-api";
import { resolveStorefrontThemeTokens, resolveTheme, resolveThemeShellComponent } from "@jelly/storefront-themes";
import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";
import { StorefrontChromeContext } from "@/features/storefront/chrome-context";
import { RegistrySectionRenderer } from "@jelly/storefront-renderer";
import type { SectionNode } from "@jelly/storefront-schema";

export function StorefrontFrame({ storeSlug, children }: { storeSlug: string; children: React.ReactNode }) {
  const { repository, state } = useShop();
  const [cartOpen, setCartOpen] = useState(false);
  const store = repository.getStoreBySlug(storeSlug);
  const storeId = store?.id;
  const initialPublication = useInitialStorefrontPublication();
  const initialTheme = initialPublication?.kind === "v4" ? { id: initialPublication.snapshot.theme.id ?? initialPublication.snapshot.theme.presetId, version: initialPublication.snapshot.theme.version, settings: initialPublication.snapshot.theme.settings } : initialPublication?.kind === "v3" ? { id: initialPublication.document.theme.presetId, settings: initialPublication.document.theme.settings as unknown as Record<string, unknown> } : undefined;
  const [publishedTheme, setPublishedTheme] = useState<{ id: string; version?: string; settings: Record<string, unknown> } | undefined>(initialTheme);
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
  const signature = resolvedTheme.id === "jelly-signature" && initialPublication?.kind === "v4";
  const snapshot = initialPublication?.kind === "v4" ? initialPublication.snapshot : null;
  const branding = resolvedTheme.settings.branding as { logoUrl?: string } | undefined;
  const headerSettings = resolvedTheme.settings.header as Record<string, unknown> | undefined;
  const globals = snapshot ? Object.values(snapshot.globalSections).map((item) => item.section as unknown as SectionNode) : [];
  const renderGlobal = (section: SectionNode) => <RegistrySectionRenderer key={section.id} section={section.type === "header" ? { ...section, settings: { ...headerSettings, ...section.settings, storeName: section.settings.storeName || store.name, ...(branding?.logoUrl ? { logo: { url: branding.logoUrl, alt: store.name } } : {}) } } : section} mode="published" commerce={{ getProducts: async () => [] }} region={section.type === "footer" ? "footer" : "header"} themeId={resolvedTheme.id} menus={snapshot?.menus} storeSlug={store.slug} />;
  const headerContent = signature ? <>{globals.filter((item) => item.type === "announcement-bar").map(renderGlobal)}{globals.filter((item) => item.type === "header").map(renderGlobal)}</> : undefined;
  const footerContent = signature ? <>{globals.filter((item) => item.type === "footer").map(renderGlobal)}</> : undefined;
  return <StorefrontChromeContext.Provider value={Boolean(signature)}><div data-jelly-theme={resolvedTheme.id} style={style}><ThemedStorefrontShell headerContent={headerContent} footerContent={footerContent} themeId={resolvedTheme.id} settings={resolvedTheme.settings} store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} navigation={[{ label: "Home", href: `/${store.slug}` }, { label: "Shop all", href: `/${store.slug}/shop` }, { label: "Search", href: `/${store.slug}/search` }, { label: "Cart", href: `/${store.slug}/cart` }, { label: "Account", href: `/${store.slug}/account` }, { label: "Wishlist", href: `/${store.slug}/wishlist` }]} cartCount={cartCount} onCartOpen={() => setCartOpen(true)} cart={<CartPanel storeSlug={storeSlug} open={cartOpen} onClose={() => setCartOpen(false)} Presentation={CartPresentation} />}>{children}<span hidden>{state.version}</span></ThemedStorefrontShell></div></StorefrontChromeContext.Provider>;
}
