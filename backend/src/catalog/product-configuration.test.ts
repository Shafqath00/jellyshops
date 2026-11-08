import { describe, expect, it, vi } from "vitest";
import { assertValidProductConfiguration } from "./product-configuration.js";
import { CatalogService } from "./service.js";
import type { CatalogRepository, CatalogWriter } from "./repository.js";

const value = (id: string, label: string) => ({ id, label, priceAdjustmentMinor: 0, position: 0 });
const option = (id: string, type: string, labels: string[], extra: Record<string, unknown> = {}) => ({ id, name: id, type, required: type === "variant", position: 0, values: labels.map((label) => value(`${id}-${label}`, label)), ...extra });
const variant = (title: string, options: Record<string, string>) => ({ title, priceMinor: 100, options });
const rejects = (fn: () => void) => { try { fn(); } catch (error) { return error as { status: number; code: string; message: string; issues?: unknown[] }; } throw new Error("expected a rejection"); };

describe("assertValidProductConfiguration", () => {
  it("allows products without choices and updates that do not touch them", () => {
    expect(() => assertValidProductConfiguration({})).not.toThrow();
    expect(() => assertValidProductConfiguration({ options: [], variants: [{ title: "Standard", options: {} }] })).not.toThrow();
  });

  it("accepts a T-shirt: two stock-tracked choices with every combination", () => {
    const size = option("size", "variant", ["S", "M"]);
    const colour = option("colour", "variant", ["Black"]);
    const variants = ["S", "M"].map((s) => variant(s, { size: `size-${s}`, colour: "colour-Black" }));
    expect(() => assertValidProductConfiguration({ options: [size, colour], inventoryOptionIds: ["size", "colour"], variants })).not.toThrow();
  });

  it("rejects the 100-combination and 3-choice limits with plain-language errors", () => {
    const many = (id: string, n: number) => option(id, "variant", Array.from({ length: n }, (_, i) => `v${i}`));
    const tooMany = rejects(() => assertValidProductConfiguration({ options: [many("a", 11), many("b", 10)], inventoryOptionIds: ["a", "b"] }));
    expect(tooMany).toMatchObject({ status: 422, code: "PRODUCT_CONFIGURATION_INVALID" });
    expect(tooMany.message).toMatch(/110 variants/);
    const four = ["a", "b", "c", "d"].map((id) => option(id, "variant", ["x", "y"]));
    expect(rejects(() => assertValidProductConfiguration({ options: four, inventoryOptionIds: ["a", "b", "c", "d"] })).message).toMatch(/at most 3/);
  });

  it("rejects duplicate names and values, empty choices, bad conditions and multi-pick stock choices", () => {
    expect(rejects(() => assertValidProductConfiguration({ options: [{ ...option("a", "configuration", ["x"]), name: "Size" }, { ...option("b", "configuration", ["y"]), name: "size" }] })).message).toMatch(/two choices called/);
    expect(rejects(() => assertValidProductConfiguration({ options: [option("a", "configuration", ["x", "X"])] })).message).toMatch(/twice/);
    expect(rejects(() => assertValidProductConfiguration({ options: [option("a", "configuration", [])] })).message).toMatch(/at least one value/);
    expect(rejects(() => assertValidProductConfiguration({ options: [option("a", "configuration", ["x"], { visibleWhen: { optionId: "ghost", valueIds: ["q"] } })] })).message).toMatch(/no longer exists/);
    expect(rejects(() => assertValidProductConfiguration({ options: [option("a", "variant", ["x"], { multiple: true })], inventoryOptionIds: ["a"] })).message).toMatch(/only pick one/);
  });

  it("rejects malformed options and negative price changes", () => {
    expect(rejects(() => assertValidProductConfiguration({ options: ["nope"] })).code).toBe("PRODUCT_CONFIGURATION_INVALID");
    const priced = option("a", "configuration", ["x"]);
    priced.values[0].priceAdjustmentMinor = -5;
    expect(rejects(() => assertValidProductConfiguration({ options: [priced] })).message).toMatch(/invalid price change/);
  });

  it("rejects variants that do not match the choices, or repeat a combination", () => {
    const size = option("size", "variant", ["S", "M"]);
    const base = { options: [size], inventoryOptionIds: ["size"] };
    expect(rejects(() => assertValidProductConfiguration({ ...base, variants: [variant("S", { size: "size-S" }), variant("Bad", { size: "nope" })] })).message).toMatch(/does not match your choices/);
    expect(rejects(() => assertValidProductConfiguration({ ...base, variants: [variant("S", {})] })).message).toMatch(/does not match/);
    expect(rejects(() => assertValidProductConfiguration({ ...base, variants: [variant("S", { size: "size-S" }), variant("S again", { size: "size-S" })] })).message).toMatch(/more than once/);
  });

  it("validates an update against the stored choices when it only sends variants", () => {
    const current = { options: [option("size", "variant", ["S"])], inventoryOptionIds: ["size"] };
    expect(() => assertValidProductConfiguration({ variants: [variant("S", { size: "size-S" })] }, current)).not.toThrow();
    expect(rejects(() => assertValidProductConfiguration({ variants: [variant("X", { size: "size-X" })] }, current)).code).toBe("PRODUCT_CONFIGURATION_INVALID");
  });
});

describe("CatalogService product writes", () => {
  const stored = { id: "p1", options: [option("size", "variant", ["S"])], inventoryOptionIds: ["size"] };
  function service() {
    const writer = { createProduct: vi.fn(async () => ({ id: "new" })), updateProduct: vi.fn(async () => ({ id: "p1" })) } as unknown as CatalogWriter;
    const repository = { getProduct: vi.fn(async () => stored) } as unknown as CatalogRepository;
    return { writer, repository, catalog: new CatalogService(repository, writer) };
  }
  const valid = { handle: "t", title: "T", variants: [{ title: "S", priceMinor: 1, options: { size: "size-S" } }] };

  it("blocks invalid configurations before anything is written", async () => {
    const { catalog, writer } = service();
    await expect(catalog.createProduct("s", { ...valid, options: [option("size", "variant", ["S"])], inventoryOptionIds: ["size"], variants: [{ title: "Wrong", priceMinor: 1, options: { size: "x" } }] })).rejects.toMatchObject({ status: 422 });
    expect(writer.createProduct).not.toHaveBeenCalled();
    await expect(catalog.updateProduct("s", "p1", { variants: [{ title: "Wrong", priceMinor: 1, options: { size: "x" } }] })).rejects.toMatchObject({ status: 422 });
    expect(writer.updateProduct).not.toHaveBeenCalled();
  });

  it("writes valid products, and does not even load the product when an update leaves choices alone", async () => {
    const { catalog, writer, repository } = service();
    await catalog.createProduct("s", { ...valid, options: [option("size", "variant", ["S"])], inventoryOptionIds: ["size"] });
    expect(writer.createProduct).toHaveBeenCalled();
    await catalog.updateProduct("s", "p1", { title: "Renamed" });
    expect(repository.getProduct).not.toHaveBeenCalled();
    await catalog.updateProduct("s", "p1", { variants: [{ title: "S", priceMinor: 2, options: { size: "size-S" } }] });
    expect(writer.updateProduct).toHaveBeenCalledTimes(2);
  });
});
