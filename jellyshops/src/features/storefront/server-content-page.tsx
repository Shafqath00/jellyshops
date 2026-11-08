import { notFound } from "next/navigation";
import { getServerStorefront } from "./server-storefront";
import { resolveStorefrontRoute, type PublicStorefrontResource } from "./resource-loader";
import { PublishedRuntimeStorefront } from "./storefront-page";
const origin = (process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
export async function ServerContentPage({ storeSlug, type, handle, blogHandle }: { storeSlug: string; type: "page" | "blog" | "article"; handle: string; blogHandle?: string }) {
  const data = await getServerStorefront(storeSlug);
  if (!data || data.publication.kind !== "v4") notFound();
  const path = type === "page" ? `pages/${encodeURIComponent(handle)}` : type === "blog" ? `blogs/${encodeURIComponent(handle)}` : `blogs/${encodeURIComponent(blogHandle ?? "")}/articles/${encodeURIComponent(handle)}`;
  const response = await fetch(`${origin}/api/public/stores/${encodeURIComponent(data.store.id)}/storefront/context/${path}`, { cache: "no-store" });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("The page service is temporarily unavailable.");
  const context = await response.json() as Record<string, unknown>;
  const entry = context[type] as { id: string; handle: string } | undefined;
  if (!entry) notFound();
  const resource: PublicStorefrontResource = { type, id: entry.id, handle: entry.handle, visible: true, data: { ...context, storeSlug } };
  const route = await resolveStorefrontRoute(data.publication.snapshot, { type, handle: entry.handle }, { findByHandle: async () => resource, findById: async () => resource });
  if (route.status !== "ready") notFound();
  return <PublishedRuntimeStorefront snapshot={data.publication.snapshot} route={route} storeSlug={data.store.slug} currency={data.store.currency} products={data.products} />;
}
