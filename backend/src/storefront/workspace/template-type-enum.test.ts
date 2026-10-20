import { describe, expect, it } from "vitest";
import { fromStorefrontTemplateEnumValue, toStorefrontTemplateEnumValue } from "./template-type-enum.js";

describe("storefront template SQL enum mapping", () => {
  it("maps every public page type to the persisted enum value", () => {
    expect([
      "home", "product", "collection", "page", "blog", "article", "search", "cart", "not-found",
    ].map((type) => toStorefrontTemplateEnumValue(type as never))).toEqual([
      "HOME", "PRODUCT", "COLLECTION", "PAGE", "BLOG", "ARTICLE", "SEARCH", "CART", "NOT_FOUND",
    ]);
  });

  it("normalizes the SQL Not Found enum value back to its public page-type handle", () => {
    expect(fromStorefrontTemplateEnumValue("NOT_FOUND")).toBe("not-found");
  });
});
