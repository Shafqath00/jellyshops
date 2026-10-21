import type { ProductPresentationContext } from "@jelly/storefront-renderer";
import type { ConfiguredOptionSelection, Currency, Product } from "@/lib/domain";
import { formatMoney } from "@/lib/domain";
import { getConfiguredPriceMinor, resolveProductVariant } from "@/lib/product-configuration";
import type { CatalogAdminProduct } from "@/features/store-editor/api/types";

/** Maps the catalog detail DTO to the existing storefront Product domain shape. */
export function catalogProductToProduct(product: CatalogAdminProduct): Product {
  const options = (product.options ?? []).filter((option): option is NonNullable<Product["options"]>[number] =>
    Boolean(option) && typeof option === "object" && !Array.isArray(option)
    && typeof (option as { id?: unknown }).id === "string"
    && typeof (option as { name?: unknown }).name === "string"
    && Array.isArray((option as { values?: unknown }).values),
  );
  return {
    id: product.id, storeId: product.storeId, name: product.title, slug: product.handle,
    description: product.description, specifications: product.specifications ?? {}, category: product.productType ?? "", imageUrl: product.media[0]?.url ?? "",
    published: product.status === "ACTIVE", archived: product.status === "ARCHIVED", featured: false,
    media: product.media.map((media) => ({ id: media.id, url: media.url, ...(media.altText ? { altText: media.altText } : {}) })),
    ...(product.vendor ? { vendor: product.vendor } : {}),
    variants: product.variants.map((variant) => ({
      id: variant.id, name: variant.title, sku: variant.sku ?? "", priceMinor: variant.priceMinor,
      ...(variant.compareAtPriceMinor == null ? {} : { compareAtPriceMinor: variant.compareAtPriceMinor }),
      stock: variant.quantity ?? 0, available: variant.available, options: variant.options as Record<string, string> | undefined,
    })),
    options, inventoryOptionIds: product.inventoryOptionIds ?? [], primaryCategoryId: product.primaryCategoryId ?? undefined,
    additionalCategoryIds: product.additionalCategoryIds ?? [], brandId: product.brandId ?? undefined, collectionIds: product.collectionIds ?? [],
  };
}

export function createProductPresentationContext({ product, currency, shippingCopy, selections, quantity, onSelectionsChange, onQuantityChange, onAddToCart, relatedProducts = [] }: {
  product: Product;
  currency: Currency;
  shippingCopy?: string;
  selections: ConfiguredOptionSelection[];
  quantity: number;
  onSelectionsChange(selections: ConfiguredOptionSelection[]): void;
  onQuantityChange(quantity: number): void;
  onAddToCart(input: { variantId: string; quantity: number; selections: ConfiguredOptionSelection[]; priceMinor: number }): Promise<{ ok: boolean; message?: string }>;
  relatedProducts?: ProductPresentationContext["relatedProducts"];
}): ProductPresentationContext {
  const options = [...(product.options ?? [])].sort((left, right) => left.position - right.position);
  const selectedValue = (optionId: string) => selections.find((selection) => selection.optionId === optionId)?.valueId;
  const inventoryChoiceMissing = (product.inventoryOptionIds ?? []).some((optionId) => !selectedValue(optionId));
  const requiredMissing = inventoryChoiceMissing || options.some((option) => option.required && !selectedValue(option.id));
  const variant = resolveProductVariant(product, selections);
  const priceMinor = getConfiguredPriceMinor(variant, options, selections);
  const untrackedAvailable = variant?.available === true && variant.stock === 0;
  const maxQuantity = !requiredMissing && variant && variant.stock > 0 ? variant.stock : untrackedAvailable ? undefined : 0;
  const clampedQuantity = maxQuantity === undefined ? Math.max(1, quantity) : Math.max(1, Math.min(quantity, maxQuantity));
  const availability = requiredMissing ? { state: "selection-required" as const, message: "Choose the required options", maxQuantity: 0 }
    : !variant ? { state: "unavailable" as const, message: "This combination is unavailable", maxQuantity: 0 }
      : variant.stock <= 0 && !untrackedAvailable ? { state: "out-of-stock" as const, message: "Out of stock", maxQuantity: 0 }
        : untrackedAvailable ? { state: "available" as const, message: "Available" }
          : { state: "available" as const, message: `${variant.stock} available`, maxQuantity: variant.stock };

  return {
    product: { id: product.id, title: product.name, description: product.description, imageUrl: product.imageUrl, specifications: product.specifications ?? {}, shippingCopy, media: product.media ?? (product.imageUrl ? [{ id: `${product.id}-primary`, url: product.imageUrl }] : []), sku: variant?.sku || undefined, vendor: product.vendor, options: options.map((option) => ({ id: option.id, name: option.name, required: option.required, values: option.values.map((value) => ({ id: value.id, label: value.label, selected: selectedValue(option.id) === value.id, available: true })) })) },
    selection: selections,
    quantity: clampedQuantity,
    pricing: { price: formatMoney(priceMinor ?? (inventoryChoiceMissing && product.variants.length ? Math.min(...product.variants.map((candidate) => candidate.priceMinor)) : 0), currency), ...(variant?.compareAtPriceMinor ?? product.compareAtPriceMinor ? { compareAtPrice: formatMoney(variant?.compareAtPriceMinor ?? product.compareAtPriceMinor ?? 0, currency) } : {}) },
    availability,
    canAddToCart: availability.state === "available" && priceMinor !== undefined && Boolean(variant),
    selectOption: (optionId, valueId) => onSelectionsChange([...selections.filter((selection) => selection.optionId !== optionId), { optionId, valueId }]),
    setQuantity: (nextQuantity) => onQuantityChange(maxQuantity === undefined ? Math.max(1, nextQuantity) : Math.max(1, Math.min(nextQuantity, maxQuantity))),
    addToCart: () => variant && priceMinor !== undefined && availability.state === "available" ? onAddToCart({ variantId: variant.id, quantity: clampedQuantity, selections, priceMinor }) : Promise.resolve({ ok: false, message: availability.message }),
    relatedProducts,
  };
}
