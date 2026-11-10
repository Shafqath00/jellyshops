import { allowedQuantity, readQuantityRule } from "@jelly/storefront-schema";
import type { Product, ProductVariant } from "@/lib/domain";
import { variantMaxQuantity } from "@/lib/variant-stock";

/**
 * The quantity a bag line moves to when the shopper changes it, honouring the product's quantity rules: the + and −
 * buttons (one up or down) move a whole step (6 → 12), typed numbers snap to the nearest allowed quantity, never
 * under the minimum (use Remove for that) or over the stock and the most per order. 0 removes the line.
 */
export function nextCartQuantity(product: Pick<Product, "quantityRule">, variant: ProductVariant, current: number, wanted: number): number {
  if (wanted <= 0) return 0;
  const rule = readQuantityRule(product.quantityRule);
  const limit = variantMaxQuantity(variant);
  const target = wanted === current + 1 ? current + rule.step : wanted === current - 1 ? current - rule.step : wanted;
  return allowedQuantity(rule, target, limit) ?? current;
}

/** Whether + can add another step to the line. */
export function canIncreaseCartQuantity(product: Pick<Product, "quantityRule">, variant: ProductVariant, current: number): boolean {
  return nextCartQuantity(product, variant, current, current + 1) > current;
}

/** Whether − can take a step off the line (at the minimum only Remove takes it out). */
export function canDecreaseCartQuantity(product: Pick<Product, "quantityRule">, variant: ProductVariant, current: number): boolean {
  return current > 1 && nextCartQuantity(product, variant, current, current - 1) < current;
}
