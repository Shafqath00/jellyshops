import { describe, expect, it } from "vitest";
import { balancedColumns } from "./row-columns";

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
