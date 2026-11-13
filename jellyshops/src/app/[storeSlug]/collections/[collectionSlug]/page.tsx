import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import CollectionPageClient from "./collection-client";
import { serverRouteValues } from "@/features/storefront/server-route-values";
import { searchFromParams } from "@/features/storefront/list-search";

type Props = { params: Promise<{ storeSlug: string; collectionSlug: string }> };
async function collectionData(params: Props["params"]) {
  const { storeSlug, collectionSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  const collection = data?.collections.find((item) => item.slug === collectionSlug);
  if (!data || !collection) notFound();
  return { data, collection };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data, collection } = await collectionData(params);
  const title = `${collection.name} · ${data.store.name}`;
  const description = collection.description || `Explore ${collection.name} at ${data.store.name}.`;
  return { title, description, openGraph: { title, description }, alternates: { canonical: `/${data.store.slug}/collections/${collection.slug}` } };
}
export default async function CollectionPage({ params, searchParams }: Props & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { data, collection } = await collectionData(params);
  const routeValues = await serverRouteValues(data.publication, { type: "collection", handle: collection.slug }, { type: "collection", id: collection.id, handle: collection.slug });
  // The list's sort and filters live in the address, so the server draws the list the shopper shared or reloaded.
  return <CollectionPageClient routeValues={routeValues} listSearch={searchFromParams(await searchParams)} />;
}
