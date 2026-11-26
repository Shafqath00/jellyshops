import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { storePath } from "@jelly/storefront-schema";
import { getServerStorefront } from "./server-storefront";
import { resolveStorefrontRoute, type PublicStorefrontResource } from "./resource-loader";
import { PublishedRuntimeStorefront } from "./storefront-page";
import { storeCacheTag, storefrontFetchInit } from "./storefront-cache";
import { pageTitle, robotsFor, sharingTags } from "./store-seo";
import { resolveMediaUrls } from "@/lib/media-urls";
const origin = (process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
type ContentType = "page" | "blog" | "article";
const contextPath = (type: ContentType, handle: string, blogHandle?: string) => type === "page" ? `pages/${encodeURIComponent(handle)}` : type === "blog" ? `blogs/${encodeURIComponent(handle)}` : `blogs/${encodeURIComponent(blogHandle ?? "")}/articles/${encodeURIComponent(handle)}`;

type SeoFields = { title: string | null; description: string | null; noindex: boolean; canonical: string | null; imageUrl: string | null };
type Entry = { title?: string; excerpt?: string; seo?: SeoFields };

/**
 * Search and sharing tags for an information page, blog or post: its own SEO fields first, then the store's title
 * template (Settings > Store preferences > Page titles). The read is the same cached request the page itself makes.
 */
export async function contentMetadata(storeSlug: string, type: ContentType, handle: string, blogHandle?: string): Promise<Metadata> {
  const data = await getServerStorefront(storeSlug);
  if (!data) return {};
  try {
    const response = await fetch(`${origin}/api/public/stores/${encodeURIComponent(data.store.id)}/storefront/context/${contextPath(type, handle, blogHandle)}`, storefrontFetchInit([storeCacheTag(data.store.id)], undefined, "server"));
    if (!response.ok) return {};
    const context = resolveMediaUrls(await response.json() as Record<string, unknown>, origin);
    const entry = context[type] as Entry | undefined;
    const blog = context.blog as Entry | undefined;
    if (!entry?.title) return {};
    const seo = entry.seo;
    const values = type === "article" ? { "post title": entry.title, "blog name": blog?.title, "store name": data.store.name } : { "page title": entry.title, "store name": data.store.name };
    const title = pageTitle(type === "article" ? "article" : "page", data.preferences, values, seo?.title);
    const description = seo?.description ?? (entry.excerpt || undefined);
    const ownPath = type === "page" ? `/${handle}` : type === "blog" ? `/blogs/${handle}` : `/blogs/${blogHandle ?? ""}/${handle}`;
    return {
      title, description,
      ...sharingTags(data.preferences, { title: seo?.title || entry.title, description, image: seo?.imageUrl ? { url: seo.imageUrl } : null, type: type === "article" ? "article" : "website", siteName: data.store.name }),
      robots: robotsFor(data.preferences, seo?.noindex),
      alternates: { canonical: seo?.canonical || storePath(storeSlug, ownPath) },
    };
  } catch {
    return {};
  }
}

export async function ServerContentPage({ storeSlug, type, handle, blogHandle }: { storeSlug: string; type: "page" | "blog" | "article"; handle: string; blogHandle?: string }) {
  const data = await getServerStorefront(storeSlug);
  if (!data || data.publication.kind !== "v4") notFound();
  const path = contextPath(type, handle, blogHandle);
  const response = await fetch(`${origin}/api/public/stores/${encodeURIComponent(data.store.id)}/storefront/context/${path}`, storefrontFetchInit([storeCacheTag(data.store.id)], undefined, "server"));
  if (response.status === 404) {
    // A page, blog or post whose web address changed: send shoppers (and search engines) to where it lives now.
    const location = await movedTo(data.store.id, type === "page" ? `/pages/${handle}` : type === "blog" ? `/blogs/${handle}` : `/blogs/${blogHandle ?? ""}/${handle}`);
    if (location) permanentRedirect(storePath(storeSlug, location));
    await followUrlRedirect(storeSlug, data.store.id, type === "page" ? `/${handle}` : type === "blog" ? `/blogs/${handle}` : `/blogs/${blogHandle ?? ""}/${handle}`);
    notFound();
  }
  if (!response.ok) throw new Error("The page service is temporarily unavailable.");
  const context = await response.json() as Record<string, unknown>;
  const entry = context[type] as { id: string; handle: string } | undefined;
  if (!entry) notFound();
  const resource: PublicStorefrontResource = { type, id: entry.id, handle: entry.handle, visible: true, data: { ...context, storeSlug } };
  const route = await resolveStorefrontRoute(data.publication.snapshot, { type, handle: entry.handle }, { findByHandle: async () => resource, findById: async () => resource });
  if (route.status !== "ready") notFound();
  return <PublishedRuntimeStorefront snapshot={data.publication.snapshot} route={route} storeSlug={data.store.slug} currency={data.store.currency} products={data.products} />;
}

/** Where an old content address went, or null (any failure means "nowhere": the shopper sees the store's 404). */
export async function movedTo(storeId: string, path: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetcher(`${origin}/api/public/stores/${encodeURIComponent(storeId)}/content-redirect?path=${encodeURIComponent(path.toLowerCase())}`, storefrontFetchInit([storeCacheTag(storeId)], undefined, "server"));
    if (!response.ok) return null;
    const body = await response.json() as { location?: unknown };
    return typeof body.location === "string" && /^\/(pages|blogs)\/[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(body.location) ? body.location : null;
  } catch {
    return null;
  }
}

/**
 * Where a merchant's own redirect (Settings > Store preferences > URL redirects) sends an address that has no page,
 * as a store path or a full https address; null when there is none or the lookup fails.
 */
export async function urlRedirectFor(storeId: string, path: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetcher(`${origin}/api/public/stores/${encodeURIComponent(storeId)}/url-redirect?path=${encodeURIComponent(path)}`, storefrontFetchInit([storeCacheTag(storeId)], undefined, "server"));
    if (!response.ok) return null;
    const body = await response.json() as { to?: unknown };
    if (typeof body.to !== "string") return null;
    if (body.to.startsWith("/") && !body.to.startsWith("//")) return body.to;
    return /^https:\/\/[^\s"<>]+$/.test(body.to) ? body.to : null;
  } catch {
    return null;
  }
}

/** Sends the shopper on if the merchant redirected this address; returns only when there is no redirect. */
export async function followUrlRedirect(storeSlug: string, storeId: string, path: string): Promise<void> {
  const to = await urlRedirectFor(storeId, path);
  if (to) permanentRedirect(to.startsWith("/") ? storePath(storeSlug, to) : to);
}
