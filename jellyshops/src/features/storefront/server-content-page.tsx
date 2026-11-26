import { notFound, permanentRedirect } from "next/navigation";
import { storePath } from "@jelly/storefront-schema";
import { getServerStorefront } from "./server-storefront";
import { resolveStorefrontRoute, type PublicStorefrontResource } from "./resource-loader";
import { PublishedRuntimeStorefront } from "./storefront-page";
import { storeCacheTag, storefrontFetchInit } from "./storefront-cache";
const origin = (process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
export async function ServerContentPage({ storeSlug, type, handle, blogHandle }: { storeSlug: string; type: "page" | "blog" | "article"; handle: string; blogHandle?: string }) {
  const data = await getServerStorefront(storeSlug);
  if (!data || data.publication.kind !== "v4") notFound();
  const path = type === "page" ? `pages/${encodeURIComponent(handle)}` : type === "blog" ? `blogs/${encodeURIComponent(handle)}` : `blogs/${encodeURIComponent(blogHandle ?? "")}/articles/${encodeURIComponent(handle)}`;
  const response = await fetch(`${origin}/api/public/stores/${encodeURIComponent(data.store.id)}/storefront/context/${path}`, storefrontFetchInit([storeCacheTag(data.store.id)], undefined, "server"));
  if (response.status === 404) {
    // A page, blog or post whose web address changed: send shoppers (and search engines) to where it lives now.
    const location = await movedTo(data.store.id, type === "page" ? `/pages/${handle}` : type === "blog" ? `/blogs/${handle}` : `/blogs/${blogHandle ?? ""}/${handle}`);
    if (location) permanentRedirect(storePath(storeSlug, location));
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
