import { storePath, type StorePreferences } from "@jelly/storefront-schema";
import type { NavigationResource } from "@/features/navigation/resource-links";
import type { Collection, Product } from "@/lib/domain";
import { absolute } from "./store-seo";

/**
 * A store's sitemap.xml and robots.txt, built from what is published. Pure functions (no fetching), so the route
 * handlers stay thin and tests can cover every case.
 */

export const MAX_SITEMAP_URLS = 50_000;

export interface SitemapInput {
  slug: string;
  base?: URL;
  products: Pick<Product, "slug" | "published" | "archived">[];
  collections: Pick<Collection, "slug">[];
  navigation: NavigationResource[] | null | undefined;
  preferences: Pick<StorePreferences, "seo">;
}

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Store addresses for the sitemap: home, collections, products, pages, blogs and posts (hidden pages left out). */
export function sitemapEntries(input: SitemapInput): Array<{ loc: string; lastmod?: string }> {
  if (!input.preferences.seo.allowIndexing) return [];
  const at = (path: string) => absolute(storePath(input.slug, path), input.base);
  const entries: Array<{ loc: string; lastmod?: string }> = [{ loc: at("/") }];
  for (const collection of input.collections) entries.push({ loc: at(`/collections/${encodeURIComponent(collection.slug)}`) });
  for (const product of input.products) if (product.published && !product.archived) entries.push({ loc: at(`/products/${encodeURIComponent(product.slug)}`) });
  for (const item of input.navigation ?? []) {
    if (item.noindex) continue;
    const path = item.kind === "page" ? `/${encodeURIComponent(item.handle)}`
      : item.kind === "blog" ? `/blogs/${encodeURIComponent(item.handle)}`
        : item.kind === "article" && item.blogHandle ? `/blogs/${encodeURIComponent(item.blogHandle)}/${encodeURIComponent(item.handle)}` : null;
    if (path) entries.push({ loc: at(path), ...(item.updatedAt ? { lastmod: item.updatedAt.slice(0, 10) } : {}) });
  }
  const seen = new Set<string>();
  return entries.filter((entry) => !seen.has(entry.loc) && seen.add(entry.loc)).slice(0, MAX_SITEMAP_URLS);
}

export function sitemapXml(input: SitemapInput): string {
  const urls = sitemapEntries(input).map((entry) => `  <url><loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ""}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}${urls.length ? "\n" : ""}</urlset>\n`;
}

/**
 * robots.txt: shopping and account pages stay out of search; the whole store does while it is private or the owner
 * has asked search engines not to list it.
 */
export function robotsTxt(input: { slug: string; base?: URL; preferences: Pick<StorePreferences, "seo">; protected: boolean }): string {
  const prefix = storePath(input.slug, "/").replace(/\/$/, "");
  if (input.protected || !input.preferences.seo.allowIndexing) return `User-agent: *\nDisallow: ${prefix || "/"}\n`;
  const hidden = ["/cart", "/checkout", "/order", "/account", "/search", "/compare", "/wishlist", "/jelly-preview"];
  const lines = ["User-agent: *", ...hidden.map((path) => `Disallow: ${prefix}${path}`), "", `Sitemap: ${absolute(storePath(input.slug, "/sitemap.xml"), input.base)}`];
  return `${lines.join("\n")}\n`;
}
