import type { ProductVariant } from "./domain";

/**
 * One rule for "can a shopper buy this variant, and how many" across the storefront.
 *
 * The catalog sends `stock` (the counted quantity, 0 when stock is not counted) and `available`. A variant whose
 * stock is not tracked, and every digital product, arrives with `available: true` and no stock count: it can be
 * bought in any quantity. Treating `stock <= 0` as "sold out" refused those products on the product page, in the bag
 * and in quick add.
 */
type StockFields = Pick<ProductVariant, "stock" | "available" | "sellable">;

/** Most of one untracked or digital variant a shopper can add at once (the checkout has no stock limit for them). */
export const UNTRACKED_MAX_QUANTITY = 99;

/** True when the variant is sold without counting stock (untracked inventory or a digital product). */
export function isUntrackedStock(variant: StockFields): boolean {
  return variant.sellable !== false && variant.available === true && variant.stock <= 0;
}

/** True when the shopper can buy at least one. */
export function isVariantBuyable(variant: StockFields | undefined | null): boolean {
  if (!variant || variant.sellable === false) return false;
  return variant.stock > 0 || isUntrackedStock(variant);
}

/** The most the shopper can have in the bag: the counted stock, a generous limit when stock is not counted, else 0. */
export function variantMaxQuantity(variant: StockFields | undefined | null): number {
  if (!variant || !isVariantBuyable(variant)) return 0;
  return variant.stock > 0 ? variant.stock : UNTRACKED_MAX_QUANTITY;
}
