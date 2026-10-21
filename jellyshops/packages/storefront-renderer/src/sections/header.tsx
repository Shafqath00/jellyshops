import { safeRichTextHref, type RuntimeMenuV4, type SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "../runtime-context";

type RuntimeMenuItem = RuntimeMenuV4["items"][number];

function menuHref(item: RuntimeMenuItem, storeSlug?: string): string | null {
  const target = item.target;
  if (target.kind === "external") return safeRichTextHref(target.url);
  if (target.kind === "anchor") return safeRichTextHref(`#${target.anchor}`);
  if (!storeSlug) return target.kind === "home" ? "/" : target.kind === "search" ? "/search" : null;
  const root = `/${encodeURIComponent(storeSlug)}`;
  if (target.kind === "home") return root;
  if (target.kind === "search") return `${root}/search`;
  return `${root}/${target.kind === "product" ? "products" : target.kind === "collection" ? "collections" : target.kind === "page" ? "pages" : "blogs"}/${encodeURIComponent(target.resourceId)}`;
}

export function MenuLinks({ section, context, label = "Store navigation" }: { section: SectionNode; context: StorefrontRuntimeContext; label?: string }) {
  const block = section.blocks.find((entry) => entry.enabled && entry.type === "menu");
  const handle = typeof block?.settings.handle === "string" ? block.settings.handle : "main";
  const items = context.menus?.[handle]?.items ?? [];
  if (items.length === 0) return null;
  return <nav aria-label={label}><ul>{items.map((item) => {
    const href = menuHref(item, context.storeSlug);
    return href ? <li key={item.id}><a href={href}>{item.label}</a></li> : null;
  })}</ul></nav>;
}

type ToolIcon = "search" | "account" | "wishlist" | "bag" | "menu";
const iconPaths: Record<ToolIcon, string> = {
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35",
  account: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
  wishlist: "M19.5 12.6 12 20l-7.5-7.4A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 7.5 6.5Z",
  bag: "M6 7h12l1 14H5L6 7Zm3 0a3 3 0 0 1 6 0",
  menu: "M4 7h16M4 12h16M4 17h16",
};

export function StorefrontIcon({ name }: { name: ToolIcon }) {
  return <svg className="jelly-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={iconPaths[name]} /></svg>;
}

function imageSetting(value: unknown): { url: string; alt?: string } | undefined {
  return value && typeof value === "object" && "url" in value && typeof value.url === "string" ? value as { url: string; alt?: string } : undefined;
}

export function HeaderSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const settings = section.settings;
  const image = imageSetting(settings.logo);
  const logoUrl = image ? safeRichTextHref(image.url) : null;
  const name = typeof settings.storeName === "string" && settings.storeName.trim() ? settings.storeName : "Storefront";
  const logoWidth = typeof settings.logoWidth === "number" ? Math.min(240, Math.max(64, settings.logoWidth)) : undefined;
  const root = context.storeSlug ? `/${encodeURIComponent(context.storeSlug)}` : "";
  const tools = context.storeSlug ? ([
    ["search", "Search", `${root}/search`, settings.showSearch],
    ["account", "Account", `${root}/account`, settings.showAccount],
    ["wishlist", "Wishlist", `${root}/wishlist`, settings.showWishlist],
    ["bag", "Bag", `${root}/cart`, settings.showCart],
  ] as const).filter(([, , , visible]) => visible !== false) : [];
  return <header
    className="jelly-header"
    data-section-id={section.id}
    data-logo-position={settings.logoPosition === "center" ? "center" : "left"}
    data-sticky={settings.sticky === true ? "true" : undefined}
  >
    <details className="jelly-mobile-navigation">
      <summary aria-label="Open menu"><StorefrontIcon name="menu" /><span className="jelly-visually-hidden">Menu</span></summary>
      <div className="jelly-mobile-navigation-panel">
        <MenuLinks section={section} context={context} label="Mobile navigation" />
        {tools.length > 0 && <nav aria-label="Account and saved items"><ul>{tools.filter(([icon]) => icon !== "search").map(([icon, label, href]) => <li key={icon}><a href={href}>{icon === "bag" ? "Shopping bag" : label}</a></li>)}</ul></nav>}
      </div>
    </details>
    <a className="jelly-header-brand" href={root || "/"} style={logoWidth ? { width: logoWidth } : undefined}>
      {logoUrl && !logoUrl.startsWith("#") ? <img src={logoUrl} alt={image?.alt || name} /> : <span>{name}</span>}
    </a>
    <MenuLinks section={section} context={context} label="Primary navigation" />
    {tools.length > 0 && <nav className="jelly-header-tools" aria-label="Shopping tools">
      {tools.map(([icon, label, href]) => <a key={icon} href={href} data-tool={icon} aria-label={label}><StorefrontIcon name={icon} /><span className="jelly-header-tool-label">{label}</span></a>)}
    </nav>}
  </header>;
}
