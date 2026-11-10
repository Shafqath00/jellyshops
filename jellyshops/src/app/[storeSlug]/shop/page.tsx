"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useThemePresentation } from "@/features/storefront/components/storefront-shell";
import { formatMoney } from "@/lib/domain";
import { useShop } from "@/contexts/shop-context";
import { useStorefrontCatalogStatus } from "@/features/commerce/components/storefront-catalog-sync";
import { isVariantBuyable } from "@/lib/variant-stock";
import { productCardData } from "@/features/storefront/product-card-data";
import { collectionResource } from "@/features/storefront/page-context-loaders";
import { loadPublicStorefrontPublication, type PublicStorefrontPublication } from "@/features/storefront/public-storefront-api";
import { resolveStorefrontRoute, type ResolvedStorefrontRoute } from "@/features/storefront/resource-loader";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";
import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";
import { StorefrontPageLoading } from "@/features/storefront/components/storefront-page-loading";

/** "Shop all": every product, drawn with the store's own collection page (the collection "all"). */
const ALL_PRODUCTS = { id: "all-products", slug: "all", name: "All products", description: "" };

export default function ShopPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const search = useSearchParams();
  const { repository } = useShop();
  const { shell, settings } = useThemePresentation();
  const catalogStatus = useStorefrontCatalogStatus();
  const store = repository.getStoreBySlug(storeSlug);
  const initialPublication = useInitialStorefrontPublication();
  const [publication, setPublication] = useState<PublicStorefrontPublication | null>(initialPublication);
  const [publicationChecked, setPublicationChecked] = useState(false);
  const [route, setRoute] = useState<ResolvedStorefrontRoute | null>(null);
  const products = store ? repository.listProducts(storeSlug).filter((product) => product.published && !product.archived) : [];

  useEffect(() => {
    if (!store) return;
    let active = true;
    void loadPublicStorefrontPublication({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001", storeId: store.id })
      .then((next) => { if (active) setPublication(next); })
      .catch(() => undefined)
      .finally(() => { if (active) setPublicationChecked(true); });
    return () => { active = false; };
  }, [store]);

  // The same path as a collection page: the live loader picks the store's collection template for "all".
  const productKey = products.map((product) => product.id).join(",");
  useEffect(() => {
    if (!store || publication?.kind !== "v4" || catalogStatus === "loading") return;
    const resource = collectionResource(ALL_PRODUCTS, products.map((product) => productCardData(product, `/products/${product.slug}`, store.currency)), store.slug);
    let active = true;
    void resolveStorefrontRoute(publication.snapshot, { type: "collection", handle: resource.handle }, {
      findByHandle: async (type, handle) => type === "collection" && handle === resource.handle ? resource : null,
      findById: async (type, id) => type === "collection" && id === resource.id ? resource : null,
    }).then((next) => { if (active) setRoute(next); });
    return () => { active = false; };
    // `products` is rebuilt every render; its ids are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, publication, catalogStatus, productKey]);

  if (!store) return null;
  if (catalogStatus === "loading") return <StorefrontPageLoading label="Loading the collection…" />;
  if (publication?.kind === "v4") {
    if (route?.status === "ready") return <PublishedRuntimeStorefront snapshot={publication.snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={products} />;
    if (!route) return <StorefrontPageLoading label="Loading the collection…" />;
  } else if (!publication && !publicationChecked) return <StorefrontPageLoading label="Loading the collection…" />;

  // Stores without a published design keep the built-in page.
  const categories = [...new Set(products.map((product) => product.category))];
  const selected = search.get("category");
  const visible = selected ? products.filter((product) => product.category === selected) : products;
  const CollectionPage = shell.CollectionPage;
  const productViews = visible.map((product) => { const variant = product.variants[0]; return { id: product.id, name: product.name, slug: product.slug, category: product.category, imageUrl: product.imageUrl, price: formatMoney(variant?.priceMinor ?? 0, store.currency), soldOut: !isVariantBuyable(variant), lowStock: Boolean(variant && variant.stock > 0 && variant.stock <= 3), href: `/${store.slug}/products/${product.slug}` }; });
  return <CollectionPage store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} products={productViews} categories={categories} selectedCategory={selected ?? undefined} allHref={`/${store.slug}/shop`} categoryHref={(category) => `/${store.slug}/shop?category=${encodeURIComponent(category)}`} />;
}
