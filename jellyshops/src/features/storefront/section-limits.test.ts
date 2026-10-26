import { describe, expect, it } from "vitest";
import { getSectionDefinition, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { SectionNode } from "@jelly/storefront-schema";

/** Every block a merchant can add to the new Avenue sections must pass the registry's own checks. */
const section = (type: string, blocks: SectionNode["blocks"], settings: Record<string, unknown> = {}): SectionNode => ({ id: `${type}-1`, type, enabled: true, settings, blocks });
const block = (id: string, type: string, settings: Record<string, unknown>) => ({ id, type, enabled: true, settings });

describe("Jelly Avenue section limits", () => {
  it("accepts a slideshow with up to six slides and rejects a seventh", () => {
    const slides = Array.from({ length: 6 }, (_, index) => block(`s${index}`, "slide", { heading: `Slide ${index + 1}` }));
    expect(validateSectionAgainstRegistry(section("slideshow", slides), "home")).toEqual([]);
    const tooMany = [...slides, block("s7", "slide", { heading: "Seventh" })];
    expect(validateSectionAgainstRegistry(section("slideshow", tooMany), "home").map((issue) => issue.code)).toContain("BLOCK_LIMIT_EXCEEDED");
  });

  it("accepts product information tabs on the product page only", () => {
    const tabs = section("product-tabs", [block("t1", "info-tab", { title: "Care", text: "Wash cold." })]);
    expect(validateSectionAgainstRegistry(tabs, "product")).toEqual([]);
    expect(validateSectionAgainstRegistry(tabs, "home").length).toBeGreaterThan(0);
  });

  it("keeps the stock counter off the home page", () => {
    expect(getSectionDefinition("product-stock-counter")?.supportedPages).toEqual(["product"]);
    expect(validateSectionAgainstRegistry(section("product-stock-counter", []), "home").length).toBeGreaterThan(0);
  });

  it("allows footer link blocks and rejects them inside other sections", () => {
    expect(validateSectionAgainstRegistry(section("footer", [block("l1", "link", { label: "Shipping", link: "/shipping" }), block("h", "link-heading", { text: "Help" })]), "home")).toEqual([]);
    expect(validateSectionAgainstRegistry(section("hero", [block("l1", "link", { label: "Shipping", link: "/shipping" })]), "home").length).toBeGreaterThan(0);
  });
});
