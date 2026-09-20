"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useThemePresentation } from "@/components/storefront-shell";
import { useShop } from "@/contexts/shop-context";
import { formatMoney } from "@/lib/domain";

export default function SearchPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const query = useSearchParams().get("q")?.trim() ?? "";
  const { repository } = useShop();
  const { shell, settings } = useThemePresentation();
  const store = repository.getStoreBySlug(storeSlug);
  if (!store) return null;
  const normalized = query.toLowerCase();
  const results = repository.listProducts(storeSlug).filter((product) => product.published && !product.archived && (!normalized || `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(normalized))).map((product) => {
    const variant = product.variants[0];
    return { id: product.id, name: product.name, slug: product.slug, category: product.category, imageUrl: product.imageUrl, price: formatMoney(variant?.priceMinor ?? 0, store.currency), soldOut: !variant || variant.stock <= 0, lowStock: Boolean(variant && variant.stock > 0 && variant.stock <= 3), href: `/${store.slug}/products/${product.slug}` };
  });
  const Search = shell.SearchPage;
  return <Search store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} query={query} results={results} shopHref={`/${store.slug}/shop`} />;
}
