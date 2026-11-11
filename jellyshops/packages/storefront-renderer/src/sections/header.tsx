import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { elementProps } from "../element-style";
import { safeRichTextHref, type RuntimeMenuV4, type SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "../runtime-context";
import type { PublicProduct } from "../types";
import { resolveStorefrontHref } from "../runtime-context";
import { MenuTree, type MegaMenuOptions, type MenuVariant } from "./menu-tree";
import { StoreIcon } from "./store-icon";
import { TrustPointItems, trustPoints } from "./trust-points";
import { PredictiveSearch } from "./predictive-search";

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

/** The header's "Large menu" setting: a full-width panel with columns and photo tiles instead of dropdown lists. */
export function headerMegaMenu(settings: Record<string, unknown>): MegaMenuOptions | undefined {
  if (settings.menuStyle !== "mega") return undefined;
  const shape = settings.megaPhotoShape;
  return { photoShape: shape === "square" || shape === "portrait" ? shape : "landscape" };
}

function MenuLinks({ section, context, label = "Store navigation", variant, part, className }: { section: SectionNode; context: StorefrontRuntimeContext; label?: string; variant: MenuVariant; part?: "first" | "second"; className?: string }) {
  const block = section.blocks.find((entry) => entry.enabled && entry.type === "menu");
  const handle = typeof block?.settings.handle === "string" ? block.settings.handle : "main";
  const menu = Object.values(context.menus ?? {}).find(item => item.handle === handle);
  const all = menu?.items ?? [];
  const mega = variant === "flat" ? undefined : headerMegaMenu(section.settings);
  if (all.length === 0) return null;
  if (!part) return <nav aria-label={label} className={className}><MenuTree items={all} variant={variant} mega={mega} hrefFor={(item) => menuHref(item, context)} /></nav>;
  // The split layout puts the first half of the menu left of the logo and the rest on the right.
  const half = Math.ceil(all.length / 2);
  const items = part === "first" ? all.slice(0, half) : all.slice(half);
  return items.length > 0 ? <nav aria-label={label} className={className} data-menu-part={part}><MenuTree items={items} variant={variant} mega={mega} hrefFor={(item) => menuHref(item, context)} /></nav> : null;
}

/** Header layouts drawn by this section. "classic" adds no attribute, so older stores render exactly as before. */
export const HEADER_LAYOUTS = ["classic", "search-bar", "split", "minimal", "category-bar", "search-first"] as const;
export type HeaderLayout = (typeof HEADER_LAYOUTS)[number];

export function headerLayout(value: unknown): HeaderLayout {
  return HEADER_LAYOUTS.includes(value as HeaderLayout) ? value as HeaderLayout : "classic";
}

/** One navigation menu: top-level links (`flat`), or with its dropdowns (`bar`) or fold-out groups (`panel`). */
export function MenuList({ handle, context, variant = "flat" }: { handle: string; context: StorefrontRuntimeContext; variant?: MenuVariant }) {
  const items = Object.values(context.menus ?? {}).find(item => item.handle === handle)?.items ?? [];
  return <MenuTree items={items} variant={variant} hrefFor={(item) => menuHref(item, context)} />;
}

type ToolIcon = "search" | "account" | "wishlist" | "bag" | "menu" | "close";
const iconPaths: Record<ToolIcon, string> = {
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35",
  account: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
  wishlist: "M19.5 12.6 12 20l-7.5-7.4A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 7.5 6.5Z",
  bag: "M6 7h12l1 14H5L6 7Zm3 0a3 3 0 0 1 6 0",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
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

/**
 * The phone menu is a <details> element (works without JavaScript). This adds what a menu needs on top: Escape and a
 * tap outside close it (Escape returns focus to the menu button), and the button says whether it opens or closes.
 */
function usePhoneMenu(ref: RefObject<HTMLDetailsElement | null>): { open: boolean; onToggle(): void } {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const menu = ref.current;
    const doc = menu?.ownerDocument;
    if (!open || !menu || !doc) return;
    const close = (focus: boolean) => { menu.open = false; setOpen(false); if (focus) menu.querySelector("summary")?.focus(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(true); };
    const onPointer = (event: Event) => { if (!menu.contains(event.target as Node)) close(false); };
    doc.addEventListener("keydown", onKey);
    doc.addEventListener("pointerdown", onPointer);
    return () => { doc.removeEventListener("keydown", onKey); doc.removeEventListener("pointerdown", onPointer); };
  }, [open, ref]);
  return { open, onToggle: () => setOpen(Boolean(ref.current?.open)) };
}

/** The search box of the search-bar header layouts; suggests products while the shopper types (predictive search). */
function HeaderSearch({ action, suggest, autoFocus, onEscape }: { action: string; suggest?: (query: string, limit: number) => Promise<PublicProduct[]> | PublicProduct[]; autoFocus?: boolean; onEscape?(): void }) {
  return <PredictiveSearch action={action} suggest={suggest} autoFocus={autoFocus} onEscape={onEscape} icon={<StorefrontIcon name="search" />} />;
}

export function HeaderSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const headerRef = useRef<HTMLElement>(null);
  const settings = section.settings;
  const image = imageSetting(settings.logo);
  const logoUrl = image ? safeRichTextHref(image.url) : null;
  const name = typeof settings.storeName === "string" && settings.storeName.trim() ? settings.storeName : "Storefront";
  const logoWidth = typeof settings.logoWidth === "number" ? Math.min(240, Math.max(64, settings.logoWidth)) : undefined;
  const root = context.storeSlug ? `/${encodeURIComponent(context.storeSlug)}` : "";
  const layout = headerLayout(settings.layout);
  // Layouts with their own search box drop the search icon.
  const searchBar = layout === "search-bar" || layout === "category-bar" || layout === "search-first";
  const deliveryNote = layout === "search-first" && typeof settings.deliveryNote === "string" ? settings.deliveryNote.trim() : "";
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
  const editor = context.mode === "editor";
  const phoneMenuRef = useRef<HTMLDetailsElement>(null);
  const phoneMenu = usePhoneMenu(phoneMenuRef);
  // The search icon opens a search panel with suggestions when the store can suggest products (not in the editor).
  const suggest = editor ? undefined : context.commerce?.suggestProducts;
  const [searchOpen, setSearchOpen] = useState(false);
  const searchToolRef = useRef<HTMLAnchorElement>(null);
  return <header
    ref={headerRef}
    className="jelly-header"
    data-section-id={section.id}
    data-logo-position={layout === "search-bar" || layout === "split" || (layout === "classic" && settings.logoPosition === "center") ? "center" : "left"}
    data-header-layout={layout === "classic" ? undefined : layout}
    data-menu-style={settings.menuStyle === "mega" ? "mega" : undefined}
    data-tool-labels={settings.showToolLabels === true ? "true" : undefined}
    data-sticky={settings.sticky === true ? "true" : undefined}
    data-transparent={transparent ? "true" : undefined}
    data-scrolled={transparent && scrolled ? "true" : undefined}
    data-overlay-logo={overlayLogoUrl && !overlayLogoUrl.startsWith("#") ? "true" : undefined}
  >
    <details className="jelly-mobile-navigation" ref={phoneMenuRef} onToggle={phoneMenu.onToggle}>
      <summary aria-label={phoneMenu.open ? "Close menu" : "Open menu"}><StorefrontIcon name={phoneMenu.open ? "close" : "menu"} /><span className="jelly-visually-hidden">Menu</span></summary>
      <div className="jelly-mobile-navigation-panel">
        <MenuLinks section={section} context={context} label="Mobile navigation" variant="panel" />
        {tools.length > 0 && <nav aria-label="Account and saved items"><ul>{tools.filter(([icon]) => icon !== "search").map(([icon, label, href]) => <li key={icon}><a href={href}>{icon === "bag" ? "Shopping bag" : label}</a></li>)}</ul></nav>}
      </div>
    </details>
    {layout === "split" && <MenuLinks section={section} context={context} label="Primary navigation" variant="bar" part="first" className="jelly-header-menu-first" />}
    {layout === "search-bar" && <HeaderSearch action={`${root}/search`} suggest={suggest} />}
    <a className="jelly-header-brand" href={root || "/"} {...elementProps(section, "logo", editor, logoWidth ? { width: logoWidth } : undefined)}>
      {logoUrl && !logoUrl.startsWith("#") ? <img src={logoUrl} alt={image?.alt || name} /> : <span>{name}</span>}
      {/* Merchant media URLs may be served by the local API and are not Next Image assets. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {overlayLogoUrl && !overlayLogoUrl.startsWith("#") && <img className="jelly-header-overlay-logo" src={overlayLogoUrl} alt="" aria-hidden="true" />}
    </a>
    {deliveryNote && <p className="jelly-header-note" {...elementProps(section, "deliveryNote", editor)}><StoreIcon name="truck" /><span>{deliveryNote}</span></p>}
    {(layout === "category-bar" || layout === "search-first") && <HeaderSearch action={`${root}/search`} suggest={suggest} />}
    {layout === "split" ? <MenuLinks section={section} context={context} label="More navigation" variant="bar" part="second" className="jelly-header-menu-second" />
      : layout === "minimal" ? null
      : <MenuLinks section={section} context={context} label={layout === "search-first" ? "Departments" : "Primary navigation"} variant="bar" />}
    {showTools && <nav className="jelly-header-tools" aria-label="Shopping tools" {...elementProps(section, "tools", editor)}>
      {extraHref && <a href={extraHref} data-tool="extra" aria-label={extraLabel} {...elementProps(section, "extraLink", editor)}><StoreIcon name={settings.extraLinkIcon ?? "palette"} /><span className="jelly-header-tool-label">{extraLabel}</span></a>}
      {tools.map(([icon, label, href]) => {
        // The bag shows how many items it holds (Shopify's cart count bubble); screen readers hear "Bag, 3 items".
        const count = icon === "bag" && typeof context.commerce?.bagCount === "number" && context.commerce.bagCount > 0 ? context.commerce.bagCount : 0;
        if (icon === "search" && suggest) return <a key={icon} ref={searchToolRef} href={href} data-tool={icon} role="button" aria-label={label} aria-expanded={searchOpen} onClick={(event) => { event.preventDefault(); setSearchOpen((value) => !value); }} onKeyDown={(event) => { if (event.key === " ") { event.preventDefault(); setSearchOpen((value) => !value); } }}><StorefrontIcon name="search" /><span className="jelly-header-tool-label">{label}</span></a>;
        return <a key={icon} href={href} data-tool={icon} aria-label={count ? `${label}, ${count} ${count === 1 ? "item" : "items"}` : label}><StorefrontIcon name={icon} /><span className="jelly-header-tool-label">{label}</span>{count > 0 && <span className="jelly-header-count" aria-hidden="true">{count > 99 ? "99+" : count}</span>}</a>;
      })}
    </nav>}
    {searchOpen && suggest && <div className="jelly-header-search-panel"><HeaderSearch action={`${root}/search`} suggest={suggest} autoFocus onEscape={() => { setSearchOpen(false); searchToolRef.current?.focus(); }} /></div>}
    {trust.length > 0 && <ul className="jelly-header-trust" aria-label="Why shop with us"><TrustPointItems points={trust} icons /></ul>}
  </header>;
}
