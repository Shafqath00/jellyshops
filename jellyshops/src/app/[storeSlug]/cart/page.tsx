"use client";
import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useThemePresentation } from "@/components/storefront-shell";
import { useShop } from "@/contexts/shop-context";
import { formatMoney } from "@/lib/domain";
import { PublishedRuntimeStorefront } from "@/features/storefront/storefront-page";
import { loadPublicStorefrontPublication, type PublicStorefrontPublication } from "@/features/storefront/public-storefront-api";
import { resolveStorefrontRoute } from "@/features/storefront/resource-loader";

export default function CartPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { repository, state } = useShop();
  const { shell, settings } = useThemePresentation();
  const store = repository.getStoreBySlug(storeSlug);
  const initialPublication = useInitialStorefrontPublication();
  const [publication, setPublication] = useState<PublicStorefrontPublication | null>(initialPublication);
  const [resolvedRoute, setResolvedRoute] = useState<Awaited<ReturnType<typeof resolveStorefrontRoute>> | null>(null);
  useEffect(() => {
    if (!store) return;
    let active = true;
    void loadPublicStorefrontPublication({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001", storeId: store.id }).then((next) => { if (active) setPublication(next); });
    return () => { active = false; };
  }, [store]);
  useEffect(() => {
    if (publication?.kind !== "v4") return;
    void resolveStorefrontRoute(publication.snapshot, { type: "cart" }, { findByHandle: async () => null, findById: async () => null }).then(setResolvedRoute);
  }, [publication]);
  if (!store) return null;
  const cart = repository.getCartForStore(storeSlug);
  const lines = (cart?.items ?? []).map((item) => {
    const product = state.products.find((entry) => entry.variants.some((variant) => variant.id === item.variantId));
    const variant = product?.variants.find((entry) => entry.id === item.variantId);
    if (!product || !variant) return null;
    const options = (item.configurationSelections ?? []).flatMap((selection) => {
      const option = product.options?.find((entry) => entry.id === selection.optionId);
      const value = option?.values.find((entry) => entry.id === selection.valueId);
      return option && value ? [`${option.name}: ${value.label}`] : [];
    });
    const unitPrice = item.unitPriceMinor ?? variant.priceMinor;
    return { id: `${variant.id}-${JSON.stringify(item.configurationSelections ?? [])}`, productName: product.name, variantName: variant.name, imageUrl: product.imageUrl, quantity: item.quantity, unitPrice: formatMoney(unitPrice, store.currency), lineTotal: formatMoney(unitPrice * item.quantity, store.currency), lineTotalMinor: unitPrice * item.quantity, canIncrease: item.quantity < variant.stock, options, onUpdate: (quantity: number) => repository.updateCartItem(cart!.id, variant.id, quantity, item.configurationSelections, item.unitPriceMinor) };
  }).filter((line): line is NonNullable<typeof line> => Boolean(line));
  const Cart = shell.CartPage;
  if (publication?.kind === "v4" && resolvedRoute?.status === "ready") {
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
    const route = { ...resolvedRoute, context: { pageType: "cart" as const, resource: null, data: { lines: lines.map((line) => ({ id: line.id, name: `${line.productName} · ${line.variantName}`, quantity: line.quantity, total: line.lineTotal, onDecrease: () => line.onUpdate(line.quantity - 1), onIncrease: () => line.onUpdate(line.quantity + 1) })), subtotal: formatMoney(subtotal, store.currency), checkoutHref: `/${store.slug}/checkout` } } };
    return <PublishedRuntimeStorefront snapshot={publication.snapshot} route={route} storeSlug={store.slug} currency={store.currency} products={state.products.filter((product) => product.published && !product.archived)} />;
  }
  return <Cart store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} lines={lines} subtotal={formatMoney(lines.reduce((sum, line) => sum + line.lineTotalMinor, 0), store.currency)} shopHref={`/${store.slug}/shop`} checkoutHref={`/${store.slug}/checkout`} onDecrease={(id) => { const line = lines.find((entry) => entry.id === id); if (line) line.onUpdate(line.quantity - 1); }} onIncrease={(id) => { const line = lines.find((entry) => entry.id === id); if (line) line.onUpdate(line.quantity + 1); }} />;
}
