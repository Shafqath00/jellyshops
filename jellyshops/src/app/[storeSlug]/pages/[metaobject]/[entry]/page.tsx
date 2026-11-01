import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MetaobjectEntryContent } from "@jelly/storefront-renderer";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { fetchPublicMetaobjectEntry } from "@/features/storefront/metaobjects-api";

type Params = Promise<{ storeSlug: string; metaobject: string; entry: string }>;

async function load(params: Params) {
  const { storeSlug, metaobject, entry } = await params;
  const data = await getServerStorefront(storeSlug);
  if (!data) return null;
  const found = await fetchPublicMetaobjectEntry(data.store.id, metaobject, entry);
  return found ? { ...found, store: data.store } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await load(params);
  return found ? { title: `${found.entry.displayName} | ${found.store.name}` } : { title: "Page not found", robots: { index: false, follow: false } };
}

/** A metaobject entry's own page, inside the store's header and footer (from the store layout). */
export default async function MetaobjectEntryPage({ params }: { params: Params }) {
  const found = await load(params);
  if (!found) notFound();
  return <main><MetaobjectEntryContent definition={found.definition} entry={found.entry} storeSlug={found.store.slug} /></main>;
}
