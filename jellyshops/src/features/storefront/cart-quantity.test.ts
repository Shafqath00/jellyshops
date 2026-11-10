import { describe, expect, it } from "vitest";
import type { ProductVariant } from "@/lib/domain";
import { canDecreaseCartQuantity, canIncreaseCartQuantity, nextCartQuantity } from "./cart-quantity";

const variant = (stock: number) => ({ id: "v1", name: "Standard", sku: "", priceMinor: 500, stock, available: stock > 0, sellable: true }) as unknown as ProductVariant;
const sixes = { quantityRule: { min: 6, step: 6, max: 24 } };
const plain = { quantityRule: null };

describe("bag quantities with quantity rules", () => {
  it("moves a whole step with + and −, and never under the minimum", () => {
    expect(nextCartQuantity(sixes, variant(100), 6, 7)).toBe(12);
    expect(nextCartQuantity(sixes, variant(100), 12, 11)).toBe(6);
    expect(nextCartQuantity(sixes, variant(100), 6, 5)).toBe(6);
    expect(nextCartQuantity(sixes, variant(100), 6, 0)).toBe(0);
  });
  it("snaps typed numbers and stops at the most per order and the stock", () => {
    expect(nextCartQuantity(sixes, variant(100), 6, 15)).toBe(18);
    expect(nextCartQuantity(sixes, variant(100), 24, 25)).toBe(24);
    expect(nextCartQuantity(sixes, variant(14), 12, 13)).toBe(12);
    expect(canIncreaseCartQuantity(sixes, variant(100), 24)).toBe(false);
    expect(canIncreaseCartQuantity(sixes, variant(100), 18)).toBe(true);
    expect(canDecreaseCartQuantity(sixes, variant(100), 6)).toBe(false);
  });
  it("leaves products without rules as they were", () => {
    expect(nextCartQuantity(plain, variant(100), 1, 2)).toBe(2);
    expect(nextCartQuantity(plain, variant(3), 3, 4)).toBe(3);
    expect(canDecreaseCartQuantity(plain, variant(3), 2)).toBe(true);
  });
});
