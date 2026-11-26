import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { followUrlRedirect } from "@/features/storefront/server-content-page";

/**
 * Any address the store has no page for: first the merchant's own redirects (Settings > Store preferences > URL
 * redirects), otherwise the store's 404 template (`../not-found.tsx`), with status 404.
 */
/** Address parts may arrive encoded or not; a stray % must never break the page. */
function decoded(part: string): string {
  try { return decodeURIComponent(part); } catch { return part; }
}

export default async function UnmatchedStorefrontPathPage({ params }: { params: Promise<{ storeSlug: string; unmatched: string[] }> }): Promise<never> {
  const { storeSlug, unmatched } = await params;
  const data = await getServerStorefront(storeSlug);
  if (data) await followUrlRedirect(storeSlug, data.store.id, `/${unmatched.map(decoded).join("/")}`);
  notFound();
}
