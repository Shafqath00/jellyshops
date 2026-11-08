import type { ProductOption, ProductVariant } from "../domain";
import { reconcileProductVariants } from "../product-variants";
import { dropHiddenSelections, findConditionProblems, getVisibleOptions, validateProductDraft, validateProductSelections } from "./index";

const values = (...labels: string[]) => labels.map((label, position) => ({ id: label.toLowerCase().replace(/\W+/g, "-"), label, priceAdjustmentMinor: 0, position }));
const option = (id: string, type: ProductOption["type"], labels: string[], extra: Partial<ProductOption> = {}): ProductOption => ({ id, name: id, type, display: "buttons", required: false, position: 0, values: values(...labels), ...extra });
const variant = (extra: Partial<ProductVariant> = {}): ProductVariant => ({ id: "v1", name: "Standard", sku: "", priceMinor: 1000, stock: 1, options: {}, ...extra });

// Bed: size is stock-tracked; firmness and headboard only change the price.
const bed: ProductOption[] = [
  option("size", "variant", ["Single", "King"], { required: true }),
  option("firmness", "configuration", ["Soft", "Firm"], { required: true }),
  option("headboard", "addon", ["Padded", "Wood"], { multiple: true, maxSelect: 1 }),
  option("king-only", "configuration", ["Extra long"], { visibleWhen: { optionId: "size", valueIds: ["king"] }, required: true }),
];

describe("conditions", () => {
  it("shows a dependent choice only when its controlling value is selected", () => {
    expect(getVisibleOptions(bed, []).map((o) => o.id)).not.toContain("king-only");
    expect(getVisibleOptions(bed, [{ optionId: "size", valueId: "king" }]).map((o) => o.id)).toContain("king-only");
    expect(getVisibleOptions(bed, [{ optionId: "size", valueId: "single" }]).map((o) => o.id)).not.toContain("king-only");
  });
  it("hides a choice when its controller is itself hidden", () => {
    const chain = [...bed, option("extra", "configuration", ["Yes"], { visibleWhen: { optionId: "king-only", valueIds: ["extra-long"] } })];
    const selections = [{ optionId: "king-only", valueId: "extra-long" }];
    expect(getVisibleOptions(chain, selections).map((o) => o.id)).not.toContain("extra");
    expect(getVisibleOptions(chain, [{ optionId: "size", valueId: "king" }, ...selections]).map((o) => o.id)).toContain("extra");
  });
  it("drops selections for hidden choices", () => {
    const result = dropHiddenSelections(bed, [{ optionId: "size", valueId: "single" }, { optionId: "king-only", valueId: "extra-long" }]);
    expect(result).toEqual([{ optionId: "size", valueId: "single" }]);
  });
  it("reports self references, missing targets and cycles", () => {
    const a = option("a", "configuration", ["x"], { visibleWhen: { optionId: "b", valueIds: ["y"] } });
    const b = option("b", "configuration", ["y"], { visibleWhen: { optionId: "a", valueIds: ["x"] } });
    expect(findConditionProblems([a, b]).map((p) => p.code)).toEqual(["cycle", "cycle"]);
    expect(findConditionProblems([option("s", "configuration", ["x"], { visibleWhen: { optionId: "s", valueIds: ["x"] } })])[0].code).toBe("self_reference");
    expect(findConditionProblems([option("m", "configuration", ["x"], { visibleWhen: { optionId: "gone", valueIds: ["x"] } })])[0].code).toBe("unknown_option");
    expect(findConditionProblems([option("c", "configuration", ["x"]), option("v", "configuration", ["x"], { visibleWhen: { optionId: "c", valueIds: ["nope"] } })])[0].code).toBe("unknown_value");
    expect(findConditionProblems(bed)).toEqual([]);
  });
});

