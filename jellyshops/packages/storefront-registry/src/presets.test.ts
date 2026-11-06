import { describe, expect, it } from "vitest";
import { createPresetSection, createSectionFromDefinition, listSectionPresets } from "./presets";
import { validateSectionAgainstRegistry } from "./registry";

function ids(values: string[]) {
  let index = 0;
  return () => values[index++] ?? `generated-${index}`;
}

describe("store editor section presets", () => {
  it("creates a registry-valid hero section with fresh stable ids", () => {
    const section = createPresetSection("hero", ids(["section-hero", "block-heading", "block-text", "block-button"]));

    expect(section).toMatchObject({ id: "section-hero", type: "hero", enabled: true });
    expect(section.blocks.map((block) => block.id)).toEqual(["block-heading", "block-text", "block-button"]);
    expect(validateSectionAgainstRegistry(section, "home")).toEqual([]);
  });

  it("lists only Shopify editor categories", () => {
    expect(new Set(listSectionPresets().map((preset) => preset.category))).toEqual(new Set(["banners", "products", "content", "marketing"]));
  });

  it("rejects an unknown preset instead of creating free-form section data", () => {
    expect(() => createPresetSection("made-up-section", ids(["section"]))).toThrow("Unknown section preset");
  });

  it("creates layout sections that do not need a named preset", () => {
    const section = createSectionFromDefinition("header", ids(["section-header", "menu-1"]));

    expect(section).toMatchObject({ id: "section-header", type: "header", enabled: true });
    expect(section.blocks).toEqual([]);
    expect(validateSectionAgainstRegistry(section, "home")).toEqual([]);
  });

  it("turns every preset, designed variants included, into a valid section with fresh ids", () => {
    let counter = 0;
    const createId = () => `id-${++counter}`;
    for (const preset of listSectionPresets()) {
      const section = createPresetSection(preset.id, createId);
      expect(section.type, preset.id).toBe(preset.sectionType);
      expect(validateSectionAgainstRegistry(section, "home"), preset.id).toEqual([]);
      for (const block of section.blocks) expect(block.id, preset.id).toMatch(/^id-\d+$/);
    }
  });

  it("builds Collection list: Bento in one click: bento layout, one large and four smaller collections", () => {
    const section = createPresetSection("category-grid-bento", ids(["section-bento"]));
    expect(section).toMatchObject({ id: "section-bento", type: "category-grid", settings: { layout: "bento", columns: 4, heading: "Shop by collection" } });
    expect(section.blocks.map((block) => block.settings.label)).toEqual(["New arrivals", "Knitwear", "Accessories", "For the home", "Gifts"]);
    expect(new Set(section.blocks.map((block) => block.id)).size).toBe(5);
  });

  it("lists designed variants after the section's own preset, with a sketch and a description", () => {
    const heroes = listSectionPresets().filter((preset) => preset.sectionType === "hero").map((preset) => preset.id);
    expect(heroes).toEqual(["hero", "hero-overlay", "hero-text"]);
    for (const type of ["hero", "category-grid", "product-grid", "image-with-text", "multicolumn"]) {
      const variants = listSectionPresets().filter((preset) => preset.sectionType === type && preset.id !== type);
      expect(variants.length, type).toBeGreaterThanOrEqual(2);
      for (const variant of variants) expect(variant, variant.id).toMatchObject({ thumbnail: expect.any(String), description: expect.any(String) });
    }
    // A preset with settings but no blocks keeps the section's default blocks.
    expect(createPresetSection("product-grid-three", ids(["s"])).settings).toMatchObject({ columns: 3, limit: 6, emptyMessage: expect.any(String) });
  });
});
