import { majorToMinor, type ProductOption, type ProductVariant } from "@/lib/domain";
import { parseWeight, type WeightUnit } from "./shipping";

export type BulkField = "price" | "stock" | "cost" | "weight" | "lowStock" | "availability";
/** `null` applies to every combination; otherwise only those using this value. */
export type BulkScope = { optionId: string; valueId: string } | null;

export function describeScope(scope: BulkScope, options: ProductOption[]): string {
  if (!scope) return "all combinations";
  const option = options.find((item) => item.id === scope.optionId);
  const value = option?.values.find((item) => item.id === scope.valueId);
  return value ? `all ${value.label}` : "all combinations";
}

/**
 * Returns the new variants, or an error message in plain language when the typed value is not usable.
 * `availability` takes "sell" or "stop"; `weight` reads the typed number in `weightUnit`.
 */
export function applyBulk(variants: ProductVariant[], scope: BulkScope, field: BulkField, text: string, weightUnit: WeightUnit = "kg"): { variants: ProductVariant[] } | { error: string } {
  const trimmed = text.trim();
  const change = (update: Partial<ProductVariant>) => ({ variants: variants.map((variant) => matches(variant, scope) ? { ...variant, ...update } : variant) });

  switch (field) {
    case "price": {
      const priceMinor = majorToMinor(trimmed);
      if (!trimmed || !Number.isFinite(priceMinor) || priceMinor < 0) return { error: "Enter a valid price, like 499 or 499.50." };
      return change({ priceMinor });
    }
    case "stock": {
      if (!/^\d{1,9}$/.test(trimmed)) return { error: "Stock must be a whole number, 0 or more." };
      return change({ stock: Number(trimmed) });
    }
    case "cost": {
      const costMinor = majorToMinor(trimmed);
      if (!trimmed || !Number.isFinite(costMinor) || costMinor < 0) return { error: "Enter a valid cost, like 250 or 250.50." };
      return change({ costMinor });
    }
    case "lowStock": {
      if (!/^\d{1,7}$/.test(trimmed)) return { error: "The low stock warning must be a whole number, 0 or more." };
      return change({ lowStockThreshold: Number(trimmed) });
    }
    case "weight": {
      const weight = parseWeight({ weight: trimmed, weightUnit });
      if (weight.error || weight.value === null) return { error: weight.error ?? "Enter a weight, like 250 or 0.5." };
      return change({ weightGrams: weight.value });
    }
    case "availability": {
      if (trimmed !== "sell" && trimmed !== "stop") return { error: "Choose whether to sell or stop selling." };
      return change({ sellable: trimmed === "sell" });
    }
  }
}

function matches(variant: ProductVariant, scope: BulkScope) {
  return !scope || variant.options?.[scope.optionId] === scope.valueId;
}
