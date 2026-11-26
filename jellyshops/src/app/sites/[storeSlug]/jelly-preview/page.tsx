import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { ContentPreview } from "@/features/storefront/content-preview";

/** Draft preview of a page or blog post sent by the admin (see features/storefront/content-preview.tsx). Never indexed. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() { return []; }

export default async function ContentPreviewPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  if (!data || data.publication.kind !== "v4") notFound();
  return <ContentPreview snapshot={data.publication.snapshot} storeSlug={data.store.slug} currency={data.store.currency} products={data.products} />;
}
