import { expect, it } from "vitest";
import { nestedDropPosition, type NestedDragRect } from "./drag-position";

const rect = (id: string, parentId: string | null, left: number, top: number, right: number, bottom: number): NestedDragRect => ({ id, parentId, left, top, right, bottom });
// b1 (0-100), a group g (100-300) holding g1 and g2 side by side, b2 (300-400).
const rects = [
  rect("b1", null, 0, 0, 400, 100),
  rect("g", null, 0, 100, 400, 300),
  rect("g1", "g", 0, 100, 200, 300),
  rect("g2", "g", 200, 100, 400, 300),
  rect("b2", null, 0, 300, 400, 400),
];

it("drops into a group by the pointer's half of the innermost block", () => {
  expect(nestedDropPosition(rects, "b2", null, 150, 200)).toMatchObject({ parentId: "g", beforeId: "g2", line: { left: 198, width: 4 } });
  expect(nestedDropPosition(rects, "b2", null, 50, 200)).toMatchObject({ parentId: "g", beforeId: "g1" });
  expect(nestedDropPosition(rects, "b2", null, 390, 200)).toMatchObject({ parentId: "g", beforeId: null });
});

it("drops out of a group before or after a top-level block", () => {
  expect(nestedDropPosition(rects, "g1", "g", 200, 20)).toMatchObject({ parentId: null, beforeId: "b1", line: { top: -2, height: 4 } });
  expect(nestedDropPosition(rects, "g1", "g", 200, 380)).toMatchObject({ parentId: null, beforeId: null });
});

it("drops inside an empty group, and stays in its own list away from any block", () => {
  const empty = [{ parentId: "e", rect: rect("e", null, 0, 400, 400, 480) }];
  expect(nestedDropPosition([...rects, rect("e", null, 0, 400, 400, 480)], "b1", null, 100, 440, empty)).toMatchObject({ parentId: "e", beforeId: null });
  expect(nestedDropPosition(rects, "b1", null, 900, 350)).toMatchObject({ parentId: null, beforeId: null });
});
