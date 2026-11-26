import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { PublishedRuntimeStorefront, PublishedStorefront } from "@/features/storefront/storefront-page";
import { buildStorefrontRoute, loadStorefrontRouteValues } from "@/features/storefront/resource-loader";
import { jsonLd, organizationData, siteAddress } from "@/features/storefront/store-seo";

export default async function StoreHomePage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params; const data = await getServerStorefront(storeSlug);
  if (!data) notFound();
  const { publication, store, products } = data;
  // The business behind the store, for search engines (Settings > Store preferences > Search visibility).
  const organization = data.preferences.seo.structuredData.organization
    ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organizationData(data.preferences, store, siteAddress(store.slug))) }} />
    : null;
  if (publication.kind === "v3") return <>{organization}<PublishedStorefront document={publication.document} storeSlug={store.slug} currency={store.currency} products={products} /></>;
  // The same layout path as every other store page.
  const values = await loadStorefrontRouteValues(publication.snapshot, { type: "home" }, null);
  const route = buildStorefrontRoute(publication.snapshot, { type: "home" }, null, values);
  if (route.status !== "ready") notFound();
  return <>{organization}<PublishedRuntimeStorefront snapshot={publication.snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={products} /></>;
}
