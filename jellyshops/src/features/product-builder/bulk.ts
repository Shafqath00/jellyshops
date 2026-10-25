import { majorToMinor, type ProductOption, type ProductVariant } from "@/lib/domain";

export type BulkField = "price" | "stock";
/** `null` applies to every combination; otherwise only those using this value. */
export type BulkScope = { optionId: string; valueId: string } | null;

export function describeScope(scope: BulkScope, options: ProductOption[]): string {
  if (!scope) return "all combinations";
  const option = options.find((item) => item.id === scope.optionId);
  const value = option?.values.find((item) => item.id === scope.valueId);
  return value ? `all ${value.label}` : "all combinations";
}

/** Returns the new variants, or an error message in plain language when the typed value is not usable. */
export function applyBulk(variants: ProductVariant[], scope: BulkScope, field: BulkField, text: string): { variants: ProductVariant[] } | { error: string } {
  const trimmed = text.trim();
  if (field === "price") {
    const priceMinor = majorToMinor(trimmed);
    if (!trimmed || !Number.isFinite(priceMinor) || priceMinor < 0) return { error: "Enter a valid price, like 499 or 499.50." };
    return { variants: variants.map((variant) => matches(variant, scope) ? { ...variant, priceMinor } : variant) };
  }
  if (!/^\d{1,9}$/.test(trimmed)) return { error: "Stock must be a whole number, 0 or more." };
  const stock = Number(trimmed);
  return { variants: variants.map((variant) => matches(variant, scope) ? { ...variant, stock } : variant) };
}

function matches(variant: ProductVariant, scope: BulkScope) {
  return !scope || variant.options?.[scope.optionId] === scope.valueId;
}
