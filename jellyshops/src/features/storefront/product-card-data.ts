import type { PublicProduct } from "@jelly/storefront-renderer";
import { formatMoney, type Currency, type Product } from "@/lib/domain";

/** Tags written `label:More colours` show as a small chip on the product card. */
const LABEL_TAG = /^label:\s*(.+)$/i;

export function productCardChip(tags: readonly string[] | undefined): string | undefined {
  for (const tag of tags ?? []) {
    const label = LABEL_TAG.exec(tag.trim())?.[1]?.trim();
    if (label) return label.slice(0, 24);
  }
  return undefined;
}

/**
 * Card data for one product: its first variant's price, and when that variant (or the product) has a
 * higher "compare at" price, the old price, the saving and the percentage off. Themes choose which of
 * those to show (theme settings > Product cards and Badges).
 */
export function productCardData(product: Product, href: string, currency: Currency): PublicProduct {
  const variant = product.variants[0];
  const priceMinor = variant?.priceMinor ?? 0;
  const compareMinor = variant?.compareAtPriceMinor ?? product.compareAtPriceMinor;
  const discounted = typeof compareMinor === "number" && compareMinor > priceMinor && priceMinor >= 0;
  const chip = productCardChip(product.tags);
  return {
    id: product.id,
    name: product.name,
    href,
    imageUrl: product.imageUrl,
    price: formatMoney(priceMinor, currency),
    ...(discounted ? {
      compareAtPrice: formatMoney(compareMinor, currency),
      saving: formatMoney(compareMinor - priceMinor, currency),
      discountPercent: Math.max(1, Math.round((1 - priceMinor / compareMinor) * 100)),
    } : {}),
    ...(chip ? { chip } : {}),
  };
}
