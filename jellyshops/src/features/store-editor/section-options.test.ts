import { listSectionDefinitionsForPage } from "@jelly/storefront-registry";
import { expect, it } from "vitest";
import { createLibrarySection, sectionLibraryOptions } from "./section-options";

it("offers every designed preset in Add section, grouped by its category", () => {
  const options = sectionLibraryOptions(listSectionDefinitionsForPage("home", "template"));
  expect(options.find((option) => option.id === "category-grid-bento")).toEqual({ id: "category-grid-bento", name: "Collection list: Bento", category: "Products", description: expect.any(String), thumbnail: "bento" });
  expect(options.find((option) => option.id === "hero-overlay")).toMatchObject({ category: "Banners", thumbnail: "overlay" });
  // Sections without presets are still offered as themselves.
  expect(options.find((option) => option.id === "spacer")).toMatchObject({ name: expect.any(String) });
  expect(new Set(options.map((option) => option.id)).size).toBe(options.length);
});

it("creates the preset's design for a preset id and the section's defaults otherwise", () => {
  let n = 0;
  const createId = () => `n${++n}`;
  expect(createLibrarySection("category-grid-carousel", createId).settings).toMatchObject({ layout: "carousel" });
  expect(createLibrarySection("spacer", createId)).toMatchObject({ type: "spacer" });
});
