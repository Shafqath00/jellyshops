import { describe, expect, it } from "vitest";
import { getSectionDefinition, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import { expandRecipe, recipeSchema, registerRecipes, type SectionRecipe } from "./recipes";

const recipe = (elements: unknown[], settings: unknown[] = []) => ({
  type: "acme-shop/picks", name: "Picks", supportedPages: ["home"],
  settings: [
    { id: "count", type: "number", label: "How many", default: 3, min: 1, max: 12 },
    { id: "range", type: "collection", label: "Collection" },
    { id: "title", type: "text", label: "Title", default: "Our picks" },
    ...settings,
  ],
  elements,
});
const issues = (value: unknown) => { const result = recipeSchema.safeParse(value); return result.success ? "" : result.error.issues.map((issue) => issue.message).join("\n"); };

describe("recipe spacer and product list", () => {
  it("accepts a spacer and a product list bound to number and collection settings", () => {
    expect(issues(recipe([{ kind: "heading", text: "{title}" }, { kind: "spacer", size: 24 }, { kind: "products", limit: "{count}", collection: "{range}", columns: 3 }]))).toBe("");
    expect(issues(recipe([{ kind: "products" }]))).toBe("");
  });

  it.each([
    ["a spacer out of range", [{ kind: "spacer", size: 400 }], /less than or equal to 160|too_big|160/],
    ["a product count bound to a text setting", [{ kind: "products", limit: "{title}" }], /needs a number setting/],
    ["a collection bound to a text setting", [{ kind: "products", collection: "{title}" }], /needs a collection setting/],
    ["a collection that is not a single setting", [{ kind: "products", collection: "summer" }], /one collection setting/],
    ["more than 12 products", [{ kind: "products", limit: 20 }], /12/],
  ])("refuses %s", (_label, elements, message) => {
    expect(issues(recipe(elements))).toMatch(message);
  });

  it("expands into generated blocks with the saved or default count and the chosen collection", () => {
    const parsed = recipeSchema.parse(recipe([{ kind: "spacer", size: 32 }, { kind: "products", limit: "{count}", collection: "{range}", columns: 2 }])) as SectionRecipe;
    expect(expandRecipe(parsed, {}).blocks.map((block) => [block.type, block.settings])).toEqual([
      ["recipe-spacer", { size: 32 }],
      ["recipe-products", { limit: 3, columns: 2 }],
    ]);
    expect(expandRecipe(parsed, { count: 50, range: "col-1" }).blocks[1].settings).toEqual({ limit: 12, collectionId: "col-1", columns: 2 });
  });

  it("gives the merchant a collection picker and accepts the saved collection id", () => {
    const undo = registerRecipes("acme-shop", [recipeSchema.parse(recipe([{ kind: "products", collection: "{range}" }])) as SectionRecipe]);
    try {
      expect(getSectionDefinition("acme-shop/picks")?.controls.find((control) => control.key === "range")?.type).toBe("collection");
      expect(validateSectionAgainstRegistry({ id: "s", type: "acme-shop/picks", enabled: true, settings: { range: "col-1", count: 4 }, blocks: [] }, "home", "acme-shop")).toEqual([]);
    } finally { undo(); }
  });
});
