import { describe, expect, it } from "vitest";
import { createPresetSection, listSectionPresets } from "./presets";
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
});
