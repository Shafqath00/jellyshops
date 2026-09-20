"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useThemePresentation } from "@/components/storefront-shell";
import { useShop } from "@/contexts/shop-context";
import { formatMoney, type ConfiguredOptionSelection } from "@/lib/domain";
import { getConfiguredPriceMinor, resolveProductVariant } from "@/lib/product-configuration";
import { useStorefrontCatalogStatus } from "@/features/commerce/components/storefront-catalog-sync";

export default function ProductPage() {
  const { storeSlug, productSlug } = useParams<{ storeSlug: string; productSlug: string }>();
  const decodedProductSlug = decodeURIComponent(productSlug);
  const { repository } = useShop();
  const { shell, settings } = useThemePresentation();
  const catalogStatus = useStorefrontCatalogStatus();
  const [selections, setSelections] = useState<ConfiguredOptionSelection[]>([]);
  const [added, setAdded] = useState(false);
  const store = repository.getStoreBySlug(storeSlug);
  const product = store ? repository.getProductBySlug(store.id, decodedProductSlug) : undefined;
  const options = [...(product?.options ?? [])].sort((a, b) => a.position - b.position);
  if (catalogStatus === "loading") return <main className="flex min-h-[75vh] items-center justify-center">Loading product…</main>;
  if (!store || !product || product.archived || !product.published) return <main className="flex min-h-[75vh] flex-col items-center justify-center"><h1>Product not found</h1><Link href={`/${storeSlug}/shop`}>Back to shop</Link></main>;
  const selected = (optionId: string) => selections.find((item) => item.optionId === optionId)?.valueId;
  const choose = (optionId: string, valueId: string) => setSelections((items) => [...items.filter((item) => item.optionId !== optionId), { optionId, valueId }]);
  const requiredMissing = options.some((option) => option.required && !selected(option.id));
  const variant = resolveProductVariant(product, selections);
  const finalPrice = getConfiguredPriceMinor(variant, options, selections) ?? 0;
  const addToCart = () => { if (!variant || variant.stock <= 0 || requiredMissing) return; const cart = repository.getCartForStore(storeSlug) ?? repository.createCart(storeSlug); const line = cart.items.find((item) => item.variantId === variant.id && JSON.stringify(item.configurationSelections ?? []) === JSON.stringify(selections)); repository.updateCartItem(cart.id, variant.id, Math.min((line?.quantity ?? 0) + 1, variant.stock), selections, finalPrice); setAdded(true); };
  const ProductTemplate = shell.ProductPage;
  const productOptions = options.map((option) => ({ id: option.id, name: option.name, required: option.required, values: option.values.map((value) => ({ id: value.id, label: value.label, priceAdjustment: value.priceAdjustmentMinor ? formatMoney(value.priceAdjustmentMinor, store.currency) : undefined, selected: selected(option.id) === value.id })) }));
  return <ProductTemplate store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} product={{ name: product.name, category: product.category, description: product.description, imageUrl: product.imageUrl }} price={formatMoney(finalPrice, store.currency)} availableText={variant ? (variant.stock > 0 ? `${variant.stock} available` : "Out of stock") : requiredMissing ? "Choose the required options" : "This combination is unavailable"} options={productOptions} backHref={`/${store.slug}/shop`} variantAvailable={Boolean(variant && variant.stock > 0)} requiredMissing={requiredMissing} added={added} onSelectOption={choose} onAddToCart={addToCart} />;
}
