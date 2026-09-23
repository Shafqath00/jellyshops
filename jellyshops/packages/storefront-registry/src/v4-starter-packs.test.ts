import { describe, expect, it } from "vitest";
import { getV4StarterPack, listV4StarterPacks } from "./v4-starter-packs";

const requiredPageTypes = ["home", "product", "collection", "cart", "search", "page", "blog", "article", "not-found"];

describe("V4 starter packs", () => {
  it("provides versioned Fresh Market and Artisan Boutique definitions with every default page", () => {
    const packs = listV4StarterPacks();

    expect(packs.map(({ id }) => id)).toEqual(["fresh-market", "artisan-boutique"]);
    for (const pack of packs) {
      expect(pack.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(pack.templates.map(({ type }) => type).sort()).toEqual([...requiredPageTypes].sort());
      expect(pack.templates.every(({ handle }) => handle === "default")).toBe(true);
    }
  });

  it("uses unique stable pack-local keys and does not embed fake merchant resource IDs", () => {
    for (const pack of listV4StarterPacks()) {
      const allKeys = [
        ...pack.templates.map(({ key }) => key),
        ...pack.globalSections.map(({ key }) => key),
        ...pack.menus.map(({ key }) => key),
      ];
      expect(new Set(allKeys).size).toBe(allKeys.length);
      expect(pack.resourceReferences.every(({ initialResourceId, required }) => !required && initialResourceId === null)).toBe(true);
      expect(JSON.stringify(pack)).not.toMatch(/fruit-favorites|all-jellies/);
    }
  });

  it("gives the two starters different presentation settings and home composition", () => {
    const fresh = getV4StarterPack("fresh-market");
    const artisan = getV4StarterPack("artisan-boutique");

    expect(fresh.theme.themeId).not.toBe(artisan.theme.themeId);
    expect(fresh.templates.find(({ type }) => type === "home")?.layout)
      .not.toEqual(artisan.templates.find(({ type }) => type === "home")?.layout);
  });

  it("returns independent copies so callers cannot mutate the bundled definition", () => {
    const first = getV4StarterPack("fresh-market");
    first.name = "Modified by caller";

    expect(getV4StarterPack("fresh-market").name).toBe("Fresh Market");
  });
});
