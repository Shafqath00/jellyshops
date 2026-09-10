import { expect, it } from "vitest";
import { listSectionDefinitions } from "./registry";

it("exposes every inspector control discriminant", () => {
  const types = new Set(
    listSectionDefinitions().flatMap((section) => section.controls.map((control) => control.type)),
  );

  expect(types).toEqual(new Set([
    "text", "textarea", "rich-text", "number", "range", "select", "segmented",
    "checkbox", "color", "font", "spacing", "link", "image", "product", "collection",
  ]));
});

it("restricts home sections to their approved region", () => {
  const regions = Object.fromEntries(
    listSectionDefinitions().map((section) => [section.type, section.allowedRegions]),
  );

  expect(regions.header).toEqual(["header"]);
  expect(regions.footer).toEqual(["footer"]);
  expect(regions.hero).toEqual(["template"]);
});

it("registers the complete home-page section library", () => {
  expect(listSectionDefinitions().map(({ type }) => type)).toEqual(expect.arrayContaining([
    "announcement-bar", "header", "hero", "rich-text", "image-with-text",
    "featured-collection", "product-grid", "multicolumn", "newsletter",
    "spacer-divider", "footer",
  ]));
});
