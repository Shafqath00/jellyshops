"use client";
import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";

import Link from "next/link";
import { ProductGalleryViewer } from "@jelly/storefront-renderer";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WishlistButton } from "@/features/customers/components/wishlist-button";
import { useThemePresentation } from "@/features/storefront/components/storefront-shell";
import { useShop } from "@/contexts/shop-context";
import { formatMoney, type ConfiguredOptionSelection } from "@/lib/domain";
import { createCartConfigurationKey, getConfiguredPriceMinor, resolveProductVariant } from "@/lib/product-configuration";
import type { PersonalisationEntry } from "@jelly/storefront-schema";
import { getVisibleOptions, toggleSelection, validateProductSelections } from "@/lib/product-builder";
import { createProductPresentationContext } from "@/features/storefront/product-presentation";
import { productCardData } from "@/features/storefront/product-card-data";
import { productFamily } from "@/features/storefront/product-family";
import { useStorefrontCatalogStatus } from "@/features/commerce/components/storefront-catalog-sync";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";
import { loadPublicStorefrontPublication, type PublicStorefrontPublication } from "@/features/storefront/public-storefront-api";
import { resolveStorefrontRoute, type PublicResourceReader } from "@/features/storefront/resource-loader";
import { StorefrontPageLoading } from "@/features/storefront/components/storefront-page-loading";
import { requestBackInStock } from "@/features/storefront/back-in-stock-api";
import { useVariantAddress } from "@/features/storefront/use-variant-address";
import { isVariantBuyable, variantMaxQuantity } from "@/lib/variant-stock";

