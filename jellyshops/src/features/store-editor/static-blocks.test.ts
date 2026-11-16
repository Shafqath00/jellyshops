import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getSectionDefinition, registerSection } from "@jelly/storefront-registry";
import { applySelectionAction, availableActions, blockDropLists, moveBefore } from "./selection-actions";

// A section with a fixed photo (static block) and free text blocks, like Main product's photo and details columns.
registerSection({
  type: "acme/fixed-photo", category: "content", supportedPages: ["home"], settingsSchema: z.object({}).passthrough(), controls: [],
  allowedBlockTypes: ["heading", "text"], staticBlocks: [{ type: "image", label: "Photo" }], defaultSettings: {}, defaultBlocks: [], responsiveFields: [],
});

const layout = {
  sections: [{
    kind: "inline",
    section: {
      id: "s", type: "acme/fixed-photo", enabled: true, settings: {},
      blocks: [
        { id: "photo", type: "image", enabled: true, settings: {} },
        { id: "h", type: "heading", enabled: true, settings: { text: "Hi" } },
        { id: "t", type: "text", enabled: true, settings: { text: "Words" } },
      ],
    },
  }],
};

describe("static blocks in the editor", () => {
  it("starts new sections with the static block", () => {
    expect(getSectionDefinition("acme/fixed-photo")!.defaultBlocks.map((block) => block.type)).toEqual(["image"]);
  });
  it("offers no actions on a static block", () => {
    expect(Object.values(availableActions(layout, { sectionId: "s", blockId: "photo" })).some(Boolean)).toBe(false);
    for (const action of ["move-down", "duplicate", "toggle", "remove"] as const) expect(applySelectionAction(layout, { sectionId: "s", blockId: "photo" }, action)).toBeNull();
    expect(blockDropLists(layout, { sectionId: "s", blockId: "photo" })).toEqual([]);
    expect(moveBefore(layout, { sectionId: "s", blockId: "photo" }, null)).toBeNull();
  });
  it("keeps the other blocks free", () => {
    const actions = availableActions(layout, { sectionId: "s", blockId: "t" });
    expect(actions.remove && actions.toggle && actions["move-up"] && actions.duplicate).toBe(true);
    expect(applySelectionAction(layout, { sectionId: "s", blockId: "h" }, "remove")).not.toBeNull();
  });
});
