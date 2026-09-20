"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useThemePresentation } from "@/components/storefront-shell";
import { formatMoney } from "@/lib/domain";
import { useShop } from "@/contexts/shop-context";
import { useStorefrontCatalogStatus } from "@/features/commerce/components/storefront-catalog-sync";

export default function ShopPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const search = useSearchParams();
  const { repository } = useShop();
  const { shell, settings } = useThemePresentation();
  const catalogStatus = useStorefrontCatalogStatus();
  const store = repository.getStoreBySlug(storeSlug);
  if (!store) return null;
  if (catalogStatus === "loading") return <main className="px-6 py-24 text-center text-[var(--store-text)]"><p className="opacity-70">Loading the collection…</p></main>;
  const products = repository.listProducts(storeSlug).filter((product) => product.published && !product.archived);
  const categories = [...new Set(products.map((product) => product.category))];
  const selected = search.get("category");
  const visible = selected ? products.filter((product) => product.category === selected) : products;
  const CollectionPage = shell.CollectionPage;
  const productViews = visible.map((product) => { const variant = product.variants[0]; return { id: product.id, name: product.name, slug: product.slug, category: product.category, imageUrl: product.imageUrl, price: formatMoney(variant?.priceMinor ?? 0, store.currency), soldOut: !variant || variant.stock <= 0, lowStock: Boolean(variant && variant.stock > 0 && variant.stock <= 3), href: `/${store.slug}/products/${product.slug}` }; });
  return <CollectionPage store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} products={productViews} categories={categories} selectedCategory={selected ?? undefined} allHref={`/${store.slug}/shop`} categoryHref={(category) => `/${store.slug}/shop?category=${encodeURIComponent(category)}`} />;
}
