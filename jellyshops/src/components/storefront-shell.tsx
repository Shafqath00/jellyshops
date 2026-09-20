"use client";
/* eslint-disable @next/next/no-img-element -- merchant-selected local media is a presentation asset. */

import Link from "next/link";
import { createContext, useContext } from "react";
import { ShoppingBag, X } from "lucide-react";
import { resolveThemeShell, type StorefrontCartProps, type StorefrontFooterProps, type StorefrontHeaderProps, type StorefrontLayoutProps, type StorefrontNavigationItem, type StorefrontShellStore } from "@jelly/storefront-themes";
import { SharedCartPage, SharedCheckoutPage, SharedCollectionPage, SharedContentPage, SharedOrderPage, SharedProductPage, SharedSearchPage } from "./storefront-pages";

export function SharedStorefrontLayout({ children, header, footer, cart }: StorefrontLayoutProps) {
  return <div className="storefront">{header}{children}{footer}{cart}</div>;
}
export function SharedStorefrontHeader({ store, navigation, cartCount, settings, onCartOpen }: StorefrontHeaderProps) {
  const header = settings.header && typeof settings.header === "object" ? settings.header as Record<string, unknown> : {};
  const variant = typeof header.variant === "string" ? header.variant : "logo-left";
  const showCart = header.showCart !== false;
  const showSearch = header.showSearch !== false;
  const branding = settings.branding && typeof settings.branding === "object" ? settings.branding as Record<string, unknown> : {};
  const logoUrl = typeof branding.logoUrl === "string" && branding.logoUrl ? branding.logoUrl : store.logoUrl;
  const visibleNavigation = navigation.filter((item) => showSearch || !item.href.endsWith("/search"));
  return <header className={`store-header store-header-${variant}`}><Link href={`/${store.slug}`} className="store-logo">{logoUrl ? <img src={logoUrl} alt={store.name} className="max-h-8 w-auto object-contain" /> : store.name}</Link><nav aria-label="Store navigation">{visibleNavigation.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>{showCart ? <button type="button" className="cart-button" onClick={onCartOpen} aria-label={`Open cart with ${cartCount} items`}><ShoppingBag size={19} /><span>Bag</span>{cartCount > 0 ? <b>{cartCount}</b> : null}</button> : null}</header>;
}
export function SharedStorefrontFooter({ store, settings }: StorefrontFooterProps) {
  const footer = settings.footer && typeof settings.footer === "object" ? settings.footer as Record<string, unknown> : {};
  const variant = typeof footer.variant === "string" ? footer.variant : "simple";
  return <footer className={`store-footer store-footer-${variant}`}><div><b>{store.name}</b>{footer.showDescription !== false ? <p>{store.tagline}</p> : null}</div><div><span>Shipping & returns</span><span>Care guide</span><span>Instagram</span></div><Link href="/admin">Made with Jelly Shop ↗</Link></footer>;
}
export function SharedCartPresentation({ open, onClose, children }: StorefrontCartProps) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] flex justify-end bg-jelly-ink/30 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="fixed right-0 top-0 flex min-h-full w-full max-w-[470px] flex-col bg-jelly-paper p-7 shadow-[-24px_0_70px_rgba(20,33,61,.18)]" role="dialog" aria-modal="true" aria-labelledby="cart-title"><button type="button" className="absolute right-7 top-7 grid size-[42px] place-items-center rounded-full border border-jelly-line bg-white" onClick={onClose} aria-label="Close cart"><X /></button>{children}</aside></div>;
}

export function ThemedStorefrontShell({ themeId, settings, store, navigation, cartCount, cart, children, onCartOpen }: {
  themeId?: string;
  settings: Record<string, unknown>;
  store: StorefrontShellStore;
  navigation: StorefrontNavigationItem[];
  cart: React.ReactNode;
  cartCount: number;
  children: React.ReactNode;
  onCartOpen(): void;
}) {
  const shell = resolveThemeShell(themeId, { Layout: SharedStorefrontLayout, Header: SharedStorefrontHeader, Footer: SharedStorefrontFooter, CartPanel: SharedCartPresentation, CollectionPage: SharedCollectionPage, ProductPage: SharedProductPage, SearchPage: SharedSearchPage, CartPage: SharedCartPage, CheckoutPage: SharedCheckoutPage, OrderPage: SharedOrderPage, ContentPage: SharedContentPage });
  const Header = shell.Header;
  const Footer = shell.Footer;
  const Layout = shell.Layout;
  return <ThemePresentationContext.Provider value={{ themeId, settings, shell }}><Layout store={store} settings={settings} header={<Header store={store} navigation={navigation} cartCount={cartCount} settings={settings} onCartOpen={onCartOpen} />} footer={<Footer store={store} settings={settings} />} cart={cart}>{children}</Layout></ThemePresentationContext.Provider>;
}

const ThemePresentationContext = createContext<{ themeId?: string; settings: Record<string, unknown>; shell: ReturnType<typeof resolveThemeShell> } | null>(null);
export function useThemePresentation() {
  const value = useContext(ThemePresentationContext);
  if (!value) throw new Error("useThemePresentation must be used inside ThemedStorefrontShell");
  return value;
}
