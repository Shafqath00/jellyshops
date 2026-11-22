/**
 * How published store pages are cached on the server.
 *
 * Store pages are rendered once and kept (incremental static regeneration). Every backend read made while rendering
 * them carries two tags: `storefront:<slug>` and `store:<storeId>`. When a merchant changes something, the backend
 * calls `/api/revalidate` (see `app/api/revalidate/route.ts`) and every page of that store is rebuilt on its next
 * visit. `STOREFRONT_CACHE_SECONDS` is only the safety limit for when that call never arrives (default 5 minutes;
 * set it to 3600 once the backend's `STOREFRONT_REVALIDATE_URL` is configured).
 *
 * Browser reads are never cached here: shoppers' own requests stay live.
 */
export const STOREFRONT_CACHE_SECONDS = Number(process.env.STOREFRONT_CACHE_SECONDS) > 0 ? Number(process.env.STOREFRONT_CACHE_SECONDS) : 300;
export const storefrontCacheTag = (slug: string) => `storefront:${slug}`;
export const storeCacheTag = (storeId: string) => `store:${storeId}`;

/**
 * Fetch options for a published-store read: tagged and cached on the server, live in the browser. Modules that only
 * ever run on the server pass `where: "server"`.
 */
export function storefrontFetchInit(tags: string[], seconds = STOREFRONT_CACHE_SECONDS, where: "auto" | "server" = "auto"): RequestInit {
  if (where === "auto" && typeof window !== "undefined") return { cache: "no-store" };
  return { next: { revalidate: seconds, tags } } as RequestInit;
}
