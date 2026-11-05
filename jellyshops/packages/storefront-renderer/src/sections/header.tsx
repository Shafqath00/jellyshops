import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { safeRichTextHref, type RuntimeMenuV4, type SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { resolveStorefrontHref } from "../runtime-context";
import { MenuTree, type MenuVariant } from "./menu-tree";
import { StoreIcon } from "./store-icon";
import { TrustPointItems, trustPoints } from "./trust-points";

type RuntimeMenuItem = RuntimeMenuV4["items"][number];

function menuHref(item: RuntimeMenuItem, context: StorefrontRuntimeContext): string | null {
  const { storeSlug } = context;
  const target = item.target;
  // A path ("/search?q=Beds", "/pages/faq") is a page of this store, so it goes under the store's address.
  if (target.kind === "external") return target.url.startsWith("/") && !target.url.startsWith("//") ? resolveStorefrontHref(target.url, storeSlug) : safeRichTextHref(target.url);
  if (target.kind === "anchor") return safeRichTextHref(target.anchor.startsWith("#") ? target.anchor : `#${target.anchor}`);
  if (target.kind === "collection") return safeRichTextHref(context.collectionLinks?.[target.resourceId]);
  if (!storeSlug) return target.kind === "home" ? "/" : target.kind === "search" ? "/search" : null;
  const root = `/${encodeURIComponent(storeSlug)}`;
  if (target.kind === "home") return root;
  if (target.kind === "search") return `${root}/search`;
  return safeRichTextHref(context.resourceLinks?.[`${target.kind}:${target.resourceId}`]);
}

function MenuLinks({ section, context, label = "Store navigation", variant }: { section: SectionNode; context: StorefrontRuntimeContext; label?: string; variant: MenuVariant }) {
  const block = section.blocks.find((entry) => entry.enabled && entry.type === "menu");
  const handle = typeof block?.settings.handle === "string" ? block.settings.handle : "main";
  const menu = Object.values(context.menus ?? {}).find(item => item.handle === handle);
  return (menu?.items.length ?? 0) > 0 ? <nav aria-label={label}><MenuList handle={handle} context={context} variant={variant} /></nav> : null;
}

/** One navigation menu: top-level links (`flat`), or with its dropdowns (`bar`) or fold-out groups (`panel`). */
export function MenuList({ handle, context, variant = "flat" }: { handle: string; context: StorefrontRuntimeContext; variant?: MenuVariant }) {
  const items = Object.values(context.menus ?? {}).find(item => item.handle === handle)?.items ?? [];
  return <MenuTree items={items} variant={variant} hrefFor={(item) => menuHref(item, context)} />;
}

type ToolIcon = "search" | "account" | "wishlist" | "bag" | "menu";
const iconPaths: Record<ToolIcon, string> = {
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35",
  account: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
  wishlist: "M19.5 12.6 12 20l-7.5-7.4A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 7.5 6.5Z",
  bag: "M6 7h12l1 14H5L6 7Zm3 0a3 3 0 0 1 6 0",
  menu: "M4 7h16M4 12h16M4 17h16",
};

function StorefrontIcon({ name }: { name: ToolIcon }) {
  return <svg className="jelly-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={iconPaths[name]} /></svg>;
}

function imageSetting(value: unknown): { url: string; alt?: string } | undefined {
  return value && typeof value === "object" && "url" in value && typeof value.url === "string" ? value as { url: string; alt?: string } : undefined;
}

/** True once the page holding `ref` has scrolled; a transparent header turns solid then. */
function useScrolled(ref: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const view = ref.current?.ownerDocument.defaultView;
    if (!enabled || !view) return;
    const update = () => setScrolled(view.scrollY > 8);
    update();
    view.addEventListener("scroll", update, { passive: true });
    return () => view.removeEventListener("scroll", update);
  }, [ref, enabled]);
  return scrolled;
}

/** The search box of the "search bar" header layout; sends shoppers to the store's search page. */
function HeaderSearch({ action }: { action: string }) {
  const id = useId();
  return <form className="jelly-header-search" role="search" aria-label="Search the store" action={action} method="get">
    <label className="jelly-visually-hidden" htmlFor={id}>Search products</label>
    <input id={id} name="q" type="search" placeholder="Search products" autoComplete="off" />
    <button type="submit" aria-label="Search"><StorefrontIcon name="search" /></button>
  </form>;
}

