"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { CheckoutFooter, CheckoutHeader } from "@/features/checkout/components/checkout-chrome";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useResourceLinks } from "@/features/navigation/use-resource-links";
import { CartPanel } from "./cart-panel";
import { SharedCartPresentation, ThemedStorefrontShell } from "./storefront-shell";
import { useShop } from "@/contexts/shop-context";
import { cartDrawerVariant, freeDeliveryThresholdMinor, isCompleteStorefrontTheme, mainLanguageName, resolveStorefrontThemeTokens, resolveTheme, resolveThemeShellComponent, storeLanguages, themeSocialLinks, legacyStylesAttribute, themeStyleId, usesCartDrawer, usesProductCompare, themeRootAttributes } from "@jelly/storefront-themes/runtime";
import { ThemeCartDrawer } from "./theme-cart-drawer";
import { CompareTray } from "./compare-tray";
import { CookieSettingsLink, StorePrivacy } from "./store-privacy";
import { allPolicyLinks, policyLinks, storeSocialLinks } from "../policy-links";
import { useInitialNavigationResources, useStorePreferences } from "../storefront-bootstrap";
import { LanguageSwitcher, StorefrontLanguageContext, useStorefrontLanguageState } from "@/features/storefront/storefront-language";
import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";
import { StorefrontChromeContext } from "@/features/storefront/chrome-context";
import { PREVIEW_MENUS_EVENT, withDraftMenus } from "@/features/storefront/content-preview-messages";
import { RegistrySectionRenderer, ThemeCustomCss, cartDrawerSectionSettings, createCollectionLinks, withStoreIdentity } from "@jelly/storefront-renderer";
import type { RuntimeTemplateV4, SectionNode } from "@jelly/storefront-schema";
import { useChromeBindingValues } from "@/features/storefront/use-chrome-binding-values";
import { suggestStoreProducts } from "@/features/storefront/product-suggestions";
import { engagementActions } from "@/features/storefront/engagement-api";
import { storePagePath, storePath } from "@jelly/storefront-schema";

function pageTypeFor(segments: string[]): RuntimeTemplateV4["type"] {
  if (!segments.length) return "home";
  if (segments[0] === "account") {
    const accountPages: Record<string, RuntimeTemplateV4["type"]> = { login: "customer-login", register: "customer-register", recover: "customer-recovery", addresses: "customer-addresses" };
    return segments[1] === "orders" ? (segments[2] ? "customer-order" : "customer-orders") : accountPages[segments[1]] ?? "customer-account";
  }
  const pages: Record<string, RuntimeTemplateV4["type"]> = { products: "product", collections: "collection", shop: "collection", pages: "page", blogs: segments[2] ? "article" : "blog", search: "search", cart: "cart", checkout: "checkout", wishlist: "wishlist", order: "order-success" };
  return pages[segments[0]] ?? "not-found";
}

