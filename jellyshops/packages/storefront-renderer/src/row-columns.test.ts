import { describe, expect, it } from "vitest";
import { balancedColumns, rowColumnProps } from "./row-columns";

describe("balancedColumns", () => {
  it("never leaves empty slots or a lone card in a short row", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((count) => balancedColumns(count, 4))).toEqual([2, 2, 3, 4, 3, 3, 4, 4]);
    expect([1, 2, 3, 4, 5, 6].map((count) => balancedColumns(count, 3))).toEqual([2, 2, 3, 2, 3, 3]);
  });
  it("keeps the chosen columns for long lists and while nothing has loaded", () => {
    expect(balancedColumns(9, 4)).toBe(4);
    expect(balancedColumns(0, 4)).toBe(4);
    expect(balancedColumns(1, 1)).toBe(1);
  });
});

describe("rowColumnProps", () => {
  it("keeps cards their full-row width when a row has fewer cards than columns", () => {
    expect(rowColumnProps(2, 4)).toEqual({ "data-count": 2, "data-short-row": "", style: { "--jelly-columns": 2, "--jelly-columns-tablet": 2, "--jelly-row-slots": 4, "--jelly-row-slots-tablet": 3 } });
    expect(rowColumnProps(3, 4)).toMatchObject({ "data-short-row": "", style: { "--jelly-columns": 3, "--jelly-row-slots": 4 } });
  });
  it("adds nothing for a full row or an empty one", () => {
    expect(rowColumnProps(4, 4)).toEqual({ "data-count": 4, style: { "--jelly-columns": 4, "--jelly-columns-tablet": 2 } });
    expect(rowColumnProps(0, 4)).toEqual({ "data-count": 0, style: { "--jelly-columns": 4, "--jelly-columns-tablet": 3 } });
  });
});