export default function ProductPage() {
  const router = useRouter();
  const { storeSlug, productSlug } = useParams<{ storeSlug: string; productSlug: string }>();
  const decodedProductSlug = decodeURIComponent(productSlug);
  const { repository } = useShop();
  const { shell, settings } = useThemePresentation();
  const catalogStatus = useStorefrontCatalogStatus();
  const [selections, setSelections] = useState<ConfiguredOptionSelection[]>([]);
  const [quantity, setQuantity] = useState(1);
  // Personalisation text (engraving, gift message) and whether the shopper already tried to add without it.
  const [personalisationValues, setPersonalisationValues] = useState<Record<string, string>>({});
  const [personalisationTried, setPersonalisationTried] = useState(false);
  const [added, setAdded] = useState(false);
  const initialPublication = useInitialStorefrontPublication();
  const [publication, setPublication] = useState<PublicStorefrontPublication | null>(initialPublication);
  const [resolvedRoute, setResolvedRoute] = useState<Awaited<ReturnType<typeof resolveStorefrontRoute>> | null>(null);
  const [publicationChecked, setPublicationChecked] = useState(false);
  const store = repository.getStoreBySlug(storeSlug);
  const product = store ? repository.getProductBySlug(store.id, decodedProductSlug) : undefined;
  const visibleProducts = repository.listProducts(storeSlug).filter((item) => item.published && !item.archived);
  // The chosen variant is kept in the address (?variant=), so shared links open it.
  useVariantAddress(product, selections, setSelections);
  const allOptions = [...(product?.options ?? [])].sort((a, b) => a.position - b.position);
  const options = getVisibleOptions(allOptions, selections);
  const isSelected = (optionId: string, valueId: string) => selections.some((item) => item.optionId === optionId && item.valueId === valueId);
  const choose = (optionId: string, valueId: string) => { const option = allOptions.find((candidate) => candidate.id === optionId); if (option) setSelections((items) => toggleSelection(option, items, valueId)); };
  const requiredMissing = validateProductSelections(allOptions, selections).some((problem) => problem.code === "required" || problem.code === "too_few");
  const variant = product ? resolveProductVariant(product, selections) : undefined;
  const finalPrice = getConfiguredPriceMinor(variant, options, selections) ?? 0;
  const addCurrentToCart = async ({ variantId, nextQuantity, nextSelections, priceMinor, personalisation = [] }: { variantId: string; nextQuantity: number; nextSelections: ConfiguredOptionSelection[]; priceMinor: number; personalisation?: PersonalisationEntry[] }) => {
    if (!product || !variant || variant.id !== variantId || !isVariantBuyable(variant) || requiredMissing) return { ok: false, message: "This product is unavailable" };
    const cart = repository.getCartForStore(storeSlug) ?? repository.createCart(storeSlug);
    const key = createCartConfigurationKey(variantId, nextSelections, personalisation);
    const line = cart.items.find((item) => createCartConfigurationKey(item.variantId, item.configurationSelections, item.personalisation) === key);
    repository.updateCartItem(cart.id, variantId, Math.min((line?.quantity ?? 0) + nextQuantity, variantMaxQuantity(variant)), nextSelections, priceMinor, personalisation);
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
    onAddToCart: ({ variantId, quantity: nextQuantity, selections: nextSelections, priceMinor, personalisation }) => addCurrentToCart({ variantId, nextQuantity, nextSelections, priceMinor, personalisation }),
    personalisationValues,
    onPersonalisationChange: setPersonalisationValues,
    showPersonalisationProblems: personalisationTried,
    relatedProducts: visibleProducts.filter((item) => item.id !== product.id && ((item.collectionIds ?? []).some((id) => (product.collectionIds ?? []).includes(id)) || (item.primaryCategoryId && item.primaryCategoryId === product.primaryCategoryId))).slice(0, 4).map((item) => productCardData(item, `/${store.slug}/products/${item.slug}`, store.currency)),
  }) : undefined;
  if (productPresentation && store && product) {
    // Other colours of the same design (products tagged family:<name>) link to each other.
    const family = productFamily(product, repository.listProducts(storeSlug), store.slug);
    if (family) productPresentation.family = family;
  }
  if (productPresentation?.personalisation) {
    // After a refused add, each field shows what is missing.
    const add = productPresentation.addToCart;
    productPresentation.addToCart = async () => { const result = await add(); if (!result.ok) setPersonalisationTried(true); return result; };
  }
  if (productPresentation && store && product && variant && productPresentation.availability.state === "out-of-stock") {
    productPresentation.notifyWhenAvailable = (email, website) => requestBackInStock(store.id, variant.id, email, website);
  }
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
      .then((next) => { if (active) setPublication(next); })
      .catch(() => undefined)
      .finally(() => { if (active) setPublicationChecked(true); });
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
  if (catalogStatus === "loading") return <StorefrontPageLoading label="Loading product…" />;
  if (!store || !product || product.archived || !product.published) return <main className="flex min-h-[75vh] flex-col items-center justify-center"><h1>Product not found</h1><Link href={`/${storeSlug}/shop`}>Back to shop</Link></main>;
  // Until the store's design is in, show a loading state rather than the built-in page (which showed £0.00).
  if (publication?.kind === "v4" ? !resolvedRoute : !publication && !publicationChecked) return <StorefrontPageLoading label="Loading product…" />;
  if (publication?.kind === "v4") {
    if (resolvedRoute?.status === "ready") return <PublishedRuntimeStorefront snapshot={publication.snapshot} route={resolvedRoute} storeSlug={store.slug} currency={store.currency} products={visibleProducts} />;
  }
  const addToCart = () => { if (variant) void addCurrentToCart({ variantId: variant.id, nextQuantity: 1, nextSelections: selections, priceMinor: finalPrice }); };
  const ProductTemplate = shell.ProductPage;
  const productOptions = options.map((option) => ({ id: option.id, name: option.name, required: option.required, values: option.values.map((value) => ({ id: value.id, label: value.label, priceAdjustment: value.priceAdjustmentMinor ? formatMoney(value.priceAdjustmentMinor, store.currency) : undefined, selected: isSelected(option.id, value.id) })) }));
  return <ProductTemplate store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} product={{ name: product.name, category: product.category, description: product.description, imageUrl: productPresentation?.product.imageUrl ?? product.imageUrl, gallery: productPresentation?.product.galleryEnabled ? <ProductGalleryViewer media={productPresentation.product.media ?? []} title={product.name} /> : undefined, specifications: product.specifications }} price={formatMoney(finalPrice, store.currency)} compareAtPrice={variant?.compareAtPriceMinor && variant.compareAtPriceMinor > finalPrice ? formatMoney(variant.compareAtPriceMinor, store.currency) : undefined} shippingCopy={store.shippingCopy} availableText={variant && variant.sellable !== false ? (variant.stock > 0 ? `${variant.stock} available` : isVariantBuyable(variant) ? "Available" : "Out of stock") : requiredMissing ? "Choose the required options" : "This combination is unavailable"} options={productOptions} backHref={`/${store.slug}/shop`} variantAvailable={isVariantBuyable(variant)} requiredMissing={requiredMissing} added={added} onSelectOption={choose} onAddToCart={addToCart} />;
}
