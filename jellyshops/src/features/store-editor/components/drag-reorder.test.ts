import { describe, expect, it } from "vitest";
import { dragReorderCommand } from "./drag-reorder";

describe("dragReorderCommand", () => {
  it("maps a section drag to the existing move-section command", () => {
    expect(dragReorderCommand({ kind: "section", region: "template", id: "hero" }, { kind: "section", region: "template", id: "grid" }, ["hero", "grid"])).toEqual({
      type: "move-section", region: "template", sectionId: "hero", toIndex: 1,
    });
  });

  it("maps a block drag to the existing move-block command", () => {
    expect(dragReorderCommand({ kind: "block", region: "template", sectionId: "hero", id: "heading" }, { kind: "block", region: "template", sectionId: "hero", id: "button" }, ["heading", "button"])).toEqual({
      type: "move-block", region: "template", sectionId: "hero", blockId: "heading", toIndex: 1,
    });
  });

  it("rejects drags across unrelated tree containers", () => {
    expect(dragReorderCommand({ kind: "block", region: "template", sectionId: "hero", id: "heading" }, { kind: "block", region: "template", sectionId: "grid", id: "button" }, ["heading", "button"])).toBeNull();
  });
});
