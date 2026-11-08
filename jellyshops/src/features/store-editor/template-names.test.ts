import { describe, expect, it } from "vitest";
import { isAssignableTemplateType, selectableTemplates, templateHandleFromName, withFreshSectionIds } from "./template-names";

const template = (id: string, type: string, handle: string, name: string) => ({ id, type, handle, name });

describe("template names", () => {
  it("makes a handle from the merchant's name that no other template of the type uses", () => {
    expect(templateHandleFromName("Mattress page", [])).toBe("mattress-page");
    expect(templateHandleFromName("  Lit d'enfant – Été  ", [])).toBe("lit-d-enfant-ete");
    expect(templateHandleFromName("Mattress", [{ handle: "mattress" }, { handle: "mattress-2" }])).toBe("mattress-3");
    expect(templateHandleFromName("!!!", [])).toBe("template");
  });

  it("never produces the main handle or the prefix kept for older store designs", () => {
    expect(templateHandleFromName("Default", [])).toBe("default-template");
    expect(templateHandleFromName("Previous sale", [])).toBe("previous-sale-template");
  });

  it("lists the main template first and leaves out templates from an older store design", () => {
    const listed = selectableTemplates([
      template("3", "product", "sofa", "Sofa"),
      template("1", "product", "previous-abc", "Product"),
      template("2", "product", "default", "Product"),
      template("4", "product", "bed", "Bed"),
      template("5", "collection", "default", "Collection"),
    ], "product");

    expect(listed.map(({ id }) => id)).toEqual(["2", "4", "3"]);
  });

  it("only offers extra templates for page types an item can choose", () => {
    expect(isAssignableTemplateType("product")).toBe(true);
    expect(isAssignableTemplateType("article")).toBe(true);
    expect(isAssignableTemplateType("cart")).toBe(false);
  });

  it("gives a new layout fresh section and block ids and keeps shared sections as they are", () => {
    let next = 0;
    const layout = withFreshSectionIds({
      sections: [
        { kind: "inline", section: { id: "product-gallery", type: "product-gallery", settings: { fit: "cover" }, blocks: [{ id: "b", type: "text", settings: {} }] } },
        { kind: "global", globalSectionId: "footer" },
      ],
    }, () => `id-${++next}`);

    expect(layout).toEqual({
      sections: [
        { kind: "inline", section: { id: "id-1", type: "product-gallery", settings: { fit: "cover" }, blocks: [{ id: "id-2", type: "text", settings: {} }] } },
        { kind: "global", globalSectionId: "footer" },
      ],
    });
  });
});
