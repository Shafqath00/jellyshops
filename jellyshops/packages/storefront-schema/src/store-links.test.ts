import { describe, expect, it } from "vitest";
import { isInStore, storeBase, storePath } from "./store-links";

describe("storePath", () => {
  it("builds today's /<slug>/... addresses", () => {
    expect(storeBase("myshop")).toBe("/myshop");
    expect(storePath("myshop")).toBe("/myshop");
    expect(storePath("myshop", "/")).toBe("/myshop");
    expect(storePath("myshop", "/cart")).toBe("/myshop/cart");
    expect(storePath("myshop", "products/bed")).toBe("/myshop/products/bed");
    expect(storePath("myshop", "/search?q=bed")).toBe("/myshop/search?q=bed");
    expect(storePath("myshop", "?lang=fr")).toBe("/myshop?lang=fr");
  });

  it("encodes the address safely", () => {
    expect(storePath("a b", "/cart")).toBe("/a%20b/cart");
  });
});

describe("isInStore", () => {
  it("spots links already inside the shop", () => {
    expect(isInStore("myshop", "/myshop")).toBe(true);
    expect(isInStore("myshop", "/myshop/cart")).toBe(true);
    expect(isInStore("myshop", "/myshop?lang=fr")).toBe(true);
    expect(isInStore("myshop", "/myshopping")).toBe(false);
    expect(isInStore("myshop", "/cart")).toBe(false);
  });
});
