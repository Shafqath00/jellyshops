"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useThemePresentation } from "@/features/storefront/components/storefront-shell";
import { formatMoney } from "@/lib/domain";
import { useShop } from "@/contexts/shop-context";
import { useStorefrontCatalogStatus } from "@/features/commerce/components/storefront-catalog-sync";
import { isVariantBuyable } from "@/lib/variant-stock";
import { productCardData } from "@/features/storefront/product-card-data";
import { collectionResource, SHOP_ALL_COLLECTION as ALL_PRODUCTS } from "@/features/storefront/page-context-loaders";
import { buildStorefrontRoute, deserializeRouteValues } from "@/features/storefront/resource-loader";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";
import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";
import { StorefrontPageLoading } from "@/features/storefront/components/storefront-page-loading";


export default function ShopPage({ routeValues }: { routeValues?: Array<[string, unknown]> }) {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const search = useSearchParams();
  const { repository } = useShop();
  const { shell, settings } = useThemePresentation();
  const catalogStatus = useStorefrontCatalogStatus();
  const store = repository.getStoreBySlug(storeSlug);
  // The published design and the catalogue arrive with the page from the server.
  const publication = useInitialStorefrontPublication();
  const values = useMemo(() => deserializeRouteValues(routeValues), [routeValues]);
  const products = store ? repository.listProducts(storeSlug).filter((product) => product.published && !product.archived) : [];

  // The same path as a collection page: the store's collection template for "all", laid out during render so
  // the server sends the finished page.
  const route = store && publication?.kind === "v4"
    ? buildStorefrontRoute(publication.snapshot, { type: "collection", handle: ALL_PRODUCTS.slug }, collectionResource(ALL_PRODUCTS, products.map((product) => productCardData(product, `/products/${product.slug}`, store.currency)), store.slug), values)
    : null;

  if (!store) return null;
  if (catalogStatus === "loading") return <StorefrontPageLoading label="Loading the collection…" />;
  if (publication?.kind === "v4" && route?.status === "ready") return <PublishedRuntimeStorefront snapshot={publication.snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={products} />;

  // Stores without a published design keep the built-in page.
  const categories = [...new Set(products.map((product) => product.category))];
  const selected = search.get("category");
  const visible = selected ? products.filter((product) => product.category === selected) : products;
  const CollectionPage = shell.CollectionPage;
  const productViews = visible.map((product) => { const variant = product.variants[0]; return { id: product.id, name: product.name, slug: product.slug, category: product.category, imageUrl: product.imageUrl, price: formatMoney(variant?.priceMinor ?? 0, store.currency), soldOut: !isVariantBuyable(variant), lowStock: Boolean(variant && variant.stock > 0 && variant.stock <= 3), href: `/${store.slug}/products/${product.slug}` }; });
  return <CollectionPage store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} products={productViews} categories={categories} selectedCategory={selected ?? undefined} allHref={`/${store.slug}/shop`} categoryHref={(category) => `/${store.slug}/shop?category=${encodeURIComponent(category)}`} />;
}
