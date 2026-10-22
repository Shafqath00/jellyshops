"use client";
/* eslint-disable @next/next/no-img-element -- merchant-selected local media is a presentation asset. */

import Link from "next/link";
import clsx from "clsx";
import { createContext, useContext } from "react";
import { ShoppingBag } from "lucide-react";
import { resolveThemeShell, type StorefrontCartProps, type StorefrontFooterProps, type StorefrontHeaderProps, type StorefrontLayoutProps, type StorefrontNavigationItem, type StorefrontShellStore } from "@jelly/storefront-themes";
import { SharedCartPage, SharedCheckoutPage, SharedCollectionPage, SharedContentPage, SharedOrderPage, SharedProductPage, SharedSearchPage } from "./storefront-pages";
import { CartBadge } from "@/components/jelly/cart";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function SharedStorefrontLayout({ children, header, footer, cart }: StorefrontLayoutProps) {
  return <div className="min-h-dvh bg-[var(--store-bg)] text-[var(--store-text)] [font-family:var(--theme-font-body)]">{header}{children}{footer}{cart}</div>;
}
export function SharedStorefrontHeader({ store, navigation, cartCount, settings, onCartOpen }: StorefrontHeaderProps) {
  const header = settings.header && typeof settings.header === "object" ? settings.header as Record<string, unknown> : {};
  const variant = typeof header.variant === "string" ? header.variant : "logo-left";
  const showCart = header.showCart !== false;
  const showSearch = header.showSearch !== false;
  const branding = settings.branding && typeof settings.branding === "object" ? settings.branding as Record<string, unknown> : {};
  const logoUrl = typeof branding.logoUrl === "string" && branding.logoUrl ? branding.logoUrl : store.logoUrl;
  const visibleNavigation = navigation.filter((item) => showSearch || !item.href.endsWith("/search"));
  return <header className={clsx(
    "sticky top-0 z-20 grid h-[74px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-[var(--theme-border)] bg-[color-mix(in_srgb,var(--store-bg)_92%,transparent)] px-[clamp(20px,5vw,72px)] backdrop-blur-[16px] max-[720px]:grid-cols-[minmax(0,1fr)_auto] max-[720px]:px-4",
    variant === "compact" && "h-[58px] [&_nav]:gap-[14px] [&_nav]:text-[11px]",
  )}>
    <Link href={`/${store.slug}`} className={clsx(
      "col-start-1 min-w-0 truncate justify-self-start text-[22px] font-bold tracking-[-0.04em] [font-family:var(--store-display,Georgia,serif)]",
      variant === "logo-centered" && "col-start-2 justify-self-center max-[720px]:col-start-1 max-[720px]:justify-self-start",
    )}>
      {logoUrl ? <img src={logoUrl} alt={store.name} className="max-h-8 w-auto object-contain" /> : store.name}
    </Link>
    <nav aria-label="Store navigation" className={clsx(
      "col-start-2 row-start-1 flex min-w-0 items-center justify-center gap-6 text-[13px] font-bold max-[720px]:hidden",
      variant === "logo-centered" && "col-start-1 justify-self-start",
    )}>{visibleNavigation.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
    {showCart ? <button type="button" className="col-start-3 flex min-h-10 items-center justify-self-end gap-[7px] rounded-full border border-[var(--theme-border)] bg-transparent px-3 text-inherit transition-colors hover:bg-[color-mix(in_srgb,var(--store-surface)_75%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--store-accent)] max-[720px]:col-start-2" onClick={onCartOpen} aria-label={`Open cart with ${cartCount} items`}><ShoppingBag size={19} /><span className="max-[720px]:hidden">Bag</span><CartBadge count={cartCount} /></button> : null}
  </header>;
}
export function SharedStorefrontFooter({ store, settings }: StorefrontFooterProps) {
  const footer = settings.footer && typeof settings.footer === "object" ? settings.footer as Record<string, unknown> : {};
  const variant = typeof footer.variant === "string" ? footer.variant : "simple";
  return <footer className={clsx(
    "grid min-h-[230px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-[50px] bg-[var(--store-text)] px-[clamp(20px,6vw,90px)] py-[54px] text-[var(--store-bg)] max-[800px]:grid-cols-1",
    "[&>div:first-child_b]:text-[25px] [&>div:first-child_b]:[font-family:var(--store-display,Georgia,serif)] [&>div:first-child_p]:mt-[7px] [&>div:first-child_p]:text-[11px] [&>div:first-child_p]:opacity-60",
    "[&>div:nth-child(2)]:grid [&>div:nth-child(2)]:gap-[9px] [&>div:nth-child(2)]:text-[11px] [&>a]:justify-self-end [&>a]:text-[10px] [&>a]:opacity-65 max-[800px]:[&>a]:justify-self-start",
    variant === "simple" && "[&>div:nth-child(2)]:hidden",
    variant === "newsletter" && "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]",
  )}><div><b>{store.name}</b>{footer.showDescription !== false ? <p>{store.tagline}</p> : null}</div><div><span>Shipping &amp; returns</span><span>Care guide</span><span>Instagram</span></div><Link href="/admin">Made with Jelly Shop ↗</Link></footer>;
}
export function SharedCartPresentation({ open, onClose, children }: StorefrontCartProps) {
  if (!open) return null;
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}><DialogContent aria-labelledby="cart-title" className="left-auto right-0 top-0 h-dvh max-w-[470px] translate-x-0 translate-y-0 overflow-auto rounded-none bg-[var(--store-surface)] p-7 text-[var(--store-text)] shadow-[-24px_0_70px_rgba(20,33,61,.16)]">{children}</DialogContent></Dialog>;
}

export function ThemedStorefrontShell({ themeId, settings, store, navigation, cartCount, cart, children, onCartOpen, headerContent, footerContent }: {
  headerContent?: React.ReactNode;
  footerContent?: React.ReactNode;
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
  return <ThemePresentationContext.Provider value={{ themeId, settings, shell }}><Layout store={store} settings={settings} header={headerContent ?? <Header store={store} navigation={navigation} cartCount={cartCount} settings={settings} onCartOpen={onCartOpen} />} footer={footerContent ?? <Footer store={store} settings={settings} />} cart={cart}>{children}</Layout></ThemePresentationContext.Provider>;
}

const ThemePresentationContext = createContext<{ themeId?: string; settings: Record<string, unknown>; shell: ReturnType<typeof resolveThemeShell> } | null>(null);
export function useThemePresentation() {
  const value = useContext(ThemePresentationContext);
  if (!value) throw new Error("useThemePresentation must be used inside ThemedStorefrontShell");
  return value;
}
