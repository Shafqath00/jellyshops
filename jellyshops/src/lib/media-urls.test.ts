import { describe, expect, it } from "vitest";
import { resolveMediaUrls } from "./media-urls";

describe("API media URL resolution", () => {
  it.each([
    ["/api/public/media/store/photo?w=320", "https://api.example.com/function/api/public/media/store/photo?w=320"],
    ["http://localhost:3001/api/public/media/store/photo", "https://api.example.com/function/api/public/media/store/photo"],
    ["http://127.0.0.1:5001/old/functions/api/api/public/media/store/photo?w=640", "https://api.example.com/function/api/public/media/store/photo?w=640"],
    ["https://cdn.example.com/api/public/media/store/photo", "https://cdn.example.com/api/public/media/store/photo"],
    ["//cdn.example.com/photo", "//cdn.example.com/photo"],
    ["/shop", "/shop"],
  ])("resolves %s without losing its path or query", (url, expected) => {
    const source = { nested: [{ image: { url }, imageUrl: url }], text: url, nil: null };
    const resolved = resolveMediaUrls(source, "https://api.example.com/function/");
    expect(resolved.nested[0]).toEqual({ image: { url: expected }, imageUrl: expected });
    expect(resolved.text).toBe(url);
    expect(resolved.nil).toBeNull();
    expect(source.nested[0].image.url).toBe(url);
  });
});
