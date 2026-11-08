import { describe, expect, it } from "vitest";
import { isEditablePageType, pagePickerButtonLabel, pagePickerGroups, pagePickerTemplateLabel } from "./page-picker-groups";

// Oldest first, as the API returns them.
const templates = [
  { id: "home-old-1", type: "home", handle: "previous-aaa", name: "Home" },
  { id: "home-old-2", type: "home", handle: "previous-bbb", name: "Home" },
  { id: "home", type: "home", handle: "default", name: "Home" },
  { id: "product", type: "product", handle: "default", name: "Default product" },
  { id: "mattress", type: "product", handle: "mattress", name: "Mattress page" },
  { id: "checkout", type: "checkout", handle: "default", name: "Default Checkout" },
];

describe("page picker groups", () => {
  it("lists only pages the live store builds from sections", () => {
    const types = pagePickerGroups(templates).map((group) => group.type);
    expect(types).toEqual(["home", "product", "collection", "page", "blog", "article", "cart", "search", "not-found"]);
    expect(isEditablePageType("checkout")).toBe(false);
    expect(isEditablePageType("customer-login")).toBe(false);
  });

  it("keeps earlier versions apart from the live template, newest first", () => {
    const home = pagePickerGroups(templates).find((group) => group.type === "home")!;
    expect(home.current.map((item) => item.id)).toEqual(["home"]);
    expect(home.older.map((item) => item.id)).toEqual(["home-old-2", "home-old-1"]);
  });

  it("puts the main template first and finds templates by name", () => {
    expect(pagePickerGroups(templates).find((group) => group.type === "product")!.current.map((item) => item.id)).toEqual(["product", "mattress"]);
    const found = pagePickerGroups(templates, "mattress");
    expect(found.map((group) => group.type)).toEqual(["product"]);
    expect(found[0].current.map((item) => item.id)).toEqual(["mattress"]);
  });

  it("names templates in plain words", () => {
    expect(pagePickerTemplateLabel(templates[2])).toBe("Default");
    expect(pagePickerTemplateLabel(templates[4])).toBe("Mattress page");
    expect(pagePickerTemplateLabel(templates[0], 1)).toBe("Earlier version 2");
    expect(pagePickerButtonLabel(templates[2])).toBe("Home page");
    expect(pagePickerButtonLabel(templates[4])).toBe("Product pages · Mattress page");
    expect(pagePickerButtonLabel(templates[0])).toBe("Home page · earlier version");
  });
});
