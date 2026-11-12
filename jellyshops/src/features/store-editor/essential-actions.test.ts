import { describe, expect, it } from "vitest";
import { availableActions, essentialActionProblem } from "./selection-actions";

const inline = (id: string, type: string, blocks: unknown[] = [], enabled = true) => ({ kind: "inline", section: { id, type, enabled, settings: {}, blocks } });

describe("editor actions keep each page working", () => {
  const collection = { sections: [{ kind: "global", globalSectionId: "header" }, inline("banner", "collection-header"), inline("grid", "collection-product-grid")] };

  it("greys out delete and hide on the page's last essential section, not on others", () => {
    expect(availableActions(collection, { sectionId: "grid" }, "collection")).toMatchObject({ remove: false, toggle: false, duplicate: true });
    expect(availableActions(collection, { sectionId: "banner" }, "collection")).toMatchObject({ remove: true, toggle: true });
    expect(essentialActionProblem(collection, { sectionId: "grid" }, "remove", "collection")).toMatch(/product grid/);
  });

  it("allows it again when a second copy keeps the page working, and always allows showing a hidden section", () => {
    const twoGrids = { sections: [...collection.sections, inline("grid-2", "collection-product-grid")] };
    expect(availableActions(twoGrids, { sectionId: "grid" }, "collection").remove).toBe(true);
    const hidden = { sections: [inline("grid", "collection-product-grid", [], false)] };
    expect(essentialActionProblem(hidden, { sectionId: "grid" }, "toggle", "collection")).toBeNull();
  });

  it("protects the Add to cart part inside Main product", () => {
    const product = { sections: [inline("main", "main-product", [{ id: "info", type: "part-product-information", enabled: true, settings: {} }, { id: "buy", type: "part-product-purchase", enabled: true, settings: {} }])] };
    expect(availableActions(product, { sectionId: "main", blockId: "buy" }, "product")).toMatchObject({ remove: false, toggle: false });
    expect(availableActions(product, { sectionId: "main", blockId: "info" }, "product")).toMatchObject({ remove: true, toggle: true });
    expect(availableActions(product, { sectionId: "main" }, "product")).toMatchObject({ remove: false });
  });
});
