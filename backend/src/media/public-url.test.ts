import { describe, expect, it } from "vitest";
import { chooseCopyWidth, knownCopyWidths, mediaPublicUrl } from "./public-url.js";

describe("public photo addresses", () => {
  it("builds the address from the storage key only when a public domain is set", () => {
    expect(mediaPublicUrl("https://img.test/", "store-a/m 1.png")).toBe("https://img.test/store-a/m%201.png");
    expect(mediaPublicUrl(undefined, "store-a/m1.png")).toBeUndefined();
  });

  it("knows which copies exist and picks the one that fits", () => {
    expect(knownCopyWidths({ variantWidths: [320, 640], contentHash: "x" })).toEqual([320, 640]);
    expect(knownCopyWidths({ variantWidths: null, contentHash: "x" })).toEqual([320, 640, 1280]);
    expect(knownCopyWidths({ variantWidths: null, contentHash: null })).toEqual([]);
    expect(chooseCopyWidth([320, 640, 960], 640)).toBe(640);
    expect(chooseCopyWidth([320, 640, 960], 1280)).toBe(960);
    expect(chooseCopyWidth([], 640)).toBeUndefined();
    expect(chooseCopyWidth([320], undefined)).toBeUndefined();
  });
});
