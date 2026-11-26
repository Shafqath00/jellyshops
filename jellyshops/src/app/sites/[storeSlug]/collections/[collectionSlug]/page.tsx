import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { followUrlRedirect } from "@/features/storefront/server-content-page";
import CollectionPageClient from "./collection-client";
import { serverRouteValues } from "@/features/storefront/server-route-values";
import { searchFromParams } from "@/features/storefront/list-search";
import { storePath } from "@jelly/storefront-schema";
import { breadcrumbData, jsonLd, pageTitle, robotsFor, sharingTags, siteAddress } from "@/features/storefront/store-seo";

type Props = { params: Promise<{ storeSlug: string; collectionSlug: string }> };
async function collectionData(params: Props["params"]) {
  const { storeSlug, collectionSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  const collection = data?.collections.find((item) => item.slug === collectionSlug);
  if (!data) notFound();
  // A removed or renamed collection the merchant redirected (Settings > Store preferences > URL redirects).
  if (!collection) { await followUrlRedirect(storeSlug, data.store.id, `/collections/${collectionSlug}`); notFound(); }
  return { data, collection };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data, collection } = await collectionData(params);
  const title = pageTitle("collection", data.preferences, { "collection name": collection.name, "store name": data.store.name });
  const description = collection.description || `Explore ${collection.name} at ${data.store.name}.`;
  return { title, description, ...sharingTags(data.preferences, { title: collection.name, description, siteName: data.store.name }), robots: robotsFor(data.preferences), alternates: { canonical: storePath(data.store.slug, `/collections/${collection.slug}`) } };
}
export default async function CollectionPage({ params, searchParams }: Props & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { data, collection } = await collectionData(params);
  const routeValues = await serverRouteValues(data.publication, { type: "collection", handle: collection.slug }, { type: "collection", id: collection.id, handle: collection.slug });
  // The list's sort and filters live in the address, so the server draws the list the shopper shared or reloaded.
  const crumbs = data.preferences.seo.structuredData.breadcrumbs
    ? breadcrumbData([{ name: data.store.name, path: storePath(data.store.slug) }, { name: collection.name, path: storePath(data.store.slug, `/collections/${collection.slug}`) }], siteAddress(data.store.slug))
    : null;
  return <>
    {crumbs && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(crumbs) }} />}
    <CollectionPageClient routeValues={routeValues} listSearch={searchFromParams(await searchParams)} />
  </>;
}