describe("validateProductSelections", () => {
  it("requires visible required choices and ignores hidden ones", () => {
    const codes = validateProductSelections(bed, [{ optionId: "size", valueId: "single" }]).map((p) => `${p.optionId}:${p.code}`);
    expect(codes).toEqual(["firmness:required"]);
    expect(validateProductSelections(bed, [{ optionId: "size", valueId: "king" }, { optionId: "firmness", valueId: "soft" }]).map((p) => p.optionId)).toEqual(["king-only"]);
  });
  it("accepts a complete valid selection", () => {
    expect(validateProductSelections(bed, [{ optionId: "size", valueId: "king" }, { optionId: "firmness", valueId: "firm" }, { optionId: "king-only", valueId: "extra-long" }, { optionId: "headboard", valueId: "wood" }])).toEqual([]);
  });
  it("rejects selections for hidden, unknown and single-only choices", () => {
    const hidden = validateProductSelections(bed, [{ optionId: "size", valueId: "single" }, { optionId: "firmness", valueId: "soft" }, { optionId: "king-only", valueId: "extra-long" }]);
    expect(hidden.map((p) => p.code)).toEqual(["hidden_option"]);
    expect(validateProductSelections(bed, [{ optionId: "ghost", valueId: "x" }])[0].code).toBe("unknown_option");
    expect(validateProductSelections(bed, [{ optionId: "firmness", valueId: "ghost" }])[0].code).toBe("unknown_value");
    const twice = validateProductSelections(bed, [{ optionId: "size", valueId: "single" }, { optionId: "size", valueId: "king" }, { optionId: "firmness", valueId: "soft" }]);
    expect(twice.map((p) => p.code)).toContain("single_only");
  });
  it("enforces multi-select limits and duplicates", () => {
    const base = [{ optionId: "size", valueId: "single" }, { optionId: "firmness", valueId: "soft" }];
    expect(validateProductSelections(bed, [...base, { optionId: "headboard", valueId: "wood" }, { optionId: "headboard", valueId: "padded" }]).map((p) => p.code)).toEqual(["too_many"]);
    expect(validateProductSelections(bed, [...base, { optionId: "headboard", valueId: "wood" }, { optionId: "headboard", valueId: "wood" }]).map((p) => p.code)).toContain("duplicate_value");
  });
  it("never lets a variant axis take several values even if flagged multiple", () => {
    const tee = [option("size", "variant", ["S", "M"], { multiple: true })];
    expect(validateProductSelections(tee, [{ optionId: "size", valueId: "s" }, { optionId: "size", valueId: "m" }]).map((p) => p.code)).toEqual(["single_only"]);
  });
  it("honours minSelect", () => {
    const toppings = [option("t", "addon", ["a", "b", "c"], { multiple: true, minSelect: 2 })];
    expect(validateProductSelections(toppings, [{ optionId: "t", valueId: "a" }])[0].code).toBe("too_few");
    expect(validateProductSelections(toppings, [])).toEqual([]);
  });
});

describe("validateProductDraft", () => {
  const tee = [option("size", "variant", ["S", "M", "L"], { required: true }), option("colour", "variant", ["Black", "White"], { required: true })];
  const build = (options: ProductOption[], inventoryOptionIds: string[]) => {
    const { variants } = reconcileProductVariants({ options, inventoryOptionIds, variants: [], basePriceMinor: 1999 });
    return { title: "Tee", options, inventoryOptionIds, variants };
  };

  it("passes a T-shirt with six generated variants (warns about missing SKUs)", () => {
    const draft = build(tee, ["size", "colour"]);
    expect(draft.variants).toHaveLength(6);
    const result = validateProductDraft(draft);
    expect(result.errors).toEqual([]);
    expect(result.warnings.every((w) => w.code === "variant_sku_missing")).toBe(true);
  });
  it("passes a simple product with no choices", () => {
    expect(validateProductDraft({ title: "Mug", options: [], inventoryOptionIds: [], variants: [variant()], mediaCount: 1 })).toMatchObject({ errors: [], warnings: [] });
  });
  it("blocks missing title, price and empty choices", () => {
    const codes = validateProductDraft({ title: " ", options: [option("size", "variant", [])], inventoryOptionIds: [], variants: [variant({ priceMinor: -1 })] }).errors.map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(["title_required", "option_values_required", "variant_price"]));
  });
  it("blocks duplicate names, values and SKUs", () => {
    const options = [option("Size", "configuration", ["S", "s"]), { ...option("size2", "configuration", ["A"]), name: "size" }];
    const codes = validateProductDraft({ title: "x", options, inventoryOptionIds: [], variants: [variant({ sku: "A" }), variant({ id: "v2", sku: "a" })] }).errors.map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(["option_name_duplicate", "value_label_duplicate", "variant_sku_duplicate"]));
  });
  it("enforces the axis and variant caps", () => {
    const four = ["a", "b", "c", "d"].map((id) => option(id, "variant", ["1", "2"]));
    expect(validateProductDraft({ ...build(four.slice(0, 3), ["a", "b", "c"]), options: four, inventoryOptionIds: ["a", "b", "c", "d"] }).errors.map((e) => e.code)).toContain("too_many_axes");
    const big = [option("a", "variant", Array.from({ length: 11 }, (_, i) => `a${i}`)), option("b", "variant", Array.from({ length: 10 }, (_, i) => `b${i}`))];
    expect(validateProductDraft({ title: "x", options: big, inventoryOptionIds: ["a", "b"], variants: [variant()] }).errors.map((e) => e.code)).toContain("too_many_variants");
  });
  it("flags inventory ids pointing at missing or non-variant choices", () => {
    const codes = validateProductDraft({ title: "x", options: [option("c", "configuration", ["x"])], inventoryOptionIds: ["c", "gone"], variants: [variant()] }).errors.map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(["inventory_option_not_variant", "inventory_option_missing"]));
  });
  it("rejects multi-select variant axes and bad ranges, and surfaces condition problems", () => {
    const options = [option("v", "variant", ["a"], { multiple: true }), option("r", "addon", ["a", "b"], { multiple: true, minSelect: 2, maxSelect: 1 }), option("c", "configuration", ["a"], { visibleWhen: { optionId: "c", valueIds: ["a"] } })];
    const codes = validateProductDraft({ title: "x", options, inventoryOptionIds: ["v"], variants: [variant()] }).errors.map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(["variant_multiple", "select_range", "condition_self_reference"]));
  });
  it("only warns about photos", () => {
    const result = validateProductDraft({ title: "x", options: [], inventoryOptionIds: [], variants: [variant()], mediaCount: 0 });
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((w) => w.code)).toEqual(["no_photos"]);
  });
});
