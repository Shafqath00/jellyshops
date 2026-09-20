"use client";

import { useParams } from "next/navigation";
import { useThemePresentation } from "@/components/storefront-shell";
import { useShop } from "@/contexts/shop-context";
import { formatMoney } from "@/lib/domain";

export default function CartPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { repository, state } = useShop();
  const { shell, settings } = useThemePresentation();
  const store = repository.getStoreBySlug(storeSlug);
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
  return <Cart store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} lines={lines} subtotal={formatMoney(lines.reduce((sum, line) => sum + line.lineTotalMinor, 0), store.currency)} shopHref={`/${store.slug}/shop`} checkoutHref={`/${store.slug}/checkout`} onDecrease={(id) => { const line = lines.find((entry) => entry.id === id); if (line) line.onUpdate(line.quantity - 1); }} onIncrease={(id) => { const line = lines.find((entry) => entry.id === id); if (line) line.onUpdate(line.quantity + 1); }} />;
}
