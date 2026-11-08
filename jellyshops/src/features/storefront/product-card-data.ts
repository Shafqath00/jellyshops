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
/** A product can go into the cart from its card when it has one buyable variant and no options to choose. */
export function quickAddFor(product: Product): { quickAdd?: { variantId: string; max: number } } {
  const variant = product.variants.length === 1 ? product.variants[0] : undefined;
  if (!variant || variant.sellable === false || variant.stock <= 0 || (product.options?.length ?? 0) > 0) return {};
  return { quickAdd: { variantId: variant.id, max: Math.min(variant.stock, 99) } };
}

export function productCardData(product: Product, href: string, currency: Currency): PublicProduct {
  const variant = product.variants[0];
  const priceMinor = variant?.priceMinor ?? 0;
  const compareMinor = variant?.compareAtPriceMinor ?? product.compareAtPriceMinor;
  const discounted = typeof compareMinor === "number" && compareMinor > priceMinor && priceMinor >= 0;
  const chip = productCardChip(product.tags);
  const colours = productCardSwatches(product);
  return {
    id: product.id,
    name: product.name,
    href,
    imageUrl: product.imageUrl,
    price: formatMoney(priceMinor, currency),
    priceMinor,
    available: product.variants.some((item) => item.stock > 0),
    ...quickAddFor(product),
    ...(discounted ? {
      compareAtPrice: formatMoney(compareMinor, currency),
      saving: formatMoney(compareMinor - priceMinor, currency),
      discountPercent: Math.max(1, Math.round((1 - priceMinor / compareMinor) * 100)),
    } : {}),
    ...(chip ? { chip } : {}),
    ...(product.vendor?.trim() ? { vendor: product.vendor.trim().slice(0, 60) } : {}),
    ...colours,
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const SAFE_IMAGE = /^(https:\/\/|\/api\/public\/media\/)[^\s"'<>()]+$/;

/**
 * The colours a product comes in, for the card's swatches: the values of its first option shown as colour or image
 * swatches (hex colours and https/media images only), at most five, plus how many more there are.
 */
export function productCardSwatches(product: Pick<Product, "options">): Pick<PublicProduct, "swatches" | "moreSwatches"> {
  const option = [...(product.options ?? [])].sort((a, b) => a.position - b.position).find((item) => item.display === "color" || item.display === "image");
  if (!option) return {};
  type Swatch = NonNullable<PublicProduct["swatches"]>[number];
  const values = option.values.flatMap((value): Swatch[] => option.display === "color"
    ? (value.color && HEX.test(value.color) ? [{ label: value.label, color: value.color }] : [])
    : (value.image && SAFE_IMAGE.test(value.image) ? [{ label: value.label, image: value.image }] : []));
  if (!values.length) return {};
  return { swatches: values.slice(0, 5), ...(values.length > 5 ? { moreSwatches: values.length - 5 } : {}) };
}
