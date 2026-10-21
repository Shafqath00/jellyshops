import { describe, expect, it } from "vitest";
import { getV4StarterPack, listV4StarterPacks } from "./v4-starter-packs";

const requiredPageTypes = ["home", "product", "collection", "cart", "search", "page", "blog", "article", "not-found"];

describe("V4 starter packs", () => {
  it("provides versioned Fresh Market and Artisan Boutique definitions with every default page", () => {
    const packs = listV4StarterPacks();

    expect(packs.map(({ id }) => id)).toEqual(["jelly-signature", "fresh-market", "artisan-boutique"]);
    for (const pack of packs.filter(({ id }) => id !== "jelly-signature")) {
      expect(pack.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(pack.templates.map(({ type }) => type).sort()).toEqual([...requiredPageTypes].sort());
      expect(pack.templates.every(({ handle }) => handle === "default")).toBe(true);
    }
    const signature = getV4StarterPack("jelly-signature");
    expect(signature.templates).toHaveLength(19);
    expect(signature.templates.map(({ type }) => type)).toEqual(expect.arrayContaining([
      ...requiredPageTypes, "checkout", "wishlist", "customer-login", "customer-register", "customer-recovery", "customer-account", "customer-orders", "customer-order", "customer-addresses", "order-success",
    ]));
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

  it("pins the Fresh Market section composition and single shared chrome placements", () => {
    const pack = getV4StarterPack("fresh-market");
    const composition = Object.fromEntries(pack.templates.map((template) => [
      template.type,
      template.layout.sections.map((placement) => placement.kind === "global"
        ? placement.globalSectionId.replace("fresh-market-global-", "global:").replace("-section", "")
        : placement.section.type),
    ]));

    expect(composition).toEqual({
      home: ["global:announcement", "global:header", "hero", "product-grid", "image-with-text", "global:footer"],
      product: ["global:header", "product-gallery", "product-information", "product-options", "product-purchase", "product-description", "related-products", "global:footer"],
      collection: ["global:header", "collection-header", "collection-product-grid", "collection-description", "global:footer"],
      cart: ["global:header", "cart-summary", "global:footer"],
      search: ["global:header", "search-results", "global:footer"],
      page: ["global:header", "page-content", "global:footer"],
      blog: ["global:header", "blog-header", "article-list", "global:footer"],
      article: ["global:header", "article-header", "article-content", "global:footer"],
      "not-found": ["global:header", "not-found-message", "global:footer"],
    });

    for (const template of pack.templates) {
      const globals = template.layout.sections
        .filter((placement) => placement.kind === "global")
        .map((placement) => placement.globalSectionId);
      expect(globals.filter((id) => id === "fresh-market-global-header-section")).toHaveLength(1);
      expect(globals.filter((id) => id === "fresh-market-global-footer-section")).toHaveLength(1);
      expect(globals.filter((id) => id === "fresh-market-global-announcement-section")).toHaveLength(template.type === "home" ? 1 : 0);
    }
  });

  it("keeps Artisan Boutique's page IDs and merchant-facing copy unchanged", () => {
    const pack = getV4StarterPack("artisan-boutique");

    expect(pack.templates.map(({ key, type, name }) => ({ key, type, name }))).toEqual(requiredPageTypes.map((type) => ({
      key: `artisan-boutique-template-${type}`,
      type,
      name: type === "not-found" ? "Not Found" : type[0]!.toUpperCase() + type.slice(1),
    })));
    expect(pack.globalSections.find(({ key }) => key === "announcement")?.section.blocks[0]?.settings)
      .toMatchObject({ text: "Thoughtful finds, made to last." });
    expect(pack.templates.find(({ type }) => type === "home")?.layout.sections
      .filter((placement) => placement.kind === "inline")
      .map((placement) => placement.kind === "inline" ? placement.section.type : ""))
      .toEqual(["hero", "image-with-text", "product-grid"]);
    expect(pack.templates.find(({ type }) => type === "not-found")?.layout.sections
      .flatMap((placement) => placement.kind === "inline" ? placement.section.blocks : [])
      .map(({ settings }) => settings.text ?? settings.label))
      .toEqual(["This page has moved on.", "Return to the shop and discover something new.", "Back to the shop"]);
  });

  it("returns independent copies so callers cannot mutate the bundled definition", () => {
    const first = getV4StarterPack("fresh-market");
    first.name = "Modified by caller";

    expect(getV4StarterPack("fresh-market").name).toBe("Fresh Market");
  });
});
