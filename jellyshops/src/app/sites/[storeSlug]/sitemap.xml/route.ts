import { getServerStorefront } from "@/features/storefront/server-storefront";
import { loadAccessStatus } from "@/features/storefront-access/access-api";
import { sitemapXml } from "@/features/storefront/store-crawl-files";
import { siteAddress } from "@/features/storefront/store-seo";

/** The store's sitemap.xml: every published page search engines may list. Kept until the store changes. */
export const revalidate = 3600;

export async function GET(request: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  if (!data || (await loadAccessStatus(data.store.id, undefined)).protected) return new Response("Not found", { status: 404 });
  const base = siteAddress(storeSlug) ?? new URL(new URL(request.url).origin);
  const xml = sitemapXml({ slug: data.store.slug, base, products: data.products, collections: data.collections, navigation: data.navigation, preferences: data.preferences });
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
