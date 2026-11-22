/**
 * Admin addresses for one shop, as plain functions (usable in server pages). The hooks and the shop-aware Link live
 * in `admin-routing.tsx`. See that file for the design.
 */
import { storeLinkSettings } from "@jelly/storefront-schema";

/** First path parts under /admin that belong to one shop ("" is the shop's admin home). */
export const SHOP_ADMIN_SECTIONS: ReadonlySet<string> = new Set([
  "", "orders", "products", "customers", "discounts", "content", "payments", "online-store", "settings", "store-design",
]);

/** Where one shop's admin starts: "/admin/s/<shop>", or "/s/<shop>" on the admin host. */
export function shopAdminBase(shop: string): string {
  const slug = encodeURIComponent(shop);
  return storeLinkSettings().mode === "subdomain" ? `/s/${slug}` : `/admin/s/${slug}`;
}

/** True for "/admin", "/admin/orders?tab=open" and the like: an old-style link to a page of one shop. */
export function isShopAdminHref(href: string): boolean {
  const match = /^\/admin(?=$|[/?#])(?:\/([^/?#]*))?/.exec(href);
  return Boolean(match) && SHOP_ADMIN_SECTIONS.has(match![1] ?? "");
}

/** "/admin/orders?x=1" → "/admin/s/<shop>/orders?x=1" (or "/s/<shop>/orders?x=1" on the admin host). */
export function toShopAdmin(shop: string, href: string): string {
  if (!isShopAdminHref(href)) return href;
  const rest = href.slice("/admin".length);
  const base = shopAdminBase(shop);
  return `${base}${rest}`;
}

/**
 * The page's address in the old form ("/admin/orders"), whichever form the router reports: the route
 * (`/admin/s/<shop>/orders`, also seen while rendering on the server) or the admin host's (`/s/<shop>/orders`).
 */
export function adminPagePath(pathname: string): string {
  const match = /^(?:\/admin)?\/s\/[^/?#]+(.*)$/.exec(pathname);
  if (!match) return pathname;
  return `/admin${match[1] ?? ""}`;
}

/** The shop named in an admin address, or null. */
export function shopFromAdminPath(pathname: string): string | null {
  const match = /^(?:\/admin)?\/s\/([^/?#]+)/.exec(pathname);
  return match ? decodeURIComponent(match[1]!) : null;
}
