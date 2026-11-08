import type { CartItem, Product } from "@/lib/domain";

/** The shopper's text for a cart line as "Engraving: SAM", in the order of the product's fields. */
export function personalisationLabels(product: Pick<Product, "personalisation">, item: Pick<CartItem, "personalisation">): string[] {
  const entries = item.personalisation ?? [];
  if (!entries.length) return [];
  const fields = product.personalisation ?? [];
  return entries.map((entry) => `${fields.find((field) => field.id === entry.fieldId)?.label ?? "Personalisation"}: ${entry.value}`);
}

/** A key for a cart line in lists, unique per variant, choices and text. */
export function cartLineKey(variantId: string, item: Pick<CartItem, "configurationSelections" | "personalisation">): string {
  return `${variantId}-${JSON.stringify(item.configurationSelections ?? [])}-${JSON.stringify(item.personalisation ?? [])}`;
}
