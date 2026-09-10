import { createDefaultStorefrontDocument } from "@jelly/storefront-schema";
import { describe, expect, it } from "vitest";
import { applyCommand } from "./commands";

function sequenceIds(ids: string[]) {
  let index = 0;
  return () => ids[index++];
}

describe("editor commands", () => {
  it("duplicates a section with fresh section and block ids", () => {
    const document = createDefaultStorefrontDocument("store-demo");
    const hero = document.regions.template[0];

    const result = applyCommand(document, {
      type: "duplicate-section",
      region: "template",
      sectionId: hero.id,
      createId: sequenceIds(["section-copy", "block-copy-1", "block-copy-2", "block-copy-3"]),
    });

    expect(result.regions.template[1].id).toBe("section-copy");
    expect(result.regions.template[1].blocks.map(({ id }) => id)).toEqual([
      "block-copy-1", "block-copy-2", "block-copy-3",
    ]);
    expect(document.regions.template).toHaveLength(2);
  });

  it("clamps movement and protects required header sections", () => {
    const document = createDefaultStorefrontDocument("store-demo");
    const hero = document.regions.template[0];
    const header = document.regions.header[0];

    expect(applyCommand(document, {
      type: "move-section", region: "template", sectionId: hero.id, toIndex: -1,
    })).toBe(document);
    expect(() => applyCommand(document, {
      type: "remove-section", region: "header", sectionId: header.id,
    })).toThrow("The header section cannot be removed");
  });

  it("updates a setting without mutating the source document", () => {
    const document = createDefaultStorefrontDocument("store-demo");
    const hero = document.regions.template[0];
    const result = applyCommand(document, {
      type: "update-section-setting",
      region: "template",
      sectionId: hero.id,
      key: "background",
      value: "#112233",
    });

    expect(result.regions.template[0].settings.background).toBe("#112233");
    expect(document.regions.template[0].settings.background).toBeUndefined();
  });

  it("updates nested theme settings without mutating the source document", () => {
    const document = createDefaultStorefrontDocument("store-demo");
    const result = applyCommand(document, {
      type: "update-theme-setting",
      group: "colors",
      key: "background",
      value: "#123456",
    });

    expect(result.theme.settings.colors.background).toBe("#123456");
    expect(document.theme.settings.colors.background).not.toBe("#123456");
  });
});
