import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { followUrlRedirect } from "@/features/storefront/server-content-page";
import { productMetaDescription, productSocialTitle } from "@/lib/seo";
import { breadcrumbData, jsonLd, pageTitle, robotsFor, sharingTags, siteAddress } from "@/features/storefront/store-seo";
import ProductPageClient from "./product-client";
import { isVariantBuyable } from "@/lib/variant-stock";
import { serverRouteValues } from "@/features/storefront/server-route-values";
import { storePath } from "@jelly/storefront-schema";

/** Rendered on its first visit and kept until the store changes (see the store layout). */
export function generateStaticParams() { return []; }
type Props = { params: Promise<{ storeSlug: string; productSlug: string }> };
async function productData(params: Props["params"]) {
  const { storeSlug, productSlug } = await params; const data = await getServerStorefront(storeSlug);
  const product = data?.products.find((item) => item.slug === productSlug && item.published && !item.archived);
  if (!data) notFound();
  // A removed or renamed product the merchant redirected (Settings > Store preferences > URL redirects).
  if (!product) { await followUrlRedirect(storeSlug, data.store.id, `/products/${productSlug}`); notFound(); }
  return { data, product };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data, product } = await productData(params);
  const title = pageTitle("product", data.preferences, { "product name": product.name, brand: product.vendor, "store name": data.store.name }, product.seoTitle);
  const description = productMetaDescription(product);
  return { title, description, ...sharingTags(data.preferences, { title: productSocialTitle(product), description, image: product.imageUrl ? { url: product.imageUrl } : null, siteName: data.store.name }), robots: robotsFor(data.preferences), alternates: { canonical: storePath(data.store.slug, `/products/${product.slug}`) } };
}
export default async function ProductPage({ params }: Props) {
  const { data, product } = await productData(params);
  const variant = product.variants[0];
  const structured = { "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.description, image: product.imageUrl, ...(variant ? { offers: { "@type": "Offer", priceCurrency: data.store.currency, price: (variant.priceMinor / 100).toFixed(2), availability: isVariantBuyable(variant) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } } : {}) };
  const routeValues = await serverRouteValues(data.publication, { type: "product", handle: product.slug }, { type: "product", id: product.id, handle: product.slug });
  // Structured data switches live in Settings > Store preferences > Search visibility.
  const { structuredData } = data.preferences.seo;
  const base = siteAddress(data.store.slug);
  const collection = data.collections.find((item) => product.collectionIds?.includes(item.id));
  const crumbs = breadcrumbData([
    { name: data.store.name, path: storePath(data.store.slug) },
    ...(collection ? [{ name: collection.name, path: storePath(data.store.slug, `/collections/${collection.slug}`) }] : []),
    { name: product.name, path: storePath(data.store.slug, `/products/${product.slug}`) },
  ], base);
  return <>
    {structuredData.products && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />}
    {structuredData.breadcrumbs && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(crumbs) }} />}
    <ProductPageClient routeValues={routeValues} />
  </>;
}
