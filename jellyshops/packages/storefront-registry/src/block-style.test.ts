import { expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { getBlockDefinition, validateSectionAgainstRegistry } from "./index";
import { isBlockStyleKey } from "./block-style";

function section(settings: Record<string, unknown>): SectionNode {
  return { id: "s1", type: "image-text", enabled: true, settings: {}, blocks: [{ id: "b1", type: "heading", enabled: true, settings: { text: "Hello", ...settings } }] };
}

it("gives heading, text and button blocks the shared style settings, grouped like Shopify", () => {
  for (const type of ["heading", "text", "button"]) {
    const controls = getBlockDefinition(type)?.controls ?? [];
    expect(controls.filter(({ key }) => isBlockStyleKey(key)).map(({ heading }) => heading)).toEqual(expect.arrayContaining(["Layout", "Typography", "Appearance", "Borders", "Padding"]));
  }
  expect(getBlockDefinition("faq-item")?.controls.some(({ key }) => isBlockStyleKey(key))).toBe(false);
});

it("accepts valid block styles and rejects broken ones", () => {
  expect(validateSectionAgainstRegistry(section({ blockTextColor: "#112233", blockPaddingTop: 16, blockBorder: "solid", blockTypePreset: "h2", blockWidth: "" }), "home")).toEqual([]);
  expect(validateSectionAgainstRegistry(section({ blockTextColor: "red" }), "home")[0]?.code).toBe("SETTINGS_INVALID");
  expect(validateSectionAgainstRegistry(section({ blockPaddingTop: 500 }), "home")[0]?.code).toBe("SETTINGS_INVALID");
});
