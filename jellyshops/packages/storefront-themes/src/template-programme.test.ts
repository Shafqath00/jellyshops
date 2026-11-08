import { describe, expect, it } from "vitest";
import { ARCHETYPES, TEMPLATE_PROGRAMME, checkTemplateDistinctness, type TemplatePlan } from "./template-programme";
import { listThemes } from "./theme-registry";

describe("template programme", () => {
  it("has 20 templates that follow the distinctness rule", () => {
    expect(TEMPLATE_PROGRAMME).toHaveLength(20);
    expect(checkTemplateDistinctness()).toEqual([]);
  });

  it("names existing templates by a registered theme id", () => {
    const ids = new Set(listThemes().map((theme) => theme.id));
    for (const plan of TEMPLATE_PROGRAMME.filter((entry) => entry.status === "existing")) expect(ids.has(plan.themeId ?? "")).toBe(true);
  });

  it("reports templates that are too alike", () => {
    const base = TEMPLATE_PROGRAMME[3];
    const copy: TemplatePlan = { ...base, name: "Copy", displayFont: "Other", archetypes: { ...base.archetypes, cart: "K2" } };
    const problems = checkTemplateDistinctness([base, copy]);
    expect(problems.some((problem) => problem.includes("share 5 layouts"))).toBe(true);
    expect(problems.some((problem) => problem.includes("both the hero and the product page"))).toBe(true);
  });

  it("points hero archetypes at hero layouts that exist", async () => {
    const { HERO_LAYOUTS } = await import("../../storefront-renderer/src/sections/hero");
    for (const option of ARCHETYPES.hero) if (option.implementation) expect(HERO_LAYOUTS).toContain(option.implementation.value);
  });

  it("points product page archetypes at layouts that exist", async () => {
    const { PRODUCT_PAGE_LAYOUTS } = await import("../../storefront-renderer/src/sections/product-sections");
    for (const option of ARCHETYPES.product) if (option.implementation) expect(PRODUCT_PAGE_LAYOUTS).toContain(option.implementation.value);
  });

  it("only points header archetypes at header layouts that exist", () => {
    const values = ARCHETYPES.header.flatMap((option) => option.implementation?.setting === "layout" ? [option.implementation.value] : []);
    expect(values).toEqual(["split", "classic", "minimal", "category-bar", "search-first", "search-bar"]);
  });
});
