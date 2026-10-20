"use client";
import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WishlistButton } from "@/features/customers/wishlist-button";
import { useThemePresentation } from "@/components/storefront-shell";
import { useShop } from "@/contexts/shop-context";
import { formatMoney, type ConfiguredOptionSelection } from "@/lib/domain";
import { getConfiguredPriceMinor, resolveProductVariant } from "@/lib/product-configuration";
import { createProductPresentationContext } from "@/features/storefront/product-presentation";
import { useStorefrontCatalogStatus } from "@/features/commerce/components/storefront-catalog-sync";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";
import { loadPublicStorefrontPublication, type PublicStorefrontPublication } from "@/features/storefront/public-storefront-api";
import { resolveStorefrontRoute, type PublicResourceReader } from "@/features/storefront/resource-loader";

export default function ProductPage() {
  const router = useRouter();
  const { storeSlug, productSlug } = useParams<{ storeSlug: string; productSlug: string }>();
  const decodedProductSlug = decodeURIComponent(productSlug);
  const { repository } = useShop();
  const { shell, settings } = useThemePresentation();
  const catalogStatus = useStorefrontCatalogStatus();
  const [selections, setSelections] = useState<ConfiguredOptionSelection[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const initialPublication = useInitialStorefrontPublication();
  const [publication, setPublication] = useState<PublicStorefrontPublication | null>(initialPublication);
  const [resolvedRoute, setResolvedRoute] = useState<Awaited<ReturnType<typeof resolveStorefrontRoute>> | null>(null);
  const store = repository.getStoreBySlug(storeSlug);
  const product = store ? repository.getProductBySlug(store.id, decodedProductSlug) : undefined;
  const visibleProducts = repository.listProducts(storeSlug).filter((item) => item.published && !item.archived);
  const options = [...(product?.options ?? [])].sort((a, b) => a.position - b.position);
  const selected = (optionId: string) => selections.find((item) => item.optionId === optionId)?.valueId;
  const choose = (optionId: string, valueId: string) => setSelections((items) => [...items.filter((item) => item.optionId !== optionId), { optionId, valueId }]);
  const requiredMissing = options.some((option) => option.required && !selected(option.id));
  const variant = product ? resolveProductVariant(product, selections) : undefined;
  const finalPrice = getConfiguredPriceMinor(variant, options, selections) ?? 0;
  const addCurrentToCart = async ({ variantId, nextQuantity, nextSelections, priceMinor }: { variantId: string; nextQuantity: number; nextSelections: ConfiguredOptionSelection[]; priceMinor: number }) => {
    if (!product || !variant || variant.id !== variantId || variant.stock <= 0 || requiredMissing) return { ok: false, message: "This product is unavailable" };
    const cart = repository.getCartForStore(storeSlug) ?? repository.createCart(storeSlug);
    const line = cart.items.find((item) => item.variantId === variantId && JSON.stringify(item.configurationSelections ?? []) === JSON.stringify(nextSelections));
    repository.updateCartItem(cart.id, variantId, Math.min((line?.quantity ?? 0) + nextQuantity, variant.stock), nextSelections, priceMinor);
    setAdded(true);
    return { ok: true };
  };
  const productPresentation = store && product ? createProductPresentationContext({
    product,
    currency: store.currency,
    shippingCopy: store.shippingCopy,
    selections,
    quantity,
    onSelectionsChange: setSelections,
    onQuantityChange: setQuantity,
    onAddToCart: ({ variantId, quantity: nextQuantity, selections: nextSelections, priceMinor }) => addCurrentToCart({ variantId, nextQuantity, nextSelections, priceMinor }),
    relatedProducts: visibleProducts.filter((item) => item.id !== product.id && ((item.collectionIds ?? []).some((id) => (product.collectionIds ?? []).includes(id)) || (item.primaryCategoryId && item.primaryCategoryId === product.primaryCategoryId))).slice(0, 4).map((item) => ({ id: item.id, name: item.name, href: `/${store.slug}/products/${item.slug}`, imageUrl: item.imageUrl, price: formatMoney(item.variants[0]?.priceMinor ?? 0, store.currency) })),
  }) : undefined;
  if (productPresentation && store && product) {
    productPresentation.wishlistControl = <WishlistButton storeId={store.id} productId={product.id} />;
    productPresentation.buyNow = async () => {
      const result = await productPresentation.addToCart();
      if (result.ok) router.push('/' + store.slug + '/checkout');
      return result;
    };
  }
  useEffect(() => {
    if (!store) return;
    let active = true;
    void loadPublicStorefrontPublication({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001", storeId: store.id })
      .then((next) => { if (active) setPublication(next); });
    return () => { active = false; };
  }, [store]);
  useEffect(() => {
    if (!store || !product || publication?.kind !== "v4") return;
    const reader: PublicResourceReader = {
      findByHandle: async (type, handle) => type === "product" && handle === product.slug ? { type: "product", id: product.id, handle: product.slug, visible: true, data: { title: product.name, description: product.description, product, productPresentation } } : null,
      findById: async (type, id) => type === "product" && id === product.id ? { type: "product", id: product.id, handle: product.slug, visible: true, data: { title: product.name, description: product.description, product, productPresentation } } : null,
    };
    void resolveStorefrontRoute(publication.snapshot, { type: "product", handle: product.slug }, reader).then(setResolvedRoute);
  }, [product, publication, quantity, selections, store]);
  if (catalogStatus === "loading") return <main className="flex min-h-[75vh] items-center justify-center">Loading product…</main>;
  if (!store || !product || product.archived || !product.published) return <main className="flex min-h-[75vh] flex-col items-center justify-center"><h1>Product not found</h1><Link href={`/${storeSlug}/shop`}>Back to shop</Link></main>;
  if (publication?.kind === "v4") {
    if (resolvedRoute?.status === "ready") return <PublishedRuntimeStorefront snapshot={publication.snapshot} route={resolvedRoute} storeSlug={store.slug} currency={store.currency} products={visibleProducts} />;
  }
  const addToCart = () => { if (variant) void addCurrentToCart({ variantId: variant.id, nextQuantity: 1, nextSelections: selections, priceMinor: finalPrice }); };
  const ProductTemplate = shell.ProductPage;
  const productOptions = options.map((option) => ({ id: option.id, name: option.name, required: option.required, values: option.values.map((value) => ({ id: value.id, label: value.label, priceAdjustment: value.priceAdjustmentMinor ? formatMoney(value.priceAdjustmentMinor, store.currency) : undefined, selected: selected(option.id) === value.id })) }));
  return <ProductTemplate store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} product={{ name: product.name, category: product.category, description: product.description, imageUrl: product.imageUrl, specifications: product.specifications }} price={formatMoney(finalPrice, store.currency)} compareAtPrice={variant?.compareAtPriceMinor && variant.compareAtPriceMinor > finalPrice ? formatMoney(variant.compareAtPriceMinor, store.currency) : undefined} shippingCopy={store.shippingCopy} availableText={variant ? (variant.stock > 0 ? `${variant.stock} available` : "Out of stock") : requiredMissing ? "Choose the required options" : "This combination is unavailable"} options={productOptions} backHref={`/${store.slug}/shop`} variantAvailable={Boolean(variant && variant.stock > 0)} requiredMissing={requiredMissing} added={added} onSelectOption={choose} onAddToCart={addToCart} />;
}
