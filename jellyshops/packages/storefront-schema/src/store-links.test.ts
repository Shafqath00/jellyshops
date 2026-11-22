import { afterEach, describe, expect, it, vi } from "vitest";
import { isInStore, storeBase, storeLinkSettings, storePagePath, storePath, storeUrl, type StoreLinkSettings } from "./store-links";

const path: StoreLinkSettings = { mode: "path", rootDomain: "jellyshop.io" };
const subdomain: StoreLinkSettings = { mode: "subdomain", rootDomain: "jellyshop.io" };
const preview: StoreLinkSettings = { mode: "preview", rootDomain: "jellyshop.io" };

afterEach(() => vi.unstubAllEnvs());

describe("storeLinkSettings", () => {
  it("defaults to today's /<slug> addresses on jellyshop.io", () => {
    vi.stubEnv("NEXT_PUBLIC_STORE_LINKS", "");
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "");
    expect(storeLinkSettings()).toEqual(path);
  });

  it("reads the mode and root domain, ignoring unknown modes", () => {
    vi.stubEnv("NEXT_PUBLIC_STORE_LINKS", "subdomain");
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "https://Localhost:3200/");
    expect(storeLinkSettings()).toEqual({ mode: "subdomain", rootDomain: "localhost:3200" });
    vi.stubEnv("NEXT_PUBLIC_STORE_LINKS", "weird");
    expect(storeLinkSettings().mode).toBe("path");
  });
});

describe("storePath", () => {
  it("builds /<slug>/... addresses in path mode", () => {
    expect(storeBase("myshop", path)).toBe("/myshop");
    expect(storePath("myshop", "", path)).toBe("/myshop");
    expect(storePath("myshop", "/", path)).toBe("/myshop");
    expect(storePath("myshop", "/cart", path)).toBe("/myshop/cart");
    expect(storePath("myshop", "products/bed", path)).toBe("/myshop/products/bed");
    expect(storePath("myshop", "/search?q=bed", path)).toBe("/myshop/search?q=bed");
    expect(storePath("myshop", "?lang=fr", path)).toBe("/myshop?lang=fr");
    expect(storePath("a b", "/cart", path)).toBe("/a%20b/cart");
  });

  it("drops the prefix on a shop subdomain", () => {
    expect(storeBase("myshop", subdomain)).toBe("");
    expect(storePath("myshop", "", subdomain)).toBe("/");
    expect(storePath("myshop", "/cart", subdomain)).toBe("/cart");
    expect(storePath("myshop", "?lang=fr", subdomain)).toBe("/?lang=fr");
  });

  it("uses /_shop/<slug> on previews", () => {
    expect(storePath("myshop", "", preview)).toBe("/_shop/myshop");
    expect(storePath("myshop", "/cart", preview)).toBe("/_shop/myshop/cart");
  });
});

describe("storeUrl", () => {
  it("gives a full address on subdomains", () => {
    expect(storeUrl("myshop", "", subdomain)).toBe("https://myshop.jellyshop.io");
    expect(storeUrl("myshop", "/order/abc", subdomain)).toBe("https://myshop.jellyshop.io/order/abc");
    expect(storeUrl("myshop", "/cart", { mode: "subdomain", rootDomain: "localhost:3200" })).toBe("http://myshop.localhost:3200/cart");
  });

  it("matches storePath otherwise", () => {
    expect(storeUrl("myshop", "/cart", path)).toBe("/myshop/cart");
    expect(storeUrl("myshop", "/cart", preview)).toBe("/_shop/myshop/cart");
  });
});

describe("isInStore", () => {
  it("spots links already inside the shop", () => {
    expect(isInStore("myshop", "/myshop", path)).toBe(true);
    expect(isInStore("myshop", "/myshop/cart", path)).toBe(true);
    expect(isInStore("myshop", "/myshop?lang=fr", path)).toBe(true);
    expect(isInStore("myshop", "/myshopping", path)).toBe(false);
    expect(isInStore("myshop", "/cart", path)).toBe(false);
    expect(isInStore("myshop", "/cart", subdomain)).toBe(false);
  });
});

describe("storePagePath", () => {
  it("gives the same page path for every way the router reports it", () => {
    for (const pathname of ["/sites/myshop/products/bed", "/myshop/products/bed", "/_shop/myshop/products/bed", "/products/bed"]) {
      expect(storePagePath("myshop", pathname)).toBe("/products/bed");
    }
    expect(storePagePath("myshop", "/sites/myshop")).toBe("/");
    expect(storePagePath("myshop", "/")).toBe("/");
    expect(storePagePath("myshop", "/myshopping")).toBe("/myshopping");
  });
});
