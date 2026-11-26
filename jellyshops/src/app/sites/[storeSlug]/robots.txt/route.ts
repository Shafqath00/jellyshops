import { getServerStorefront } from "@/features/storefront/server-storefront";
import { loadAccessStatus } from "@/features/storefront-access/access-api";
import { robotsTxt } from "@/features/storefront/store-crawl-files";
import { siteAddress } from "@/features/storefront/store-seo";

/** The store's robots.txt (Settings > Store preferences > Search visibility). */
export const revalidate = 3600;

export async function GET(request: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  if (!data) return new Response("User-agent: *\nDisallow: /\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const base = siteAddress(storeSlug) ?? new URL(new URL(request.url).origin);
  const text = robotsTxt({ slug: data.store.slug, base, preferences: data.preferences, protected: (await loadAccessStatus(data.store.id, undefined)).protected });
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
