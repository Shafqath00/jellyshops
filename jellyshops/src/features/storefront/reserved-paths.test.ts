import { expect, it } from "vitest";
import { isReservedStorefrontPath } from "./reserved-paths";

it.each(["products", "collections", "search", "cart", "blogs"])("protects the %s storefront namespace", (path) => {
  expect(isReservedStorefrontPath(path)).toBe(true);
});

it("allows ordinary custom Page handles", () => {
  expect(isReservedStorefrontPath("about-us")).toBe(false);
});
