import { expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { getSectionDefinition, listSectionDefinitions, listSectionDefinitionsForPage, validateSectionAgainstRegistry } from "./index";

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

it("registers the complete ecommerce section catalog", () => {
  expect(listSectionDefinitions().map((definition) => definition.type)).toEqual(expect.arrayContaining([
    "cart-summary", "search-results", "not-found-message", "journal-teaser", "trust-strip", "image-mosaic",
  ]));

  expect(validateSectionAgainstRegistry(section("cart-summary"), "cart")).toEqual([]);
  expect(validateSectionAgainstRegistry(section("search-results"), "search")).toEqual([]);
  expect(validateSectionAgainstRegistry(section("not-found-message"), "not-found")).toEqual([]);
});

it("registers Product merchandising sections only for Product templates", () => {
  const productSections = ["product-gallery", "product-information", "product-options", "product-purchase", "product-description", "related-products"];

  expect(listSectionDefinitions().map((definition) => definition.type)).toEqual(expect.arrayContaining(productSections));
  for (const type of productSections) {
    expect(validateSectionAgainstRegistry(section(type), "product")).toEqual([]);
    expect(validateSectionAgainstRegistry(section(type), "collection")).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "SECTION_NOT_ALLOWED_ON_PAGE" }),
    ]));
    expect(getSectionDefinition(type)?.controls.length).toBeGreaterThan(0);
  }
});

it("registers configurable Collection sections only for Collection templates", () => {
  const types = ["collection-header", "collection-product-grid", "collection-description"];
  for (const type of types) {
    const definition = getSectionDefinition(type);
    expect(definition?.controls.length).toBeGreaterThan(0);
    expect(validateSectionAgainstRegistry(section(type), "collection")).toEqual([]);
    expect(validateSectionAgainstRegistry(section(type), "product")).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "SECTION_NOT_ALLOWED_ON_PAGE" }),
    ]));
  }
  expect(getSectionDefinition("collection-header")?.controls.map(({ key }) => key)).toEqual(["showTitle", "showDescription", "showImage"]);
  expect(getSectionDefinition("collection-product-grid")?.defaultSettings).toMatchObject({ columns: 3, limit: 12 });
  expect(getSectionDefinition("collection-description")?.defaultSettings).toMatchObject({ spacing: "standard" });
});

it("allows page content only on a custom Page template", () => {
  expect(validateSectionAgainstRegistry(section("page-content"), "page" as never)).toEqual([]);
  expect(validateSectionAgainstRegistry(section("page-content"), "home")).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: "SECTION_NOT_ALLOWED_ON_PAGE" }),
  ]));
});

it("allows Blog sections only on Blog templates", () => {
  expect(validateSectionAgainstRegistry(section("blog-header"), "blog")).toEqual([]);
  expect(validateSectionAgainstRegistry(section("article-list"), "blog")).toEqual([]);
  expect(validateSectionAgainstRegistry(section("article-list"), "page")).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: "SECTION_NOT_ALLOWED_ON_PAGE" }),
  ]));
});

it("allows Article sections only on Article templates", () => {
  expect(validateSectionAgainstRegistry(section("article-header"), "article")).toEqual([]);
  expect(validateSectionAgainstRegistry(section("article-content"), "article")).toEqual([]);
  expect(validateSectionAgainstRegistry(section("article-content"), "blog")).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: "SECTION_NOT_ALLOWED_ON_PAGE" }),
  ]));
});

it("makes rich text reusable on compatible content templates only", () => {
  const richText = section("rich-text", [{ id: "story", type: "text", enabled: true, settings: { text: "Our story" } }]);
  richText.settings = { alignment: "center" };

  for (const pageType of ["home", "product", "collection", "page", "blog", "article"] as const) {
    expect(validateSectionAgainstRegistry(richText, pageType)).toEqual([]);
  }
  for (const pageType of ["search", "cart", "not-found"] as const) {
    expect(validateSectionAgainstRegistry(richText, pageType)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "SECTION_NOT_ALLOWED_ON_PAGE" }),
    ]));
  }
  expect(getSectionDefinition("rich-text")?.settingsSchema.parse(richText.settings)).toEqual({ alignment: "center" });
});

it("accepts structured rich text and rejects unsupported document content", () => {
  const richText = section("rich-text");
  richText.settings.document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Safe" }] }] };
  expect(validateSectionAgainstRegistry(richText, "article")).toEqual([]);

  richText.settings.document = { type: "doc", content: [{ type: "script", attrs: { src: "https://example.com/x.js" } }] };
  expect(validateSectionAgainstRegistry(richText, "article")).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: "SETTINGS_INVALID" }),
  ]));

  richText.settings.document = { type: "doc", content: [{ type: "paragraph", content: [
    { type: "text", text: "Click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
  ] }] };
  expect(validateSectionAgainstRegistry(richText, "article")).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: "SETTINGS_INVALID" }),
  ]));
});

it("supplies Add Section options from page and region compatibility", () => {
  expect(listSectionDefinitionsForPage("article").map(({ type }) => type)).toContain("rich-text");
  expect(listSectionDefinitionsForPage("article").map(({ type }) => type)).not.toContain("article-list");
  expect(listSectionDefinitionsForPage("article").map(({ type }) => type)).not.toContain("product-information");
  expect(listSectionDefinitionsForPage("article", "header").map(({ type }) => type)).not.toContain("rich-text");
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

it("accepts a dynamic binding in a control that declares a compatible dynamic type", () => {
  const hero = section("hero", [{
    id: "heading-1",
    type: "heading",
    enabled: true,
    settings: {
      text: {
        kind: "dynamic",
        binding: { kind: "resource_field", resource: "store", field: "name" },
        fallback: "Fallback heading",
      },
    },
  }]);

  expect(validateSectionAgainstRegistry(hero, "home")).toEqual([]);
});