export function StorefrontFrame({ storeSlug, children }: { storeSlug: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { repository, state } = useShop();
  const [cartOpen, setCartOpen] = useState(false);
  const store = repository.getStoreBySlug(storeSlug);
  const storeId = store?.id;
  const resourceLinks = useResourceLinks(storeId ?? "", storeSlug, state.products);
  const initialPublication = useInitialStorefrontPublication();
  const initialTheme = initialPublication?.kind === "v4" ? { id: initialPublication.snapshot.theme.id ?? initialPublication.snapshot.theme.presetId, version: initialPublication.snapshot.theme.version, settings: initialPublication.snapshot.theme.settings } : initialPublication?.kind === "v3" ? { id: initialPublication.document.theme.presetId, settings: initialPublication.document.theme.settings as unknown as Record<string, unknown> } : undefined;
  const [publishedTheme, setPublishedTheme] = useState<{ id: string; version?: string; settings: Record<string, unknown> } | undefined>(initialTheme);
  const snapshot = initialPublication?.kind === "v4" ? initialPublication.snapshot : null;
  // Overlay group (T6 part 2): a slide-out bag section there switches the bag drawer on and sets its words.
  const bagSection = snapshot?.sectionGroups?.overlay.map((id) => snapshot.globalSections[id]?.section as unknown as SectionNode | undefined).find((section) => section?.type === "cart-drawer" && section.enabled !== false);
  const bagSettings = bagSection ? cartDrawerSectionSettings(bagSection) : null;
  // Slide-out bag (theme settings > Cart, or the overlay section): the header's bag link and Add to cart open it instead of the bag page.
  const cartDrawer = Boolean(bagSettings) || usesCartDrawer(publishedTheme?.settings);
  const compareTray = usesProductCompare(publishedTheme?.settings);
  // Settings > Store preferences: policy links under the footer (those no menu already links), cookie banner, tracking.
  const preferences = useStorePreferences();
  const navigationResources = useInitialNavigationResources()?.resources;
  const legalLinks = policyLinks(storeSlug, preferences, navigationResources, snapshot?.menus);
  const privacyHref = allPolicyLinks(storeSlug, preferences, navigationResources).find((link) => link.kind === "privacy")?.href ?? null;
  useEffect(() => {
    if (!cartDrawer) return;
    const open = () => setCartOpen(true);
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link || !link.closest(".jelly-header, .jelly-mobile-navigation-panel")) return;
      if (new URL((link as HTMLAnchorElement).href, window.location.href).pathname !== storePath(storeSlug, "/cart")) return;
      event.preventDefault();
      link.closest("details")?.removeAttribute("open");
      open();
    };
    window.addEventListener("jelly:cart-added", open);
    document.addEventListener("click", click);
    return () => { window.removeEventListener("jelly:cart-added", open); document.removeEventListener("click", click); };
  }, [cartDrawer, storeSlug]);
  const languageState = useStorefrontLanguageState(storeSlug, storeLanguages(publishedTheme?.settings), mainLanguageName(publishedTheme?.settings));
  // The server already sent the published design (storefront bootstrap); the browser only asks for it when it did not.
  const hasInitialPublication = Boolean(initialPublication);
  useEffect(() => {
    if (!storeId || hasInitialPublication) return;
    let active = true;
    // Loaded when needed: it checks the publication with the schema library, which store pages otherwise never download.
    void import("@/features/storefront/public-storefront-api").then(({ loadPublicStorefrontPublication }) => loadPublicStorefrontPublication({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001", storeId }))
      .then((publication) => {
        if (!active || !publication) return;
        if (publication.kind === "v4") setPublishedTheme({ id: publication.snapshot.theme.id ?? publication.snapshot.theme.presetId, version: publication.snapshot.theme.version, settings: publication.snapshot.theme.settings });
        else setPublishedTheme({ id: publication.document.theme.presetId, settings: publication.document.theme.settings as unknown as Record<string, unknown> });
      });
    return () => { active = false; };
  }, [storeId, hasInitialPublication]);
  // The same page path on the server (/sites/<slug>/...) and in the browser (/<slug>/... or a subdomain's /...).
  const segments = storePagePath(storeSlug, pathname ?? "").split("/").filter(Boolean);
  const pageType = pageTypeFor(segments);
  // On the admin's draft preview, the header and footer show the unsaved menus it sent.
  const onPreview = segments[0] === "jelly-preview";
  const [previewMenus, setPreviewMenus] = useState<Record<string, unknown[]> | null>(null);
  useEffect(() => {
    if (!onPreview) return;
    const listener = (event: Event) => setPreviewMenus((event as CustomEvent<Record<string, unknown[]>>).detail);
    window.addEventListener(PREVIEW_MENUS_EVENT, listener);
    return () => window.removeEventListener(PREVIEW_MENUS_EVENT, listener);
  }, [onPreview]);
  const chromeMenus = onPreview && previewMenus && snapshot ? withDraftMenus(snapshot, previewMenus).menus : snapshot?.menus;
  const resource = pageType === "product" ? state.products.find((product) => product.storeId === storeId && product.slug === segments[1])
    : pageType === "collection" ? state.collections.find((collection) => collection.storeId === storeId && collection.slug === segments[1]) : undefined;
  const assignment = resource ? snapshot?.assignments.find((item) => item.resourceType === pageType && item.resourceId === resource.id) : undefined;
  const assignedTemplate = assignment ? snapshot?.templates[assignment.templateId] : undefined;
  const templateId = snapshot?.templateDefaults[pageType] ?? snapshot?.templateDefaults.home;
  const template = assignedTemplate?.type === pageType ? assignedTemplate : templateId ? snapshot?.templates[templateId] : undefined;
  // Saved global sections can include old themes. Render only placements in the selected template.
  // Header, announcement and footer settings connected to custom fields show the store's (or this product's) values.
  const layout = useChromeBindingValues(snapshot, template, resource && (pageType === "product" || pageType === "collection") ? { type: pageType, id: resource.id } : undefined);
  if (!store) return <main className="store-missing"><span>404</span><h1>This store isn’t here.</h1><p>Check the storefront URL and try again.</p><Link className="button button-primary" href="/">Back to Jellyshop</Link></main>;
  const resolvedTheme = resolveTheme(publishedTheme?.id, publishedTheme?.settings ?? {}, publishedTheme?.version);
  const cart = repository.getCartForStore(storeSlug);
  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const style = resolveStorefrontThemeTokens(resolvedTheme.id, resolvedTheme.settings, store.theme, resolvedTheme.version) as CSSProperties;
  const CartPresentation = resolveThemeShellComponent(resolvedTheme.id, "CartPanel", SharedCartPresentation, resolvedTheme.version);
  const signature = isCompleteStorefrontTheme(resolvedTheme.id, resolvedTheme.version) && initialPublication?.kind === "v4";
  const branding = resolvedTheme.settings.branding as { logoUrl?: string } | undefined;
  const headerSettings = resolvedTheme.settings.header as Record<string, unknown> | undefined;
  // Search suggestions in the header come from the store's published products.
  const suggestProducts = suggestStoreProducts(state.products.filter((product) => product.storeId === store.id), store.slug, store.currency);
  const renderGlobal = (section: SectionNode, region: "header" | "footer" = section.type === "footer" ? "footer" : "header") => <RegistrySectionRenderer key={section.id} section={withStoreIdentity(section, { name: store.name, logoUrl: branding?.logoUrl || undefined, headerSettings, socialLinks: storeSocialLinks(preferences, themeSocialLinks(resolvedTheme.settings)) })} mode="published" commerce={{ getProducts: async () => [], bagCount: cartCount, suggestProducts, ...engagementActions(store.id) }} region={region} themeId={resolvedTheme.id} themeVersion={resolvedTheme.version} menus={chromeMenus} resourceLinks={resourceLinks} collectionLinks={createCollectionLinks(store.id, store.slug, state.collections)} storeSlug={store.slug} language={languageState.language} />;
  const onCheckout = segments[0] === "checkout" || segments[0] === "order";
  const headerContent = onCheckout ? <CheckoutHeader store={{ ...store, logoUrl: branding?.logoUrl || store.logoUrl }} /> : signature ? <>{layout?.announcement.map((section) => renderGlobal(section, "header"))}{layout?.header.map((section) => renderGlobal(section, "header"))}</> : undefined;
  // Pop-ups from the overlay group open over the page themselves; the slide-out bag section only sets the drawer.
  const footerContent = onCheckout ? <CheckoutFooter store={store} policies={navigationResources ? allPolicyLinks(storeSlug, preferences, navigationResources) : null} /> : signature ? <>{layout?.footer.map((section) => renderGlobal(section, "footer"))}{layout?.overlay?.filter((section) => section.type !== "cart-drawer").map((section) => renderGlobal(section, "footer"))}<LanguageSwitcher /></> : undefined;
  return <StorefrontLanguageContext.Provider value={languageState}><StorefrontChromeContext.Provider value={Boolean(signature)}><div data-jelly-theme={themeStyleId(resolvedTheme.id, resolvedTheme.version)} data-jelly-legacy-styles={legacyStylesAttribute(resolvedTheme.id, resolvedTheme.version)} data-jelly-theme-version={resolvedTheme.version} {...themeRootAttributes(style)} style={style} lang={languageState.language ?? preferences.business.language}><ThemeCustomCss settings={resolvedTheme.settings} themeId={resolvedTheme.id} themeVersion={resolvedTheme.version} /><ThemedStorefrontShell headerContent={headerContent} footerContent={footerContent} themeId={resolvedTheme.id} themeVersion={resolvedTheme.version} settings={resolvedTheme.settings} store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} navigation={[{ label: "Home", href: storePath(store.slug) }, { label: "Shop all", href: storePath(store.slug, "/shop") }, { label: "Search", href: storePath(store.slug, "/search") }, { label: "Cart", href: storePath(store.slug, "/cart") }, { label: "Account", href: storePath(store.slug, "/account") }, { label: "Wishlist", href: storePath(store.slug, "/wishlist") }]} cartCount={cartCount} onCartOpen={() => setCartOpen(true)} cart={signature && cartDrawer ? null : <CartPanel storeSlug={storeSlug} open={cartOpen} onClose={() => setCartOpen(false)} Presentation={CartPresentation} />}>{children}<span hidden>{state.version}</span></ThemedStorefrontShell>{signature && cartDrawer && <ThemeCartDrawer storeSlug={storeSlug} open={cartOpen} onClose={() => setCartOpen(false)} variant={bagSettings?.variant ?? cartDrawerVariant(publishedTheme?.settings)} freeDeliveryFromMinor={bagSettings ? bagSettings.freeDeliveryFromMinor : freeDeliveryThresholdMinor(publishedTheme?.settings)} heading={bagSettings?.heading} emptyText={bagSettings?.emptyText} />}{signature && compareTray && <CompareTray storeSlug={storeSlug} />}{!onCheckout && legalLinks.length > 0 && <nav className="jelly-legal-links" aria-label="Policies"><ul>{legalLinks.map((link) => <li key={link.kind}><Link href={link.href}>{link.label}</Link></li>)}<li><CookieSettingsLink className="jelly-legal-links-button" /></li></ul></nav>}<StorePrivacy storeId={store.id} mode={preferences.privacy.cookieBanner} message={preferences.privacy.cookieMessage} tracking={preferences.tracking} privacyHref={privacyHref} /></div></StorefrontChromeContext.Provider></StorefrontLanguageContext.Provider>;
}
