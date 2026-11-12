"use client";
import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useThemePresentation } from "@/features/storefront/components/storefront-shell";
import { useShop } from "@/contexts/shop-context";
import { formatMoney } from "@/lib/domain";
import { cartProductImage } from "@/lib/product-media";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";
import { buildStorefrontRoute, deserializeRouteValues } from "@/features/storefront/resource-loader";
import { StorefrontPageLoading } from "@/features/storefront/components/storefront-page-loading";
import { cartLineKey, personalisationLabels } from "@/features/storefront/personalisation-display";
import { canIncreaseCartQuantity, nextCartQuantity } from "@/features/storefront/cart-quantity";

export default function CartPage({ routeValues }: { routeValues?: Array<[string, unknown]> }) {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { repository, state, hydrated } = useShop();
  const { shell, settings } = useThemePresentation();
  const store = repository.getStoreBySlug(storeSlug);
  // The published design arrives with the page from the server; the bag itself is saved in the shopper's browser.
  const publication = useInitialStorefrontPublication();
  const values = useMemo(() => deserializeRouteValues(routeValues), [routeValues]);
  const resolvedRoute = publication?.kind === "v4" ? buildStorefrontRoute(publication.snapshot, { type: "cart" }, null, values) : null;
  if (!store) return null;
  if (!hydrated) {
    // The server cannot see the bag, so the themed page arrives with a loading line in the bag section
    // (rather than briefly saying the bag is empty).
    if (publication?.kind === "v4" && resolvedRoute?.status === "ready") {
      const route = { ...resolvedRoute, context: { pageType: "cart" as const, resource: null, data: { pending: true, shopHref: `/${store.slug}/shop` } } };
      return <PublishedRuntimeStorefront snapshot={publication.snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={state.products.filter((product) => product.published && !product.archived)} />;
    }
    return <StorefrontPageLoading label="Loading your bag…" />;
  }
  const cart = repository.getCartForStore(storeSlug);
  const lines = (cart?.items ?? []).map((item) => {
    const product = state.products.find((entry) => entry.variants.some((variant) => variant.id === item.variantId));
    const variant = product?.variants.find((entry) => entry.id === item.variantId);
    if (!product || !variant) return null;
    const options = (item.configurationSelections ?? []).flatMap((selection) => {
      const option = product.options?.find((entry) => entry.id === selection.optionId);
      const value = option?.values.find((entry) => entry.id === selection.valueId);
      return option && value ? [`${option.name}: ${value.label}`] : [];
    }).concat(personalisationLabels(product, item));
    const unitPrice = item.unitPriceMinor ?? variant.priceMinor;
    return { id: cartLineKey(variant.id, item), productName: product.name, variantName: variant.name, imageUrl: cartProductImage(product, variant, item.configurationSelections), quantity: item.quantity, unitPrice: formatMoney(unitPrice, store.currency), lineTotal: formatMoney(unitPrice * item.quantity, store.currency), lineTotalMinor: unitPrice * item.quantity, canIncrease: canIncreaseCartQuantity(product, variant, item.quantity), options, onUpdate: (quantity: number) => repository.updateCartItem(cart!.id, variant.id, nextCartQuantity(product, variant, item.quantity, quantity), item.configurationSelections, item.unitPriceMinor, item.personalisation) };
  }).filter((line): line is NonNullable<typeof line> => Boolean(line));
  const Cart = shell.CartPage;
  if (publication?.kind === "v4" && resolvedRoute?.status === "ready") {
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
    const route = { ...resolvedRoute, context: { pageType: "cart" as const, resource: null, data: { lines: lines.map((line) => ({ id: line.id, name: `${line.productName} · ${line.variantName}`, productName: line.productName, variantName: line.variantName, imageUrl: line.imageUrl, options: line.options, quantity: line.quantity, unitPrice: line.unitPrice, total: line.lineTotal, canIncrease: line.canIncrease, onDecrease: () => line.onUpdate(line.quantity - 1), onIncrease: () => line.onUpdate(line.quantity + 1), onRemove: () => line.onUpdate(0) })), subtotal: formatMoney(subtotal, store.currency), shippingNote: store.shippingCopy || "Shipping is calculated at checkout.", checkoutHref: `/${store.slug}/checkout`, shopHref: `/${store.slug}/shop` } } };
    return <PublishedRuntimeStorefront snapshot={publication.snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={state.products.filter((product) => product.published && !product.archived)} />;
  }
  return <Cart store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} lines={lines} subtotal={formatMoney(lines.reduce((sum, line) => sum + line.lineTotalMinor, 0), store.currency)} shopHref={`/${store.slug}/shop`} checkoutHref={`/${store.slug}/checkout`} onDecrease={(id) => { const line = lines.find((entry) => entry.id === id); if (line) line.onUpdate(line.quantity - 1); }} onIncrease={(id) => { const line = lines.find((entry) => entry.id === id); if (line) line.onUpdate(line.quantity + 1); }} />;
}
