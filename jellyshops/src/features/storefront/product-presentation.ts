import type { ProductPresentationContext } from "@jelly/storefront-renderer";
import type { ConfiguredOptionSelection, Currency, Product } from "@/lib/domain";
import { formatMoney } from "@/lib/domain";
import { getConfiguredPriceMinor, resolveProductVariant } from "@/lib/product-configuration";

export function createProductPresentationContext({ product, currency, selections, quantity, onSelectionsChange, onQuantityChange, onAddToCart, relatedProducts = [] }: {
  product: Product;
  currency: Currency;
  selections: ConfiguredOptionSelection[];
  quantity: number;
  onSelectionsChange(selections: ConfiguredOptionSelection[]): void;
  onQuantityChange(quantity: number): void;
  onAddToCart(input: { variantId: string; quantity: number; selections: ConfiguredOptionSelection[]; priceMinor: number }): Promise<{ ok: boolean; message?: string }>;
  relatedProducts?: ProductPresentationContext["relatedProducts"];
}): ProductPresentationContext {
  const options = [...(product.options ?? [])].sort((left, right) => left.position - right.position);
  const selectedValue = (optionId: string) => selections.find((selection) => selection.optionId === optionId)?.valueId;
  const requiredMissing = options.some((option) => option.required && !selectedValue(option.id));
  const variant = resolveProductVariant(product, selections);
  const priceMinor = getConfiguredPriceMinor(variant, options, selections);
  const maxQuantity = !requiredMissing && variant && variant.stock > 0 ? variant.stock : 0;
  const clampedQuantity = Math.max(1, Math.min(quantity, Math.max(1, maxQuantity)));
  const availability = requiredMissing ? { state: "selection-required" as const, message: "Choose the required options", maxQuantity: 0 }
    : !variant ? { state: "unavailable" as const, message: "This combination is unavailable", maxQuantity: 0 }
      : variant.stock <= 0 ? { state: "out-of-stock" as const, message: "Out of stock", maxQuantity: 0 }
        : { state: "available" as const, message: `${variant.stock} available`, maxQuantity: variant.stock };

  return {
    product: { id: product.id, title: product.name, description: product.description, imageUrl: product.imageUrl, sku: variant?.sku || undefined, options: options.map((option) => ({ id: option.id, name: option.name, required: option.required, values: option.values.map((value) => ({ id: value.id, label: value.label, selected: selectedValue(option.id) === value.id, available: true })) })) },
    selection: selections,
    quantity: clampedQuantity,
    pricing: { price: formatMoney(priceMinor ?? 0, currency) },
    availability,
    canAddToCart: availability.state === "available" && priceMinor !== undefined && Boolean(variant),
    selectOption: (optionId, valueId) => onSelectionsChange([...selections.filter((selection) => selection.optionId !== optionId), { optionId, valueId }]),
    setQuantity: (nextQuantity) => onQuantityChange(Math.max(1, Math.min(nextQuantity, Math.max(1, maxQuantity)))),
    addToCart: () => variant && priceMinor !== undefined && availability.state === "available" ? onAddToCart({ variantId: variant.id, quantity: clampedQuantity, selections, priceMinor }) : Promise.resolve({ ok: false, message: availability.message }),
    relatedProducts,
  };
}
