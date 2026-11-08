import type { ConfiguredOptionSelection, Product, ProductOption, ProductVariant } from "./domain";
import { createVariantCombinationKey, getInventoryOptions } from "./product-variants";

export function resolveProductVariant(product: Product, selections: ConfiguredOptionSelection[]): ProductVariant | undefined {
  const inventory = getInventoryOptions(product.options ?? [], product.inventoryOptionIds ?? []);
  if (inventory.length === 0) return product.variants[0];
  const selected = Object.fromEntries(selections.filter((selection) => inventory.some((option) => option.id === selection.optionId)).map((selection) => [selection.optionId, selection.valueId]));
  if (Object.keys(selected).length !== inventory.length) return undefined;
  const key = createVariantCombinationKey(selected);
  return product.variants.find((variant) => createVariantCombinationKey(variant.options ?? {}) === key);
}

export function getConfiguredPriceMinor(variant: ProductVariant | undefined, options: ProductOption[], selections: ConfiguredOptionSelection[]): number | undefined {
  if (!variant) return undefined;
  return variant.priceMinor + selections.reduce((total, selection) => total + (options.find((option) => option.id === selection.optionId)?.values.find((value) => value.id === selection.valueId)?.priceAdjustmentMinor ?? 0), 0);
}

export function createCartConfigurationKey(variantId: string, selections: ConfiguredOptionSelection[] = []): string {
  return `${variantId}|${selections.map((selection) => `${selection.optionId}:${selection.valueId}`).sort().join("|")}`;
}
