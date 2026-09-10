import { expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { getSectionDefinition, listSectionDefinitions, validateSectionAgainstRegistry } from "./index";

function section(type: string, blocks: SectionNode["blocks"] = []): SectionNode {
  return { id: "section-1", type, enabled: true, settings: {}, blocks };
}

it("registers the V1 editor section types", () => {
  const types = listSectionDefinitions().map((definition) => definition.type);

  expect(types).toEqual(expect.arrayContaining([
    "header", "hero", "featured-collection", "product-grid", "rich-text", "faq",
    "product-information", "collection-product-grid", "footer"
  ]));
});

it("allows only Hero content blocks", () => {
  expect(getSectionDefinition("hero")?.allowedBlockTypes).toEqual(["heading", "text", "button"]);
});

it("allows only FAQ item blocks", () => {
  expect(getSectionDefinition("faq")?.allowedBlockTypes).toEqual(["faq-item"]);
});

it("rejects sections placed on unsupported pages", () => {
  const issues = validateSectionAgainstRegistry(section("product-information"), "home");

  expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "SECTION_NOT_ALLOWED_ON_PAGE" })]));
});

it("rejects blocks that the section does not allow", () => {
  const issues = validateSectionAgainstRegistry(section("hero", [{ id: "block-1", type: "faq-item", enabled: true, settings: {} }]), "home");

  expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "BLOCK_NOT_ALLOWED" })]));
});

it("accepts declared mobile overrides and rejects undeclared ones", () => {
  const accepted = section("hero");
  accepted.responsive = { mobile: { contentAlignment: "center" } };
  const rejected = section("hero");
  rejected.responsive = { mobile: { backgroundColor: "#000000" } };

  expect(validateSectionAgainstRegistry(accepted, "home")).toEqual([]);
  expect(validateSectionAgainstRegistry(rejected, "home")).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: "RESPONSIVE_FIELD_NOT_ALLOWED", field: "backgroundColor" })
  ]));
});
