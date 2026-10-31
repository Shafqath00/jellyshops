import { expect, it } from "vitest";
import { applySelectionAction, availableActions, moveBefore, siblingIdsFor } from "./selection-actions";

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

const grouped = () => ({
  sections: [{ kind: "inline", section: { id: "a", type: "custom-content", enabled: true, settings: {}, blocks: [
    block("b1"),
    { id: "g", type: "group", enabled: true, settings: {}, blocks: [block("g1"), block("g2")] },
    block("b2"),
  ] } }],
});
const ids_of = (result: { layout: Record<string, unknown> } | null) => {
  const blocks = inline(result, 0).section.blocks as Array<{ id: string; blocks?: Array<{ id: string }> }>;
  return blocks.map(({ id, blocks: children }) => children ? `${id}[${children.map((child) => child.id).join(",")}]` : id).join(" ");
};

it("moves, duplicates, hides and deletes blocks inside a group", () => {
  expect(availableActions(grouped(), { sectionId: "a", blockId: "g1" })).toMatchObject({ "move-up": false, "move-down": true, "group-out": true, "group-in": false });
  expect(ids_of(applySelectionAction(grouped(), { sectionId: "a", blockId: "g1" }, "move-down"))).toBe("b1 g[g2,g1] b2");
  const copy = applySelectionAction(grouped(), { sectionId: "a", blockId: "g2" }, "duplicate", () => "g3");
  expect(ids_of(copy)).toBe("b1 g[g1,g2,g3] b2");
  expect(copy!.select).toEqual({ sectionId: "a", blockId: "g3" });
  const hidden = applySelectionAction(grouped(), { sectionId: "a", blockId: "g2" }, "toggle");
  expect((inline(hidden, 0).section.blocks[1] as unknown as { blocks: Array<{ enabled: boolean }> }).blocks[1].enabled).toBe(false);
  const removed = applySelectionAction(grouped(), { sectionId: "a", blockId: "g1" }, "remove");
  expect(ids_of(removed)).toBe("b1 g[g2] b2");
  // Deleting a block in a group selects the group.
  expect(removed!.select).toEqual({ sectionId: "a", blockId: "g" });
});

it("moves a block into the group above it and back out", () => {
  expect(availableActions(grouped(), { sectionId: "a", blockId: "b1" })["group-in"]).toBe(false);
  expect(availableActions(grouped(), { sectionId: "a", blockId: "g" })["group-in"]).toBe(false);
  expect(ids_of(applySelectionAction(grouped(), { sectionId: "a", blockId: "b2" }, "group-in"))).toBe("b1 g[g1,g2,b2]");
  expect(ids_of(applySelectionAction(grouped(), { sectionId: "a", blockId: "g1" }, "group-out"))).toBe("b1 g[g2] g1 b2");
  let next = 0;
  const copy = applySelectionAction(grouped(), { sectionId: "a", blockId: "g" }, "duplicate", () => `n${++next}`);
  expect(ids_of(copy)).toBe("b1 g[g1,g2] n1[n2,n3] b2");
});

it("drags sections and blocks to a new place among their siblings", () => {
  const three = () => ({ type: "home", sections: [
    { kind: "global", globalSectionId: "header" },
    ...["a", "c", "d"].map((id) => ({ kind: "inline", section: { id, type: "custom-content", enabled: true, settings: {}, blocks: [block(`${id}1`), block(`${id}2`), block(`${id}3`)] } })),
  ] });
  const order = (result: { layout: Record<string, unknown> } | null) => (result!.layout.sections as Array<{ section?: { id: string } }>).map((item) => item.section?.id ?? "global");
  expect(siblingIdsFor(three(), { sectionId: "a" })).toEqual(["a", "c", "d"]);
  expect(order(moveBefore(three(), { sectionId: "d" }, "a"))).toEqual(["global", "d", "a", "c"]);
  expect(order(moveBefore(three(), { sectionId: "a" }, null))).toEqual(["global", "c", "d", "a"]);
  expect(order(moveBefore(three(), { sectionId: "a" }, "d"))).toEqual(["global", "c", "a", "d"]);
  // Dropping where it already is, onto itself, or before something that is not a sibling does nothing.
  expect(moveBefore(three(), { sectionId: "a" }, "c")).toBeNull();
  expect(moveBefore(three(), { sectionId: "a" }, "a")).toBeNull();
  expect(moveBefore(three(), { sectionId: "a" }, "nope")).toBeNull();

  expect(siblingIdsFor(three(), { sectionId: "a", blockId: "a2" })).toEqual(["a1", "a2", "a3"]);
  const moved = moveBefore(three(), { sectionId: "c", blockId: "c3" }, "c1");
  expect(inline(moved, 2).section.blocks.map(({ id }) => id)).toEqual(["c3", "c1", "c2"]);
  expect(inline(moveBefore(three(), { sectionId: "c", blockId: "c1" }, null), 2).section.blocks.map(({ id }) => id)).toEqual(["c2", "c3", "c1"]);
  expect(moveBefore(three(), { sectionId: "c", blockId: "c1" }, "a1")).toBeNull();
  expect(moveBefore(three(), { sectionId: "c", blockId: "c1" }, "c2")).toBeNull();
});
