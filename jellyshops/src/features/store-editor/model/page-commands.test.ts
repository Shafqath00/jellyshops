import { expect, it } from "vitest";
import { createDefaultStorefrontDocument, createStorefrontTemplate, type StorefrontPage } from "@jelly/storefront-schema";
import { applyCommand } from "./commands";

function storyPage(): StorefrontPage {
  return {
    id: "page-story",
    type: "custom",
    title: "Our story",
    slug: "our-story",
    system: false,
    sections: [],
  };
}

it("adds a custom page to the storefront document", () => {
  const document = createDefaultStorefrontDocument("store-demo");
  const updated = applyCommand(document, {
    type: "add-page",
    page: storyPage(),
  } as never);

  expect(updated.pages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "page-story", slug: "our-story" }),
    ]),
  );
});

it("does not remove a protected system page", () => {
  const document = createDefaultStorefrontDocument("store-demo");
  const home = document.pages.find((page) => page.type === "home")!;

  expect(() =>
    applyCommand(document, {
      type: "remove-page",
      pageId: home.id,
    } as never),
  ).toThrow("System pages cannot be removed");
});

it("replaces the editable document with a selected starter template", () => {
  const document = createDefaultStorefrontDocument("store-demo");
  const bakes = createStorefrontTemplate("bakes", "store-demo");

  const updated = applyCommand(document, {
    type: "replace-document",
    document: bakes,
  } as never);

  expect(updated.theme.presetId).toBe("elegant");
  expect(updated.pages[0].sections.map(({ type }) => type)).toContain("newsletter");
});
