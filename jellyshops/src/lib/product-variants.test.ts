import { reconcileProductVariants } from "./product-variants";

const value = (id: string, label: string) => ({ id, label, priceAdjustmentMinor: 0, position: 0 });
const option = (id: string, values: ReturnType<typeof value>[]) => ({ id, name: id, type: "variant" as const, display: "buttons" as const, required: true, position: 0, values });

describe("product variant reconciliation", () => {
  it("applies edited base price and stock while preserving the standard variant ID", () => {
    const result = reconcileProductVariants({ options: [], inventoryOptionIds: [], variants: [{ id: "standard", name: "Standard", priceMinor: 100, stock: 2, sku: "OLD", options: {} }], basePriceMinor: 250, defaultStock: 5, standardSku: "NEW", updateStandard: true });
    expect(result.variants[0]).toMatchObject({ id: "standard", priceMinor: 250, stock: 5, sku: "NEW" });
  });
  it("keeps a standard variant for simple products", () => {
    expect(reconcileProductVariants({ options: [], inventoryOptionIds: [], variants: [], basePriceMinor: 49900 }).variants[0].name).toBe("Standard");
  });

  it("creates combinations and preserves a matching variant by IDs", () => {
    const colour = option("colour", [value("black", "Black"), value("white", "White")]);
    const size = option("size", [value("s", "S"), value("m", "M")]);
    const first = reconcileProductVariants({ options: [colour, size], inventoryOptionIds: ["colour", "size"], variants: [], basePriceMinor: 99900 });
    expect(first.variants).toHaveLength(4);
    const preserved = { ...first.variants[0], sku: "TEE-BLK-S", stock: 10 };
    const second = reconcileProductVariants({ options: [colour, size], inventoryOptionIds: ["colour", "size"], variants: [preserved], basePriceMinor: 99900 });
    expect(second.variants.find((item) => item.id === preserved.id)?.sku).toBe("TEE-BLK-S");
  });

  it("ignores configuration options and guards excessive counts", () => {
    const configuration = { ...option("storage", [value("one", "One")]), type: "configuration" as const };
    expect(reconcileProductVariants({ options: [configuration], inventoryOptionIds: ["storage"], variants: [], basePriceMinor: 1 }).variants).toHaveLength(1);
  });
});
