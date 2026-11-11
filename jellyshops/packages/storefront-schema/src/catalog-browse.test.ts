import { describe, expect, it } from "vitest";
import { browseCatalog, normalizeCatalogQuery, productFilterValues, type BrowsableProduct } from "./catalog-browse.js";

describe("productFilterValues", () => {
  it("joins options, Name:Value tags, brand and type, keeping the first spelling", () => {
    expect(productFilterValues({
      options: [{ name: "Size", values: [{ label: "King" }, { label: "king" }, { label: "Double" }] }, { name: "Colour", values: ["Grey"] }],
      tags: ["Fabric:Velvet", "fabric: Boucle", "label:Bestseller", "sale", ":empty"],
      vendor: "Hush", productType: "Bed",
    })).toEqual([
      { name: "Size", values: ["King", "Double"] },
      { name: "Colour", values: ["Grey"] },
      { name: "Fabric", values: ["Velvet", "Boucle"] },
      { name: "Brand", values: ["Hush"] },
      { name: "Type", values: ["Bed"] },
    ]);
  });

  it("reads older products' variant choices, skipping internal ids", () => {
    expect(productFilterValues({ variantOptions: [{ size: "Large" }, { size: "Small", "option-1234abcd-ef": "x" }] })).toEqual([{ name: "Size", values: ["Large", "Small"] }]);
  });
});

describe("browseCatalog", () => {
  const product = (name: string, priceMinor: number, filters: BrowsableProduct["filters"], available = true): BrowsableProduct => ({ name, priceMinor, available, filters });
  const list = [
    product("Cleo", 30000, [{ name: "Size", values: ["King"] }]),
    product("Ascot", 10000, [{ name: "Size", values: ["Double"] }], false),
    product("Bowen", 20000, [{ name: "Size", values: ["Double", "King"] }]),
  ];

  it("pages and sorts", () => {
    const page = browseCatalog(list, (item) => item, { sort: "name-asc", limit: 2, offset: 1 });
    expect(page.items.map((item) => item.name)).toEqual(["Bowen", "Cleo"]);
    expect(page.total).toBe(3);
    expect(page.filtered).toBe(false);
  });

  it("matches any chosen value of a filter, case-insensitively, with stock and price", () => {
    const page = browseCatalog(list, (item) => item, { filters: { Size: ["double"] }, inStock: true, maxPriceMinor: 25000 });
    expect(page.items.map((item) => item.name)).toEqual(["Bowen"]);
    expect(page.facets[0].values).toEqual([{ value: "King", count: 1, selected: false }, { value: "Double", count: 1, selected: true }]);
  });

  it("cleans odd queries", () => {
    const query = normalizeCatalogQuery({ sort: "random" as never, limit: 5000, offset: -3, minPriceMinor: -1, filters: { " Size ": ["", "King", "King"] } });
    expect(query).toMatchObject({ sort: "featured", limit: 48, offset: 0, minPriceMinor: undefined, filters: { size: ["King"] } });
  });
});