export function HeaderSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const headerRef = useRef<HTMLElement>(null);
  const settings = section.settings;
  const image = imageSetting(settings.logo);
  const logoUrl = image ? safeRichTextHref(image.url) : null;
  const name = typeof settings.storeName === "string" && settings.storeName.trim() ? settings.storeName : "Storefront";
  const logoWidth = typeof settings.logoWidth === "number" ? Math.min(240, Math.max(64, settings.logoWidth)) : undefined;
  const root = context.storeSlug ? `/${encodeURIComponent(context.storeSlug)}` : "";
  const searchBar = settings.layout === "search-bar";
  const tools = context.storeSlug ? ([
    ["search", "Search", `${root}/search`, settings.showSearch],
    ["account", "Account", `${root}/account`, settings.showAccount],
    ["wishlist", "Wishlist", `${root}/wishlist`, settings.showWishlist],
    ["bag", "Bag", `${root}/cart`, settings.showCart],
  ] as const).filter(([icon, , , visible]) => visible !== false && !(searchBar && icon === "search")) : [];
  const extraLabel = typeof settings.extraLinkLabel === "string" ? settings.extraLinkLabel.trim() : "";
  const extraHref = extraLabel ? resolveStorefrontHref(settings.extraLink, context.storeSlug) : null;
  const trust = trustPoints(section.blocks, context).slice(0, 6);
  const showTools = tools.length > 0 || Boolean(extraHref);
  const transparent = settings.transparent === true;
  const overlayImage = transparent ? imageSetting(settings.overlayLogo) : undefined;
  const overlayLogoUrl = overlayImage ? safeRichTextHref(overlayImage.url) : null;
  const scrolled = useScrolled(headerRef, transparent);
  return <header
    ref={headerRef}
    className="jelly-header"
    data-section-id={section.id}
    data-logo-position={searchBar || settings.logoPosition === "center" ? "center" : "left"}
    data-header-layout={searchBar ? "search-bar" : undefined}
    data-tool-labels={settings.showToolLabels === true ? "true" : undefined}
    data-sticky={settings.sticky === true ? "true" : undefined}
    data-transparent={transparent ? "true" : undefined}
    data-scrolled={transparent && scrolled ? "true" : undefined}
    data-overlay-logo={overlayLogoUrl && !overlayLogoUrl.startsWith("#") ? "true" : undefined}
  >
    <details className="jelly-mobile-navigation">
      <summary aria-label="Open menu"><StorefrontIcon name="menu" /><span className="jelly-visually-hidden">Menu</span></summary>
      <div className="jelly-mobile-navigation-panel">
        <MenuLinks section={section} context={context} label="Mobile navigation" variant="panel" />
        {tools.length > 0 && <nav aria-label="Account and saved items"><ul>{tools.filter(([icon]) => icon !== "search").map(([icon, label, href]) => <li key={icon}><a href={href}>{icon === "bag" ? "Shopping bag" : label}</a></li>)}</ul></nav>}
      </div>
    </details>
    {searchBar && <HeaderSearch action={`${root}/search`} />}
    <a className="jelly-header-brand" href={root || "/"} style={logoWidth ? { width: logoWidth } : undefined}>
      {logoUrl && !logoUrl.startsWith("#") ? <img src={logoUrl} alt={image?.alt || name} /> : <span>{name}</span>}
      {/* Merchant media URLs may be served by the local API and are not Next Image assets. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {overlayLogoUrl && !overlayLogoUrl.startsWith("#") && <img className="jelly-header-overlay-logo" src={overlayLogoUrl} alt="" aria-hidden="true" />}
    </a>
    <MenuLinks section={section} context={context} label="Primary navigation" variant="bar" />
    {showTools && <nav className="jelly-header-tools" aria-label="Shopping tools">
      {extraHref && <a href={extraHref} data-tool="extra" aria-label={extraLabel}><StoreIcon name={settings.extraLinkIcon ?? "palette"} /><span className="jelly-header-tool-label">{extraLabel}</span></a>}
      {tools.map(([icon, label, href]) => <a key={icon} href={href} data-tool={icon} aria-label={label}><StorefrontIcon name={icon} /><span className="jelly-header-tool-label">{label}</span></a>)}
    </nav>}
    {trust.length > 0 && <ul className="jelly-header-trust" aria-label="Why shop with us"><TrustPointItems points={trust} icons /></ul>}
  </header>;
}
