import { describe, expect, it } from "vitest";
import { searchTemplateHasToolbar } from "./search-template";

const snapshot = (settings: Record<string, unknown>) => ({
  templateDefaults: { search: "t-search" },
  templates: { "t-search": { id: "t-search", type: "search" as const, handle: "default", layout: { sections: [{ id: "s1", type: "search-results", settings }] } } },
});

describe("searchTemplateHasToolbar", () => {
  it("is true only when the search results section lets shoppers sort or filter", () => {
    expect(searchTemplateHasToolbar(snapshot({ showSort: true }))).toBe(true);
    expect(searchTemplateHasToolbar(snapshot({ showFilters: true }))).toBe(true);
    expect(searchTemplateHasToolbar(snapshot({}))).toBe(false);
    expect(searchTemplateHasToolbar({ templateDefaults: {}, templates: {} })).toBe(false);
  });
});
