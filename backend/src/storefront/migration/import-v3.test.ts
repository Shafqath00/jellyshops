import { describe, expect, it } from "vitest";
import { createDefaultStorefrontDocument, type StorefrontDocument } from "@jelly/storefront-schema";
import { buildV3ImportPlan } from "./import-v3.js";

function documentWithCustomPage(): StorefrontDocument {
  const document = createDefaultStorefrontDocument("store-a", "minimal");
  document.pages.push({
    id: "about-page",
    type: "custom",
    title: "About us",
    slug: "about-us",
    system: false,
    sections: [
      {
        id: "about-rich-text",
        type: "rich-text",
        enabled: true,
        settings: {},
        blocks: [],
      },
    ],
  });
  return document;
}

describe("buildV3ImportPlan", () => {
  it("preserves theme, header/footer sections, and Home layout ids", () => {
    const document = documentWithCustomPage();
    const plan = buildV3ImportPlan(document);

    expect(plan.workspaceGeneration).toBe(1);
    expect(plan.theme).toMatchObject({ themeId: "minimal", settings: document.theme.settings });
    expect(plan.globalSections).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: expect.objectContaining({ id: document.regions.header[0].id, type: "header" }) }),
      expect.objectContaining({ section: expect.objectContaining({ id: document.regions.footer[0].id, type: "footer" }) }),
    ]));

    const home = plan.templates.find(({ type }) => type === "home");
    expect(home?.handle).toBe("default");
    expect(home?.layout.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "inline", section: expect.objectContaining({ id: document.pages[0].sections[0].id }) }),
    ]));
  });

  it("converts a custom V3 page into content resource plus its own template assignment", () => {
    const plan = buildV3ImportPlan(documentWithCustomPage());
    const page = plan.pages.find(({ id }) => id === "about-page");
    const template = plan.templates.find(({ type, handle }) => type === "page" && handle === "about-us");

    expect(page).toMatchObject({ id: "about-page", title: "About us", handle: "about-us", status: "PUBLISHED" });
    expect(template?.layout.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "inline", section: expect.objectContaining({ id: "about-rich-text" }) }),
    ]));
    expect(plan.assignments).toContainEqual({
      resourceType: "page",
      resourceId: "about-page",
      templateId: template?.id,
    });
  });

  it("maps V3 product and collection system pages to default reusable templates", () => {
    const document = documentWithCustomPage();
    document.pages.push({ id: "product-system", type: "product", title: "Product", slug: "products", system: true, sections: [] });
    document.pages.push({ id: "collection-system", type: "collection", title: "Collection", slug: "shop", system: true, sections: [] });

    const plan = buildV3ImportPlan(document);
    expect(plan.templates).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "product", handle: "default" }),
      expect.objectContaining({ type: "collection", handle: "default" }),
    ]));
  });
});
