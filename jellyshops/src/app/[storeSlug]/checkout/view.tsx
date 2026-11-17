"use client";

import { useParams } from "next/navigation";
import { useShop } from "@/contexts/shop-context";
import { CheckoutView } from "@/features/checkout/components/checkout-view";
import { useThemePresentation } from "@/features/storefront/components/storefront-shell";

export { CheckoutView };

/** Every theme draws the same checkout inside its own page frame (header, footer). */
export default function CheckoutPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { repository } = useShop();
  const { shell, settings } = useThemePresentation();
  const store = repository.getStoreBySlug(storeSlug);
  if (!store) return null;
  const Checkout = shell.CheckoutPage;
  return <Checkout store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings}><CheckoutView storeSlug={storeSlug} /></Checkout>;
}
