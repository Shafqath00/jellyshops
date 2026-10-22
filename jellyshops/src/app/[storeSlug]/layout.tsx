import { StorefrontFrame } from "@/features/storefront/components/storefront-frame";
import { StorefrontCatalogSync } from "@/features/commerce/components/storefront-catalog-sync";
import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { StorefrontBootstrap } from "@/features/storefront/storefront-bootstrap";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }): Promise<Metadata> {
  const { storeSlug } = await params; const data = await getServerStorefront(storeSlug);
  if (!data) return { title: "Store not found", robots: { index: false, follow: false } };
  return { title: data.store.name, description: data.store.description, openGraph: { title: data.store.name, description: data.store.description, images: data.products[0]?.imageUrl ? [data.products[0].imageUrl] : [] } };
}

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  if (!data) notFound();
  return <StorefrontBootstrap key={`${data.store.id}:${data.publication.publicationId}`} data={data}><StorefrontCatalogSync storeSlug={storeSlug} initialReady><StorefrontFrame storeSlug={storeSlug}>{children}</StorefrontFrame></StorefrontCatalogSync></StorefrontBootstrap>;
}
