import type { SectionNode } from "@jelly/storefront-schema";
import { describe, expect, it } from "vitest";
import { breaksEssentialSections, essentialSectionsProblem } from "./essential-sections";

const section = (type: string, extra: Partial<SectionNode> = {}): SectionNode => ({ id: type, type, enabled: true, settings: {}, blocks: [], ...extra });

describe("essential sections", () => {
  it("needs each page's working section, visible", () => {
    expect(essentialSectionsProblem("collection", [section("collection-header"), section("collection-product-grid")])).toBeNull();
    expect(essentialSectionsProblem("collection", [section("collection-header")])).toMatch(/product grid/);
    expect(essentialSectionsProblem("collection", [section("collection-product-grid", { enabled: false })])).toMatch(/product grid/);
    expect(essentialSectionsProblem("cart", [])).toMatch(/bag section/);
    expect(essentialSectionsProblem("home", [])).toBeNull();
    expect(essentialSectionsProblem("not-found", [])).toBeNull();
  });

  it("treats a product page as working while shoppers can still add to the bag", () => {
    expect(essentialSectionsProblem("product", [section("product-purchase")])).toBeNull();
    expect(essentialSectionsProblem("product", [section("main-product", { blocks: [{ id: "buy", type: "part-product-purchase", enabled: true, settings: {} }] })])).toBeNull();
    expect(essentialSectionsProblem("product", [section("main-product", { blocks: [{ id: "buy", type: "part-product-purchase", enabled: false, settings: {} }] })])).toMatch(/add the product to the bag/);
    expect(essentialSectionsProblem("product", [section("main-product")])).toMatch(/add the product to the bag/);
  });

  it("refuses only a change that breaks a working page", () => {
    const working = [section("search-results")];
    expect(breaksEssentialSections("search", working, [])).toMatch(/search results/);
    expect(breaksEssentialSections("search", [], [])).toBeNull();
    expect(breaksEssentialSections("search", working, [section("search-results", { id: "copy" })])).toBeNull();
  });
});
