import { StorefrontFrame } from "@/features/storefront/components/storefront-frame";
import { StorefrontCatalogSync } from "@/features/commerce/components/storefront-catalog-sync";
import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { StorefrontBootstrap } from "@/features/storefront/storefront-bootstrap";
import type { Metadata } from "next";
import { loadAccessStatus } from "@/features/storefront-access/access-api";
import { loadInstalledTheme } from "@/features/storefront/installed-theme";
import { InstalledThemeProvider } from "@/features/storefront/installed-theme-provider";
import { StorefrontMotion } from "@/features/storefront/components/storefront-motion";

/**
 * Store pages are rendered once and kept until the store changes (the backend asks for a refresh; see
 * `features/storefront/storefront-cache.ts`). No path is built ahead of time: each store page is made on its first
 * visit. Nothing here may read the request (headers, cookies): the pages are shared by every shopper. The password
 * check for protected stores runs before this, in `src/proxy.ts`.
 */
export function generateStaticParams(): Array<{ storeSlug: string }> { return []; }
export const revalidate = 3600;

/** The site address for canonical links and share images. Read from configuration, not the request, so pages stay cacheable. */
function siteAddress(): URL | undefined {
  const value = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.STOREFRONT_SITE_URL;
  try { return value ? new URL(value) : undefined; } catch { return undefined; }
}

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }): Promise<Metadata> {
  const { storeSlug } = await params; const data = await getServerStorefront(storeSlug);
  const metadataBase = siteAddress();
  if (!data) return { metadataBase, title: "Store not found", robots: { index: false, follow: false } };
  // A protected store keeps its description and images out of search results and link previews.
  if ((await loadAccessStatus(data.store.id, undefined)).protected) return { metadataBase, title: data.store.name, robots: { index: false, follow: false } };
  return { metadataBase, title: data.store.name, description: data.store.description, openGraph: { title: data.store.name, description: data.store.description, images: data.products[0]?.imageUrl ? [data.products[0].imageUrl] : [] } };
}

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  if (!data) notFound();
  // A store on an uploaded theme loads that exact version so the page can resolve and style it.
  const installedTheme = await (
    data.publication.kind === "v4" ? loadInstalledTheme(data.publication.snapshot.theme.artifactId, { baseUrl: process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001" }) : Promise.resolve(null));
  return <InstalledThemeProvider theme={installedTheme}><StorefrontBootstrap key={`${data.store.id}:${data.publication.publicationId}`} data={data}><StorefrontCatalogSync storeSlug={storeSlug} initialReady><StorefrontFrame storeSlug={storeSlug}>{children}</StorefrontFrame><StorefrontMotion /></StorefrontCatalogSync></StorefrontBootstrap></InstalledThemeProvider>;
}
