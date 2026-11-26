import type { Metadata } from "next";
import { SOCIAL_PLATFORMS, seoTitleFor, storePath, storeUrl, type StorePreferences, type TitleTemplateKind } from "@jelly/storefront-schema";

/**
 * Search and sharing tags for store pages, built from the store's preferences (Settings > Store preferences).
 * Server-only helpers with no React, shared by the store layout and each page's `generateMetadata`.
 */

/** Robots rule for a page: hidden when the store asks not to be listed or the page itself is hidden. */
export function robotsFor(preferences: Pick<StorePreferences, "seo">, pageNoindex = false): Metadata["robots"] | undefined {
  return !preferences.seo.allowIndexing || pageNoindex ? { index: false, follow: true } : undefined;
}

/** Browser tab icon from preferences; nothing when none is chosen (the browser then asks for /favicon.ico). */
export function iconsFor(preferences: Pick<StorePreferences, "seo">): Metadata["icons"] | undefined {
  const icon = preferences.seo.favicon;
  if (!icon) return undefined;
  return { icon: [{ url: icon.url, ...(icon.width && icon.height ? { sizes: `${icon.width}x${icon.height}` } : {}) }], apple: [{ url: icon.url }] };
}

type ImageSource = { url: string; width?: number | null; height?: number | null; alt?: string | null };
function images(image: ImageSource | null | undefined): Array<{ url: string; width?: number; height?: number; alt?: string }> {
  if (!image?.url) return [];
  return [{ url: image.url, ...(image.width ? { width: image.width } : {}), ...(image.height ? { height: image.height } : {}), ...(image.alt ? { alt: image.alt } : {}) }];
}

/** Open Graph + Twitter card tags for one page. Falls back to the store's sharing image. */
export function sharingTags(preferences: Pick<StorePreferences, "seo">, page: { title: string; description?: string | null; image?: ImageSource | null; type?: "website" | "article"; siteName: string; url?: string }): Pick<Metadata, "openGraph" | "twitter"> {
  const image = page.image?.url ? page.image : preferences.seo.socialImage;
  const list = images(image);
  const description = page.description ?? undefined;
  return {
    openGraph: { type: page.type ?? "website", title: page.title, description, siteName: page.siteName, images: list, ...(page.url ? { url: page.url } : {}) },
    twitter: { card: list.length ? "summary_large_image" : "summary", title: page.title, description, images: list.map((item) => item.url) },
  };
}

/** The homepage's metadata, also the default for every page of the store. */
export function storeMetadata(preferences: StorePreferences, store: { name: string; slug: string; description?: string | null }, fallbackImage?: string | null): Metadata {
  const title = preferences.seo.homeTitle || store.name;
  const description = preferences.seo.homeDescription || store.description || undefined;
  const image = preferences.seo.socialImage ?? (fallbackImage ? { url: fallbackImage } : null);
  return {
    title,
    description,
    ...sharingTags(preferences, { title, description, image, siteName: store.name }),
    icons: iconsFor(preferences),
    robots: robotsFor(preferences),
    ...(preferences.seo.searchConsoleToken ? { verification: { google: preferences.seo.searchConsoleToken } } : {}),
    alternates: { canonical: storePath(store.slug) },
  };
}

/** A page's search title: its own SEO title, else the store's template for that kind of page. */
export function pageTitle(kind: TitleTemplateKind, preferences: Pick<StorePreferences, "seo">, values: Record<string, string | null | undefined>, ownTitle?: string | null): string {
  return seoTitleFor(kind, preferences, values, ownTitle) || values["store name"] || "";
}

/** JSON for a `<script type="application/ld+json">`, safe to put inside HTML. */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
}

/** An absolute address for structured data and sitemaps; store paths become full addresses when a site address is known. */
export function absolute(path: string, base?: URL): string {
  if (/^https?:\/\//.test(path)) return path;
  return base ? new URL(path, base).toString() : path;
}

/** Breadcrumbs (Home › Collection › Product) as schema.org data. */
export function breadcrumbData(items: Array<{ name: string; path: string }>, base?: URL) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absolute(item.path, base) })),
  };
}

/** The business behind the store, for search engines: name, logo, contact details, address and social pages. */
export function organizationData(preferences: StorePreferences, store: { name: string; slug: string; logoUrl?: string | null; email?: string | null }, base?: URL) {
  const address = preferences.business.address;
  const hasAddress = Boolean(address.line1 || address.city || address.postalCode);
  const sameAs = SOCIAL_PLATFORMS.map((platform) => preferences.social[platform]).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: store.name,
    ...(preferences.business.legalName ? { legalName: preferences.business.legalName } : {}),
    url: absolute(storePath(store.slug), base),
    ...(store.logoUrl ? { logo: absolute(store.logoUrl, base) } : {}),
    ...(preferences.business.phone ? { telephone: preferences.business.phone } : {}),
    ...(store.email ? { email: store.email } : {}),
    ...(hasAddress ? { address: { "@type": "PostalAddress", streetAddress: [address.line1, address.line2].filter(Boolean).join(", ") || undefined, addressLocality: address.city || undefined, addressRegion: address.region || undefined, postalCode: address.postalCode || undefined, addressCountry: address.country || undefined } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/**
 * The site address for canonical links, sitemaps and share images. Read from configuration, not the request, so
 * pages stay cacheable: the shop's own subdomain when shops have one, otherwise the configured site address.
 */
export function siteAddress(storeSlug: string): URL | undefined {
  const own = storeUrl(storeSlug);
  const value = /^https?:\/\//.test(own) ? own : process.env.NEXT_PUBLIC_SITE_URL ?? process.env.STOREFRONT_SITE_URL;
  try { return value ? new URL(value) : undefined; } catch { return undefined; }
}
