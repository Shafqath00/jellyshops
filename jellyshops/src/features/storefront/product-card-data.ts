import type { PublicProduct } from "@jelly/storefront-renderer";
import { productFilterValues } from "@jelly/storefront-schema";
import { formatMoney, type Currency, type Product } from "@/lib/domain";
import { isVariantBuyable, variantMaxQuantity } from "@/lib/variant-stock";

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
  if (!variant || !isVariantBuyable(variant) || (product.options?.length ?? 0) > 0 || (product.personalisation?.length ?? 0) > 0 || product.quantityRule) return {};
  return { quickAdd: { variantId: variant.id, max: Math.min(variantMaxQuantity(variant), 99) } };
}

/**
 * Choices for "Complete the set": the product's variants by their one stock option (usually Size), so a shopper can
 * add it to the bag without opening its page. Left out when the product needs anything else first (a required
 * choice that is not a stock option, required personalisation, a quantity rule) or has more than one stock option.
 * Optional extras (add-ons) are fine: the line simply goes in without them.
 */
export function setChoicesFor(product: Product, currency: Currency): { setChoices?: NonNullable<PublicProduct["setChoices"]> } {
  const options = product.options ?? [];
  const stockOptions = options.filter((option) => option.type === "variant");
  if (options.some((option) => option.type !== "variant" && option.required)) return {};
  if (product.personalisation?.some((field) => field.required) || product.quantityRule || stockOptions.length > 1) return {};
  const live = product.variants.filter((variant) => variant.sellable !== false);
  if (live.length === 0) return {};
  const option = stockOptions[0];
  const labelOf = (variant: Product["variants"][number]) => {
    if (!option) return variant.name || product.name;
    const valueId = variant.options?.[option.id];
    return option.values.find((value) => value.id === valueId)?.label ?? variant.name;
  };
  const order = (variant: Product["variants"][number]) => {
    const valueId = option ? variant.options?.[option.id] : undefined;
    const index = option?.values.findIndex((value) => value.id === valueId) ?? -1;
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  const values = [...live].sort((a, b) => order(a) - order(b)).map((variant) => ({
    variantId: variant.id, label: labelOf(variant), price: formatMoney(variant.priceMinor, currency), priceMinor: variant.priceMinor,
    ...((variant.compareAtPriceMinor ?? product.compareAtPriceMinor ?? 0) > variant.priceMinor ? { compareAtPriceMinor: variant.compareAtPriceMinor ?? product.compareAtPriceMinor } : {}),
    max: isVariantBuyable(variant) ? Math.min(variantMaxQuantity(variant), 99) : 0,
  }));
  return { setChoices: { optionName: option?.name ?? "", values } };
}

/** The variant a card shows: the cheapest one still for sale, else the cheapest (variants arrive in no particular order). */
export function cardVariant(product: Pick<Product, "variants">): Product["variants"][number] | undefined {
  const cheapest = (list: Product["variants"]) => list.reduce<Product["variants"][number] | undefined>((best, item) => !best || item.priceMinor < best.priceMinor ? item : best, undefined);
  return cheapest(product.variants.filter(isVariantBuyable)) ?? cheapest(product.variants);
}

export function productCardData(product: Product, href: string, currency: Currency): PublicProduct {
  const variant = cardVariant(product);
  const priceMinor = variant?.priceMinor ?? 0;
  const compareMinor = variant?.compareAtPriceMinor ?? product.compareAtPriceMinor;
  const discounted = typeof compareMinor === "number" && compareMinor > priceMinor && priceMinor >= 0;
  const chip = productCardChip(product.tags);
  const colours = productCardSwatches(product);
  const filters = productFilterValues({ options: product.options, variantOptions: product.variants.map((item) => item.options), tags: product.tags, vendor: product.vendor, productType: product.productType });
  const hoverImageUrl = productHoverImage(product);
  const photo = product.media?.find((entry) => entry.url === product.imageUrl);
  return {
    id: product.id,
    name: product.name,
    href,
    imageUrl: product.imageUrl,
    price: formatMoney(priceMinor, currency),
    priceMinor,
    available: product.variants.some(isVariantBuyable),
    ...quickAddFor(product),
    ...(discounted ? {
      compareAtPrice: formatMoney(compareMinor, currency),
      saving: formatMoney(compareMinor - priceMinor, currency),
      discountPercent: Math.max(1, Math.round((1 - priceMinor / compareMinor) * 100)),
    } : {}),
    ...(chip ? { chip } : {}),
    ...(product.vendor?.trim() ? { vendor: product.vendor.trim().slice(0, 60) } : {}),
    ...colours,
    ...(filters.length ? { filters } : {}),
    ...(hoverImageUrl ? { hoverImageUrl } : {}),
    ...(photo?.variantWidths?.length ? { imageWidths: photo.variantWidths } : {}),
    ...(photo?.placeholder ? { imagePlaceholder: photo.placeholder } : {}),
  };
}

/** Photo addresses a card may load: http(s) (media from a local API is http) or a path on this site. */
const PHOTO_URL = /^(https?:\/\/|\/(?!\/))[^\s"'<>()\\]+$/;

/** The second photo of a product, shown when the shopper points at its card. */
export function productHoverImage(product: Pick<Product, "imageUrl" | "media">): string | undefined {
  // The first photo is the card's own picture; the next one is shown on hover.
  const second = [...(product.media ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[1]?.url;
  return typeof second === "string" && PHOTO_URL.test(second) && second !== product.imageUrl ? second : undefined;
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
