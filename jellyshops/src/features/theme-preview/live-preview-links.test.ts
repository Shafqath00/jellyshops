import { describe, expect, it } from "vitest";
import { pageForLink } from "./live-preview-links";

describe("live preview links", () => {
  it("opens the sample page a store link points at", () => {
    expect(pageForLink("/preview", false)).toBe("home");
    expect(pageForLink("/preview/", false)).toBe("home");
    expect(pageForLink("/preview/products/linen-tote", false)).toBe("product");
    expect(pageForLink("/preview/collections/all?sort=price", false)).toBe("collection");
    expect(pageForLink("/preview/shop", false)).toBe("collection");
    expect(pageForLink("/preview/cart", false)).toBe("cart");
    expect(pageForLink("/preview/search?q=mug", false)).toBe("search");
    expect(pageForLink("/preview/pages/about", false)).toBe("page");
    expect(pageForLink("/preview/about", false)).toBe("page");
  });

  it("understands the sample pages' own anchors and unprefixed paths", () => {
    expect(pageForLink("#checkout", false)).toBe("checkout");
    expect(pageForLink("#shop", false)).toBe("collection");
    expect(pageForLink("#search", false)).toBe("search");
    expect(pageForLink("/products/x", false)).toBe("product");
  });

  it("opens the product page from any product card", () => {
    expect(pageForLink("#", true)).toBe("product");
  });

  it("ignores links that lead nowhere or off the site", () => {
    expect(pageForLink("#", false)).toBeNull();
    expect(pageForLink(null, false)).toBeNull();
    expect(pageForLink("mailto:hello@example.com", false)).toBeNull();
    expect(pageForLink("https://instagram.com/shop", false)).toBeNull();
  });
});
