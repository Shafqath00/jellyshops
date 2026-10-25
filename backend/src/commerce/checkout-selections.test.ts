import { describe, expect, it } from "vitest";
import type { CatalogReader } from "../catalog/service.js";
import { validateCart } from "./checkout-cart.js";
import type { CommerceRepository } from "./repository.js";

const value = (id: string, label: string, priceAdjustmentMinor = 0) => ({ id, label, priceAdjustmentMinor, position: 0 });
const options = [
  { id: "size", name: "Size", type: "variant", required: true, position: 0, values: [value("s", "S"), value("k", "King")] },
  { id: "firmness", name: "Firmness", type: "configuration", required: true, position: 1, values: [value("soft", "Soft"), value("firm", "Firm", 2000)] },
  { id: "extras", name: "Extras", type: "addon", required: false, multiple: true, maxSelect: 2, position: 2, values: [value("head", "Headboard", 5000), value("tables", "Tables", 3000), value("rug", "Rug", 1000)] },
  { id: "long", name: "Extra long", type: "configuration", required: true, position: 3, visibleWhen: { optionId: "size", valueIds: ["k"] }, values: [value("yes", "Yes", 100)] },
];

function deps(): Parameters<typeof validateCart>[0] {
  const variants: Record<string, unknown> = {
    small: { id: "small", productId: "p1", title: "S", sku: "S1", priceMinor: 10000, options: { size: "s" }, available: true },
    king: { id: "king", productId: "p1", title: "King", sku: "K1", priceMinor: 20000, options: { size: "k" }, available: true },
  };
  const catalog = {
    getVariant: async (_store: string, id: string) => variants[id] ?? null,
    getProduct: async () => ({ id: "p1", title: "Bed", options, media: [] }),
  } as unknown as CatalogReader;
  return { catalog, repository: {} as CommerceRepository };
}
const sel = (optionId: string, valueId: string) => ({ optionId, valueId });
const run = (variantId: string, configurationSelections: Array<{ optionId: string; valueId: string }>) =>
  validateCart(deps(), "store", "INR", [{ variantId, quantity: 2, configurationSelections }], 0);

describe("checkout product selections", () => {
  it("prices the variant plus every selected extra, including several from one multi-pick choice", async () => {
    const cart = await run("small", [sel("size", "s"), sel("firmness", "firm"), sel("extras", "head"), sel("extras", "tables")]);
    expect(cart.lines[0].unitPriceMinor).toBe(10000 + 2000 + 5000 + 3000);
    expect(cart.subtotalMinor).toBe(cart.lines[0].unitPriceMinor * 2);
    expect(cart.lines[0].configurationSnapshot.map((s) => s.valueLabel)).toEqual(["S", "Firm", "Headboard", "Tables"]);
  });

  it("builds the same line key whatever order extras were picked in", async () => {
    const a = await run("small", [sel("size", "s"), sel("firmness", "soft"), sel("extras", "head"), sel("extras", "rug")]);
    const b = await run("small", [sel("extras", "rug"), sel("firmness", "soft"), sel("extras", "head"), sel("size", "s")]);
    expect(a.lines[0].configurationKey).toBe(b.lines[0].configurationKey);
    expect(a.cartHash).toBe(b.cartHash);
  });

  it("rejects a missing required choice with a plain message", async () => {
    await expect(run("small", [sel("size", "s")])).rejects.toMatchObject({ status: 422, code: "CHECKOUT_INPUT_INVALID", message: "Please choose a Firmness." });
  });

  it("rejects more extras than the maximum, repeated values, and several picks from a single-pick choice", async () => {
    const base = [sel("size", "s"), sel("firmness", "soft")];
    await expect(run("small", [...base, sel("extras", "head"), sel("extras", "tables"), sel("extras", "rug")])).rejects.toMatchObject({ message: "Choose at most 2 for Extras." });
    await expect(run("small", [...base, sel("extras", "head"), sel("extras", "head")])).rejects.toMatchObject({ message: "Extras was chosen twice." });
    await expect(run("small", [sel("size", "s"), sel("firmness", "soft"), sel("firmness", "firm")])).rejects.toMatchObject({ message: "Choose only one Firmness." });
  });

  it("requires a conditional choice only when its condition is met, and refuses it otherwise", async () => {
    const small = [sel("size", "s"), sel("firmness", "soft")];
    expect((await run("small", small)).lines).toHaveLength(1);
    await expect(run("small", [...small, sel("long", "yes")])).rejects.toMatchObject({ message: "Extra long is not available for this selection." });
    const king = [sel("size", "k"), sel("firmness", "soft")];
    await expect(run("king", king)).rejects.toMatchObject({ message: "Please choose a Extra long." });
    expect((await run("king", [...king, sel("long", "yes")])).lines[0].unitPriceMinor).toBe(20000 + 100);
  });

  it("rejects unknown values and selections that contradict the chosen variant", async () => {
    await expect(run("small", [sel("size", "s"), sel("firmness", "ghost")])).rejects.toMatchObject({ code: "CHECKOUT_INPUT_INVALID" });
    await expect(run("small", [sel("size", "k"), sel("firmness", "soft"), sel("long", "yes")])).rejects.toMatchObject({ message: "Configuration does not match the selected variant." });
  });

  it("still accepts products saved before choices had flags (no multiple, no required, no values array)", async () => {
    const legacy = { catalog: { getVariant: async () => ({ id: "v", productId: "p", title: "Std", sku: null, priceMinor: 500, options: {}, available: true }), getProduct: async () => ({ id: "p", title: "Mug", media: [], options: [{ id: "o", name: "Finish" }] }) } as unknown as CatalogReader, repository: {} as CommerceRepository };
    const cart = await validateCart(legacy, "store", "INR", [{ variantId: "v", quantity: 1 }], 0);
    expect(cart.lines[0].unitPriceMinor).toBe(500);
  });
});
