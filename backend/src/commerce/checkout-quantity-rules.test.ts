import { describe, expect, it } from "vitest";
import type { CatalogReader } from "../catalog/service.js";
import { validateCart } from "./checkout-cart.js";
import type { CommerceRepository } from "./repository.js";

/** Quantity rules (minimum order, steps, most per order) are enforced at checkout per variant, across bag lines. */
function deps(quantityRule: unknown): Parameters<typeof validateCart>[0] {
  const variants: Record<string, unknown> = {
    blue: { id: "blue", productId: "p1", title: "Blue", sku: "B", priceMinor: 300, options: {}, available: true },
    green: { id: "green", productId: "p1", title: "Green", sku: "G", priceMinor: 300, options: {}, available: true },
  };
  const catalog = {
    getVariant: async (_store: string, id: string) => variants[id] ?? null,
    getProduct: async () => ({ id: "p1", title: "Glass tumbler", options: [], media: [], quantityRule }),
  } as unknown as CatalogReader;
  return { catalog, repository: {} as CommerceRepository };
}
const line = (variantId: string, quantity: number) => ({ variantId, quantity });

describe("checkout quantity rules", () => {
  const rule = { min: 6, step: 6, max: 24 };
  it("accepts quantities that follow the rule, adding up lines of the same variant", async () => {
    const cart = await validateCart(deps(rule), "store", "GBP", [line("blue", 6), line("blue", 6), line("green", 18)], 0);
    expect(cart.subtotalMinor).toBe(30 * 300);
  });
  it("refuses a quantity under the minimum, off the steps or over the most, in plain words", async () => {
    await expect(validateCart(deps(rule), "store", "GBP", [line("blue", 3)], 0)).rejects.toMatchObject({ status: 422, code: "QUANTITY_RULE", message: "Glass tumbler has a minimum order of 6." });
    await expect(validateCart(deps(rule), "store", "GBP", [line("blue", 6), line("blue", 3)], 0)).rejects.toMatchObject({ message: "Glass tumbler is sold in steps of 6." });
    await expect(validateCart(deps(rule), "store", "GBP", [line("green", 30)], 0)).rejects.toMatchObject({ message: "You can buy at most 24 of Glass tumbler." });
  });
  it("leaves products without a rule alone", async () => {
    const cart = await validateCart(deps(null), "store", "GBP", [line("blue", 1)], 0);
    expect(cart.lines[0].quantity).toBe(1);
  });
});
