import { StorefrontFrame } from "@/features/storefront/components/storefront-frame";
import { StorefrontCatalogSync } from "@/features/commerce/components/storefront-catalog-sync";
import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { StorefrontBootstrap } from "@/features/storefront/storefront-bootstrap";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { accessCookieName, loadAccessStatus } from "@/features/storefront-access/access-api";
import { StorefrontPasswordPage } from "@/features/storefront-access/password-page";
import { loadInstalledTheme } from "@/features/storefront/installed-theme";
import { InstalledThemeProvider } from "@/features/storefront/installed-theme-provider";

/** The address the shopper reached the store on, so canonical links and share images are full addresses (search engines and Lighthouse need them). */
async function siteAddress(): Promise<URL | undefined> {
  const request = await headers();
  const host = request.get("x-forwarded-host") ?? request.get("host");
  if (!host || !/^[a-z0-9.:[\]-]+$/i.test(host)) return undefined;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  const protocol = request.get("x-forwarded-proto")?.split(",")[0]?.trim() || (local ? "http" : "https");
  return new URL(`${protocol === "http" ? "http" : "https"}://${host}`);
}

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }): Promise<Metadata> {
  const { storeSlug } = await params; const data = await getServerStorefront(storeSlug);
  const metadataBase = await siteAddress();
  if (!data) return { metadataBase, title: "Store not found", robots: { index: false, follow: false } };
  // A protected store keeps its description and images out of search results and link previews.
  if ((await loadAccessStatus(data.store.id, undefined)).protected) return { metadataBase, title: data.store.name, robots: { index: false, follow: false } };
  return { metadataBase, title: data.store.name, description: data.store.description, openGraph: { title: data.store.name, description: data.store.description, images: data.products[0]?.imageUrl ? [data.products[0].imageUrl] : [] } };
}

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  if (!data) notFound();
  // A password-protected store shows only the password page until the shopper enters it.
  const accessToken = (await cookies()).get(accessCookieName(data.store.id))?.value;
  // The password check and an uploaded theme's files are asked for side by side (a store on an uploaded theme loads
  // that exact version so the page can resolve and style it).
  const [access, installedTheme] = await Promise.all([
    loadAccessStatus(data.store.id, accessToken),
    data.publication.kind === "v4" ? loadInstalledTheme(data.publication.snapshot.theme.artifactId, { baseUrl: process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001" }) : Promise.resolve(null),
  ]);
  if (access.protected && !access.unlocked) return <StorefrontPasswordPage storeSlug={data.store.slug} storeName={data.store.name} message={access.message} />;
  return <InstalledThemeProvider theme={installedTheme}><StorefrontBootstrap key={`${data.store.id}:${data.publication.publicationId}`} data={data}><StorefrontCatalogSync storeSlug={storeSlug} initialReady><StorefrontFrame storeSlug={storeSlug}>{children}</StorefrontFrame></StorefrontCatalogSync></StorefrontBootstrap></InstalledThemeProvider>;
}
