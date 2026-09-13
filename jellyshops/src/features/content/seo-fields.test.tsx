import { expect, it } from "vitest";
import { validateSeoFields } from "./seo-fields";

it("validates title description handle and canonical override", () => {
  expect(validateSeoFields({
    seoTitle: "A".repeat(71),
    seoDescription: "B".repeat(161),
    handle: "Not valid",
    canonicalOverride: "javascript:alert(1)",
    noindex: false,
    socialMediaId: null,
  })).toEqual(expect.objectContaining({
    seoTitle: expect.any(String),
    seoDescription: expect.any(String),
    handle: expect.any(String),
    canonicalOverride: expect.any(String),
  }));
});

it("accepts a normal seo configuration", () => {
  expect(validateSeoFields({
    seoTitle: "About Jelly",
    seoDescription: "Learn more about our store.",
    handle: "about-jelly",
    canonicalOverride: "https://example.com/about-jelly",
    noindex: false,
    socialMediaId: null,
  })).toEqual({});
});
