import { describe, expect, it } from "vitest";
import { rankSuggestions } from "./product-suggestions";

const items = [
  { name: "Classic oak bed", vendor: "Northwood", tags: ["bedroom"] },
  { name: "Bedside table" },
  { name: "Sofa bed", category: "Sofas" },
  { name: "Crème throw", vendor: "Loom" },
];
const names = (query: string, limit = 5) => rankSuggestions(items, query, limit).map((item) => item.name);

describe("rankSuggestions", () => {
  it("puts names that start with the query first, then names with a word starting with it", () => {
    expect(names("bed")).toEqual(["Bedside table", "Classic oak bed", "Sofa bed"]);
  });
  it("needs every word to match, in the name, brand, category or tags", () => {
    expect(names("oak northwood")).toEqual(["Classic oak bed"]);
    expect(names("sofas")).toEqual(["Sofa bed"]);
    expect(names("oak loom")).toEqual([]);
  });
  it("ignores case and accents, and respects the limit", () => {
    expect(names("CREME")).toEqual(["Crème throw"]);
    expect(names("bed", 1)).toEqual(["Bedside table"]);
    expect(names("   ")).toEqual([]);
  });
});
