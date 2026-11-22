import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./same-origin";

const post = (url: string, headers: Record<string, string>) => new Request(url, { method: "POST", headers });

describe("isSameOrigin", () => {
  it("accepts a page of the same site", () => {
    expect(isSameOrigin(post("https://myshop.jellyshop.io/api/storefront-access", { origin: "https://myshop.jellyshop.io", host: "myshop.jellyshop.io" }))).toBe(true);
    expect(isSameOrigin(post("http://localhost:3200/api/x", { origin: "http://localhost:3200", host: "localhost:3200" }))).toBe(true);
  });

  it("refuses another shop, another site and a missing origin", () => {
    expect(isSameOrigin(post("https://myshop.jellyshop.io/api/x", { origin: "https://evil.jellyshop.io", host: "myshop.jellyshop.io" }))).toBe(false);
    expect(isSameOrigin(post("https://myshop.jellyshop.io/api/x", { origin: "https://example.com", host: "myshop.jellyshop.io" }))).toBe(false);
    expect(isSameOrigin(post("https://myshop.jellyshop.io/api/x", { host: "myshop.jellyshop.io" }))).toBe(false);
    expect(isSameOrigin(post("https://myshop.jellyshop.io/api/x", { origin: "null", host: "myshop.jellyshop.io" }))).toBe(false);
  });

  it("follows the forwarded host and scheme behind the hosting proxy", () => {
    expect(isSameOrigin(post("http://internal:3000/api/x", { origin: "https://myshop.jellyshop.io", host: "internal:3000", "x-forwarded-host": "myshop.jellyshop.io", "x-forwarded-proto": "https" }))).toBe(true);
  });
});
