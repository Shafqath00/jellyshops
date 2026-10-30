import { expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { getBlockDefinition, validateSectionAgainstRegistry } from "./index";
import { isBlockStyleKey } from "./block-style";

function section(settings: Record<string, unknown>): SectionNode {
  return { id: "s1", type: "image-text", enabled: true, settings: {}, blocks: [{ id: "b1", type: "heading", enabled: true, settings: { text: "Hello", ...settings } }] };
}

it("gives heading and text blocks the shared style settings, grouped like Shopify", () => {
  for (const type of ["heading", "text"]) {
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

it("gives buttons, images and videos layout, border and padding settings but no text style", () => {
  for (const type of ["button", "image", "video"]) {
    const keys = getBlockDefinition(type)?.controls.map(({ key }) => key) ?? [];
    expect(keys).toEqual(expect.arrayContaining(["blockWidth", "blockRadius", "blockPaddingTop"]));
    expect(keys).not.toContain("blockTypePreset");
    expect(keys).not.toContain("blockBackground");
  }
  expect(getBlockDefinition("button")?.controls.map(({ key }) => key)).toEqual(expect.arrayContaining(["buttonStyle", "buttonSize", "buttonHover", "buttonColor", "buttonTextColor", "openInNewTab"]));
});

it("adds a Custom content section that accepts any mix of content blocks", () => {
  const custom: SectionNode = {
    id: "c1", type: "custom-content", enabled: true, settings: { direction: "horizontal", gap: 24 },
    blocks: [
      { id: "i", type: "image", enabled: true, settings: { image: { url: "https://example.com/a.jpg" }, aspectRatio: "square", overlay: 20 } },
      { id: "v", type: "video", enabled: true, settings: { url: "https://youtu.be/dQw4w9WgXcQ", autoplay: true } },
      { id: "b", type: "button", enabled: true, settings: { label: "Go", href: "/shop", buttonStyle: "link", buttonColor: "#112233", openInNewTab: true } },
    ],
  };
  expect(validateSectionAgainstRegistry(custom, "home")).toEqual([]);
  expect(validateSectionAgainstRegistry({ ...custom, blocks: [{ ...custom.blocks[2], settings: { label: "Go", buttonStyle: "glow" } }] }, "page")[0]?.code).toBe("SETTINGS_INVALID");
});
