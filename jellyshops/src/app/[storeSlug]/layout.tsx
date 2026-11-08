import { StorefrontFrame } from "@/features/storefront/components/storefront-frame";
import { StorefrontCatalogSync } from "@/features/commerce/components/storefront-catalog-sync";
import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { StorefrontBootstrap } from "@/features/storefront/storefront-bootstrap";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { accessCookieName, loadAccessStatus } from "@/features/storefront-access/access-api";
import { StorefrontPasswordPage } from "@/features/storefront-access/password-page";
import { loadInstalledTheme } from "@/features/storefront/installed-theme";
import { InstalledThemeProvider } from "@/features/storefront/installed-theme-provider";

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }): Promise<Metadata> {
  const { storeSlug } = await params; const data = await getServerStorefront(storeSlug);
  if (!data) return { title: "Store not found", robots: { index: false, follow: false } };
  // A protected store keeps its description and images out of search results and link previews.
  if ((await loadAccessStatus(data.store.id, undefined)).protected) return { title: data.store.name, robots: { index: false, follow: false } };
  return { title: data.store.name, description: data.store.description, openGraph: { title: data.store.name, description: data.store.description, images: data.products[0]?.imageUrl ? [data.products[0].imageUrl] : [] } };
}

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  if (!data) notFound();
  // A password-protected store shows only the password page until the shopper enters it.
  const access = await loadAccessStatus(data.store.id, (await cookies()).get(accessCookieName(data.store.id))?.value);
  if (access.protected && !access.unlocked) return <StorefrontPasswordPage storeSlug={data.store.slug} storeName={data.store.name} message={access.message} />;
  // A store on an uploaded theme: load that exact version so the page can resolve and style it.
  const installedTheme = data.publication.kind === "v4" ? await loadInstalledTheme(data.publication.snapshot.theme.artifactId, { baseUrl: process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001" }) : null;
  return <InstalledThemeProvider theme={installedTheme}><StorefrontBootstrap key={`${data.store.id}:${data.publication.publicationId}`} data={data}><StorefrontCatalogSync storeSlug={storeSlug} initialReady><StorefrontFrame storeSlug={storeSlug}>{children}</StorefrontFrame></StorefrontCatalogSync></StorefrontBootstrap></InstalledThemeProvider>;
}
