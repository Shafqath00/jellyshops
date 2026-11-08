import type { PublicMetaobjectList } from "@jelly/storefront-renderer";

const origin = () => (process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

/** A metaobject's entries shoppers may see, or null when it isn't visible on the storefront. */
export async function fetchPublicMetaobjects(storeId: string, handle: string, fetcher: typeof fetch = fetch): Promise<PublicMetaobjectList | null> {
  const response = await fetcher(`${origin()}/api/public/stores/${encodeURIComponent(storeId)}/storefront/metaobjects/${encodeURIComponent(handle)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Metaobjects are temporarily unavailable.");
  return await response.json() as PublicMetaobjectList;
}

/** One entry and its metaobject, or null when either isn't visible. */
export async function fetchPublicMetaobjectEntry(storeId: string, handle: string, entryHandle: string, fetcher: typeof fetch = fetch): Promise<{ definition: PublicMetaobjectList["definition"]; entry: PublicMetaobjectList["entries"][number] } | null> {
  const response = await fetcher(`${origin()}/api/public/stores/${encodeURIComponent(storeId)}/storefront/metaobjects/${encodeURIComponent(handle)}/${encodeURIComponent(entryHandle)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("This page is temporarily unavailable.");
  return await response.json();
}
