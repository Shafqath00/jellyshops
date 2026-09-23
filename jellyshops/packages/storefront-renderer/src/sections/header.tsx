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

export function HeaderSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const candidate = section.settings.logo;
  const image = candidate && typeof candidate === "object" && "url" in candidate && typeof candidate.url === "string" ? candidate as { url: string; alt?: string } : undefined;
  const logoUrl = image ? safeRichTextHref(image.url) : null;
  const name = typeof section.settings.storeName === "string" && section.settings.storeName.trim() ? section.settings.storeName : "Storefront";
  return <header className="jelly-header" data-section-id={section.id}>
    <a className="jelly-header-brand" href={context.storeSlug ? `/${encodeURIComponent(context.storeSlug)}` : "/"}>
      {logoUrl && !logoUrl.startsWith("#") ? <img src={logoUrl} alt={image?.alt ?? ""} /> : <span>{name}</span>}
    </a>
    <MenuLinks section={section} context={context} label="Primary navigation" />
  </header>;
}
