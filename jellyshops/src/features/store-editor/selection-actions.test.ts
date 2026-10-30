import { expect, it } from "vitest";
import { applySelectionAction, availableActions } from "./selection-actions";

const block = (id: string) => ({ id, type: "button", enabled: true, settings: { label: id } });
const layout = () => ({
  type: "home",
  sections: [
    { kind: "global", globalSectionId: "header" },
    { kind: "inline", section: { id: "a", type: "custom-content", enabled: true, settings: {}, blocks: [block("b1"), block("b2")] }, note: "kept" },
    { kind: "inline", section: { id: "c", type: "rich-text", enabled: true, settings: {}, blocks: [] } },
  ],
});
let next = 0;
const ids = () => `new-${++next}`;
const inline = (result: { layout: Record<string, unknown> } | null, index: number) => (result!.layout.sections as Array<{ section: { id: string; enabled: boolean; blocks: Array<{ id: string; enabled: boolean }> }; note?: string }>)[index];

it("moves, duplicates, hides and deletes sections", () => {
  expect(availableActions(layout(), { sectionId: "c" })).toMatchObject({ "move-up": true, "move-down": false });
  const moved = applySelectionAction(layout(), { sectionId: "a" }, "move-up");
  expect(inline(moved, 0).section.id).toBe("a");
  const copy = applySelectionAction(layout(), { sectionId: "a" }, "duplicate", ids);
  expect(inline(copy, 2).section.id).toBe("new-1");
  expect(inline(copy, 2).section.blocks.map(({ id }) => id)).toEqual(["new-2", "new-3"]);
  expect(inline(copy, 2).note).toBe("kept");
  expect(copy!.select).toEqual({ sectionId: "new-1" });
  expect(inline(applySelectionAction(layout(), { sectionId: "a" }, "toggle"), 1).section.enabled).toBe(false);
  const removed = applySelectionAction(layout(), { sectionId: "a" }, "remove");
  expect((removed!.layout.sections as unknown[]).length).toBe(2);
  expect(removed!.select).toBeNull();
});

it("moves, duplicates, hides and deletes blocks within their section's limits", () => {
  expect(applySelectionAction(layout(), { sectionId: "a", blockId: "b1" }, "move-up")).toBeNull();
  expect(inline(applySelectionAction(layout(), { sectionId: "a", blockId: "b1" }, "move-down"), 1).section.blocks.map(({ id }) => id)).toEqual(["b2", "b1"]);
  const copy = applySelectionAction(layout(), { sectionId: "a", blockId: "b2" }, "duplicate", () => "b3");
  expect(inline(copy, 1).section.blocks.map(({ id }) => id)).toEqual(["b1", "b2", "b3"]);
  expect(copy!.select).toEqual({ sectionId: "a", blockId: "b3" });
  expect(inline(applySelectionAction(layout(), { sectionId: "a", blockId: "b2" }, "toggle"), 1).section.blocks[1].enabled).toBe(false);
  const removed = applySelectionAction(layout(), { sectionId: "a", blockId: "b1" }, "remove");
  expect(inline(removed, 1).section.blocks.map(({ id }) => id)).toEqual(["b2"]);
  expect(removed!.select).toEqual({ sectionId: "a" });
  // Custom content allows at most 12 blocks.
  const full = layout();
  (full.sections[1] as { section: { blocks: unknown[] } }).section.blocks = Array.from({ length: 12 }, (_, index) => block(`x${index}`));
  expect(availableActions(full, { sectionId: "a", blockId: "x0" }).duplicate).toBe(false);
  expect(availableActions(layout(), { sectionId: "header" }).remove).toBe(false);
});
