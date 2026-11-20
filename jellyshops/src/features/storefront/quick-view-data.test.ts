import { describe, expect, it } from "vitest";
import { quickViewImages, quickViewSummary } from "./quick-view-data";

describe("quick view data", () => {
  it("lists photos by position, without repeats, falling back to the main photo", () => {
    expect(quickViewImages({ imageUrl: "https://x.test/main.jpg", media: [{ url: "https://x.test/b.jpg", position: 2 }, { url: "https://x.test/a.jpg", position: 1 }, { url: "https://x.test/a.jpg", position: 3 }] } as never)).toEqual(["https://x.test/a.jpg", "https://x.test/b.jpg"]);
    expect(quickViewImages({ imageUrl: "https://x.test/main.jpg", media: [] } as never)).toEqual(["https://x.test/main.jpg"]);
    expect(quickViewImages({ imageUrl: "", media: [{ url: "javascript:alert(1)" }] } as never)).toEqual([]);
  });

  it("takes the first paragraph and cuts long ones on a word", () => {
    expect(quickViewSummary("First line.\n\nSecond paragraph.")).toBe("First line.");
    expect(quickViewSummary(undefined)).toBeUndefined();
    const long = quickViewSummary("word ".repeat(80))!;
    expect(long.length).toBeLessThanOrEqual(221);
    expect(long.endsWith("word…")).toBe(true);
  });
});
