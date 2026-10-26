import { describe, expect, it } from "vitest";
import { isRetainedTemplate, pickInitialTemplate, pickTemplateForType } from "./template-selection";

const template = (id: string, type: string, handle: string) => ({ id, type, handle });
// Oldest first, as the API returns them: the previous template's home page comes before the new one.
const afterReplacing = [
  template("old-home", "home", "previous-1a2b3c"),
  template("old-product", "product", "previous-1a2b3c"),
  template("new-home", "home", "default"),
  template("new-product", "product", "default"),
];

describe("template selection after replacing a template", () => {
  it("opens the active template for a page type, not the oldest one", () => {
    expect(pickTemplateForType(afterReplacing, "home")?.id).toBe("new-home");
    expect(pickTemplateForType(afterReplacing, "product")?.id).toBe("new-product");
    expect(pickInitialTemplate(afterReplacing)?.id).toBe("new-home");
  });

  it("recognises retained templates by their handle", () => {
    expect(afterReplacing.map(isRetainedTemplate)).toEqual([true, true, false, false]);
  });

  it("prefers the default handle over other current templates, and a current one over a retained one", () => {
    const templates = [template("custom", "home", "summer"), template("main", "home", "default"), template("old", "home", "previous-x")];
    expect(pickTemplateForType(templates, "home")?.id).toBe("main");
    expect(pickTemplateForType(templates.filter((entry) => entry.id !== "main"), "home")?.id).toBe("custom");
  });

  it("falls back to the newest retained template when nothing else exists, and to undefined for an unknown type", () => {
    const onlyRetained = [template("older", "home", "previous-a"), template("newer", "home", "previous-b")];
    expect(pickTemplateForType(onlyRetained, "home")?.id).toBe("newer");
    expect(pickTemplateForType(afterReplacing, "blog")).toBeUndefined();
    expect(pickInitialTemplate([])).toBeUndefined();
  });

  it("opens any current template first when there is no home page", () => {
    const templates = [template("old", "product", "previous-a"), template("cart", "cart", "default")];
    expect(pickInitialTemplate(templates)?.id).toBe("cart");
  });
});
