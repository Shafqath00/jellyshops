import { describe, expect, it } from "vitest";
import type { CatalogAdminProduct } from "@/features/store-editor/api/types";
import { changePrice, parseAmount, parseCount, parsePercent, planBulkEdit } from "./bulk-edit";

const money = (minor: number) => `£${(minor / 100).toFixed(2)}`;
const product = (id: string, overrides: Partial<CatalogAdminProduct> = {}): CatalogAdminProduct => ({
  id, storeId: "s", handle: id, title: `Product ${id}`, description: "", vendor: "Harbour", productType: "Beds", status: "ACTIVE", media: [], available: true, tags: ["oak"], collectionIds: ["c1"],
  variants: [
    { id: `${id}-v1`, title: "Double", sku: "D", priceMinor: 49999, compareAtPriceMinor: 59900, options: { size: "double" }, trackInventory: true, quantity: 5, available: true },
    { id: `${id}-v2`, title: "King", sku: null, priceMinor: 1000, compareAtPriceMinor: null, options: { size: "king" }, trackInventory: false, quantity: null, available: true },
  ],
  ...overrides,
} as CatalogAdminProduct);

describe("amounts", () => {
  it("reads money, percentages and counts and refuses anything else", () => {
    expect(parseAmount("£1,299.50")).toBe(129950);
    expect(parseAmount("499")).toBe(49900);
    expect(parseAmount("-5")).toBeUndefined();
    expect(parseAmount("4.999")).toBeUndefined();
    expect(parsePercent("12.5%")).toBe(12.5);
    expect(parsePercent("ten")).toBeUndefined();
    expect(parsePercent("1001")).toBeUndefined();
    expect(parseCount("12")).toBe(12);
    expect(parseCount("1.5")).toBeUndefined();
  });

  it("changes a price by amount or per cent, rounds to the penny and never goes below zero", () => {
    expect(changePrice(49999, "set", 45000)).toBe(45000);
    expect(changePrice(49999, "raise", 501)).toBe(50500);
    expect(changePrice(1000, "lower", 2500)).toBe(0);
    expect(changePrice(49999, "raisePercent", 10)).toBe(54999);
    expect(changePrice(49999, "lowerPercent", 12.5)).toBe(43749);
    expect(changePrice(333, "lowerPercent", 50)).toBe(167);
  });
});

describe("planBulkEdit", () => {
  it("previews a price change for every variant and sends each changed variant whole", () => {
    const plan = planBulkEdit([product("a")], { kind: "price", how: "lowerPercent", amount: "10" }, money);
    expect(plan.rows).toEqual([
      { productId: "a", product: "Product a", item: "Double", before: "£499.99", after: "£449.99", changed: true, note: undefined },
      { productId: "a", product: "Product a", item: "King", before: "£10.00", after: "£9.00", changed: true, note: undefined },
    ]);
    expect(plan.patches).toEqual([{ productId: "a", title: "Product a", body: { variants: [
      { id: "a-v1", title: "Double", sku: "D", priceMinor: 44999, compareAtPriceMinor: 59900, trackInventory: true, options: { size: "double" } },
      { id: "a-v2", title: "King", sku: null, priceMinor: 900, compareAtPriceMinor: null, trackInventory: false, options: { size: "king" } },
    ] } }]);
    expect(plan).toMatchObject({ changed: 2, unchanged: 0, label: "Price" });
  });

  it("asks for a usable amount before previewing anything", () => {
    expect(planBulkEdit([product("a")], { kind: "price", how: "set", amount: "cheap" }, money).error).toMatch(/Enter an amount/);
    expect(planBulkEdit([product("a")], { kind: "price", how: "raisePercent", amount: "" }, money).error).toMatch(/percentage/);
    expect(planBulkEdit([product("a")], { kind: "stock", how: "add", amount: "2.5" }, money).error).toMatch(/whole number/);
    expect(planBulkEdit([product("a")], { kind: "tags", how: "add", tags: " , " }, money).error).toMatch(/at least one tag/);
    expect(planBulkEdit([product("a")], { kind: "collection", how: "add", collectionId: "", collectionTitle: "" }, money).error).toMatch(/Choose a collection/);
  });

  it("changes stock only where it is tracked and never below zero", () => {
    const plan = planBulkEdit([product("a")], { kind: "stock", how: "take", amount: "8" }, money);
    expect(plan.rows.map((row) => [row.item, row.before, row.after, row.changed, row.note])).toEqual([
      ["Double", "5", "0", true, "Cannot go below 0"],
      ["King", "Not tracked", "Not tracked", false, "Stock is not tracked for this item"],
    ]);
    expect(plan.patches[0].body).toEqual({ variants: [expect.objectContaining({ id: "a-v1", quantity: 0, trackInventory: true })] });
    expect(planBulkEdit([product("a")], { kind: "stock", how: "set", amount: "5" }, money)).toMatchObject({ changed: 0, patches: [] });
  });

  it("sets and clears the compare-at price", () => {
    expect(planBulkEdit([product("a")], { kind: "compareAt", how: "clear", amount: "" }, money).rows.map((row) => [row.before, row.after, row.changed])).toEqual([["£599.00", "None", true], ["None", "None", false]]);
    expect(planBulkEdit([product("a")], { kind: "compareAt", how: "set", amount: "20" }, money).patches[0].body).toEqual({ variants: [expect.objectContaining({ id: "a-v1", compareAtPriceMinor: 2000 }), expect.objectContaining({ id: "a-v2", compareAtPriceMinor: 2000 })] });
  });

  it("changes product details and leaves out products that already match", () => {
    const products = [product("a"), product("b", { status: "DRAFT", vendor: null, tags: [], collectionIds: [] })];
    expect(planBulkEdit(products, { kind: "status", status: "ACTIVE" }, money)).toMatchObject({ changed: 1, unchanged: 1, patches: [{ productId: "b", body: { status: "ACTIVE" } }] });
    expect(planBulkEdit(products, { kind: "vendor", value: " Harbour " }, money).patches).toEqual([{ productId: "b", title: "Product b", body: { vendor: "Harbour" } }]);
    expect(planBulkEdit(products, { kind: "productType", value: "" }, money).patches.map((patch) => patch.body)).toEqual([{ productType: null }, { productType: null }]);
    expect(planBulkEdit(products, { kind: "collection", how: "add", collectionId: "c1", collectionTitle: "Bedroom" }, money).patches).toEqual([{ productId: "b", title: "Product b", body: { collectionIds: ["c1"] } }]);
    expect(planBulkEdit(products, { kind: "collection", how: "remove", collectionId: "c1", collectionTitle: "Bedroom" }, money).patches).toEqual([{ productId: "a", title: "Product a", body: { collectionIds: [] } }]);
  });

  it("adds and removes tags without regard to case and keeps to 50 tags", () => {
    const products = [product("a", { tags: ["Oak", "bedroom"] })];
    expect(planBulkEdit(products, { kind: "tags", how: "add", tags: "oak, Sale, sale" }, money).patches[0].body).toEqual({ tags: ["Oak", "bedroom", "Sale"] });
    expect(planBulkEdit(products, { kind: "tags", how: "remove", tags: "OAK" }, money).patches[0].body).toEqual({ tags: ["bedroom"] });
    const full = [product("a", { tags: Array.from({ length: 50 }, (_, index) => `t${index}`) })];
    expect(planBulkEdit(full, { kind: "tags", how: "add", tags: "one-more" }, money)).toMatchObject({ changed: 0, patches: [], rows: [expect.objectContaining({ note: "Would have more than 50 tags" })] });
  });
});
