import { describe, expect, it } from "vitest";
import { corsOriginMatchers } from "./cors-origins.js";

const allows = (list: string[], origin: string) =>
  corsOriginMatchers(list).some((matcher) => (typeof matcher === "string" ? matcher === origin : matcher.test(origin)));

describe("corsOriginMatchers", () => {
  it("keeps exact origins as they are", () => {
    expect(corsOriginMatchers(["https://jellyshop.io"])).toEqual(["https://jellyshop.io"]);
  });

  it("allows one shop-shaped label in place of *.", () => {
    const list = ["https://*.jellyshop.io"];
    for (const origin of ["https://myshop.jellyshop.io", "https://admin.jellyshop.io", "https://my-shop-2.jellyshop.io"]) {
      expect(allows(list, origin)).toBe(true);
    }
  });

  it("refuses anything else", () => {
    const list = ["https://*.jellyshop.io"];
    for (const origin of [
      "http://myshop.jellyshop.io",
      "https://jellyshop.io",
      "https://a.b.jellyshop.io",
      "https://ab.jellyshop.io",
      "https://my--shop.jellyshop.io",
      "https://myshop.jellyshop.io.evil.com",
      "https://myshopjellyshop.io",
      "https://myshop.jellyshop.io:8443",
    ]) {
      expect(allows(list, origin)).toBe(false);
    }
  });

  it("supports a port for local development", () => {
    expect(allows(["http://*.localhost:3000"], "http://myshop.localhost:3000")).toBe(true);
    expect(allows(["http://*.localhost:3000"], "http://myshop.localhost:3001")).toBe(false);
  });

  it("refuses a * anywhere else", () => {
    expect(() => corsOriginMatchers(["https://shop.*.io"])).toThrow();
  });
});
