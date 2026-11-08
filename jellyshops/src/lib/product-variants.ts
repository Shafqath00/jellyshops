import type { ProductOption, ProductVariant } from "./domain";

const MAX_INVENTORY_VARIANTS = 100;

export function getInventoryOptions(options: ProductOption[], inventoryOptionIds: string[]): ProductOption[] {
  const ids = new Set(inventoryOptionIds);
  return options.filter((option) => option.type === "variant" && ids.has(option.id) && option.values.length > 0);
}

function getVariantCombinationCount(options: ProductOption[]): number {
  return options.reduce((count, option) => count * option.values.length, 1);
}

export function createVariantCombinationKey(selections: Record<string, string>): string {
  return Object.entries(selections).sort(([a], [b]) => a.localeCompare(b)).map(([optionId, valueId]) => `${optionId}:${valueId}`).join("|");
}

function getVariantDisplayName(selections: Record<string, string>, options: ProductOption[]): string {
  return options.map((option) => option.values.find((value) => value.id === selections[option.id])?.label).filter((label): label is string => Boolean(label)).join(" / ") || "Standard";
}

function combinations(options: ProductOption[], index = 0, selections: Record<string, string> = {}): Record<string, string>[] {
  if (index === options.length) return [selections];
  return options[index].values.flatMap((value) => combinations(options, index + 1, { ...selections, [options[index].id]: value.id }));
}

export function reconcileProductVariants({ options, inventoryOptionIds, variants, basePriceMinor, defaultStock = 0, standardSku, updateStandard = false }: { options: ProductOption[]; inventoryOptionIds: string[]; variants: ProductVariant[]; basePriceMinor: number; defaultStock?: number; standardSku?: string; updateStandard?: boolean }): { variants: ProductVariant[]; error?: string } {
  const inventoryOptions = getInventoryOptions(options, inventoryOptionIds);
  if (inventoryOptions.length === 0) {
    const standard = variants.find((variant) => Object.keys(variant.options ?? {}).length === 0) ?? variants[0];
    return { variants: [{ id: standard?.id ?? "", name: "Standard", sku: updateStandard ? standardSku ?? standard?.sku ?? "" : standard?.sku ?? "", priceMinor: updateStandard ? basePriceMinor : standard?.priceMinor ?? basePriceMinor, stock: updateStandard ? defaultStock : standard?.stock ?? defaultStock, options: {} }] };
  }
  const count = getVariantCombinationCount(inventoryOptions);
  if (count > MAX_INVENTORY_VARIANTS) return { variants, error: `This setup would create ${count} inventory variants. Reduce the number of inventory options or values.` };
  const existing = new Map(variants.map((variant) => [createVariantCombinationKey(variant.options ?? {}), variant]));
  return { variants: combinations(inventoryOptions).map((selection, index) => {
    const old = existing.get(createVariantCombinationKey(selection));
    return old ? { ...old, name: getVariantDisplayName(selection, inventoryOptions), options: selection } : { id: `variant-${crypto.randomUUID()}`, name: getVariantDisplayName(selection, inventoryOptions), sku: "", priceMinor: basePriceMinor, stock: defaultStock, options: selection };
  }) };
}
