import { expect, it } from "vitest";
import { dropPosition } from "./drag-position";

const rects = [{ id: "a", top: 0, bottom: 100 }, { id: "b", top: 100, bottom: 300 }, { id: "c", top: 300, bottom: 400 }];

it("drops before the first sibling whose middle is below the pointer", () => {
  expect(dropPosition(rects, "c", 20)).toEqual({ beforeId: "a", lineY: 0 });
  expect(dropPosition(rects, "c", 120)).toEqual({ beforeId: "b", lineY: 100 });
  expect(dropPosition(rects, "a", 250)).toEqual({ beforeId: "c", lineY: 300 });
});

it("drops at the end below the last sibling and ignores the dragged item", () => {
  expect(dropPosition(rects, "a", 390)).toEqual({ beforeId: null, lineY: 400 });
  expect(dropPosition(rects, "c", 390)).toEqual({ beforeId: null, lineY: 300 });
  expect(dropPosition([{ id: "a", top: 0, bottom: 10 }], "a", 5)).toBeNull();
});
