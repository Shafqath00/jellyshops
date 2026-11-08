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

  it("only points header archetypes at header layouts that exist", () => {
    const values = ARCHETYPES.header.flatMap((option) => option.implementation?.setting === "layout" ? [option.implementation.value] : []);
    expect(values).toEqual(["split", "classic", "minimal", "category-bar", "search-first", "search-bar"]);
  });
});
