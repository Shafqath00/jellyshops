import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { PublishedRuntimeStorefront, PublishedStorefront } from "@/features/storefront/storefront-page";
import { expandRuntimeLayout, type ResolvedStorefrontRoute } from "@/features/storefront/resource-loader";

export default async function StoreHomePage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params; const data = await getServerStorefront(storeSlug);
  if (!data) notFound();
  const { publication, store, products } = data;
  if (publication.kind === "v3") return <PublishedStorefront document={publication.document} storeSlug={store.slug} currency={store.currency} products={products} />;
  const templateId = publication.snapshot.templateDefaults.home;
  const template = templateId ? publication.snapshot.templates[templateId] : undefined;
  if (!template) notFound();
  const layout = expandRuntimeLayout(publication.snapshot, template);
  const route: ResolvedStorefrontRoute = { status: "ready", context: { pageType: "home", resource: null }, resource: null, template, layout, sections: layout.template };
  return <PublishedRuntimeStorefront snapshot={publication.snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={products} />;
}
