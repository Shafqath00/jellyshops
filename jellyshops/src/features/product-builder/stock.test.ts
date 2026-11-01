import { describe, expect, it } from "vitest";
import { DEFAULT_LOW_STOCK_THRESHOLD, stockStatusOf } from "./stock";

describe("stockStatusOf", () => {
  it("matches the server's rules", () => {
    expect(DEFAULT_LOW_STOCK_THRESHOLD).toBe(3);
    expect(stockStatusOf(false, null, 0, null)).toBe("untracked");
    expect(stockStatusOf(true, null, 0, null)).toBe("untracked");
    expect(stockStatusOf(true, 0, 0, null)).toBe("out");
    expect(stockStatusOf(true, 5, 5, null)).toBe("out");
    expect(stockStatusOf(true, 5, 2, null)).toBe("low");
    expect(stockStatusOf(true, 3, 0, null)).toBe("low");
    expect(stockStatusOf(true, 4, 0, null)).toBe("in_stock");
    expect(stockStatusOf(true, 8, 0, 10)).toBe("low");
    expect(stockStatusOf(true, 11, 0, 10)).toBe("in_stock");
    expect(stockStatusOf(true, 1, 0, 0)).toBe("in_stock");
  });
});
