import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { productMetaDescription, productMetaTitle, productSocialTitle } from "@/lib/seo";
import ProductPageClient from "./product-client";
import { isVariantBuyable } from "@/lib/variant-stock";
type Props = { params: Promise<{ storeSlug: string; productSlug: string }> };
async function productData(params: Props["params"]) {
  const { storeSlug, productSlug } = await params; const data = await getServerStorefront(storeSlug);
  const product = data?.products.find((item) => item.slug === productSlug && item.published && !item.archived);
  if (!data || !product) notFound();
  return { data, product };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data, product } = await productData(params);
  return { title: productMetaTitle(product, data.store.name), description: productMetaDescription(product), openGraph: { title: productSocialTitle(product), description: productMetaDescription(product), images: product.imageUrl ? [product.imageUrl] : [] }, alternates: { canonical: `/${data.store.slug}/products/${product.slug}` } };
}
export default async function ProductPage({ params }: Props) {
  const { data, product } = await productData(params);
  const variant = product.variants[0];
  const structured = { "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.description, image: product.imageUrl, ...(variant ? { offers: { "@type": "Offer", priceCurrency: data.store.currency, price: (variant.priceMinor / 100).toFixed(2), availability: isVariantBuyable(variant) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } } : {}) };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replaceAll("<", "\\u003c") }} /><ProductPageClient /></>;
}
