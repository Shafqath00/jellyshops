import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { titleLength } from "@jelly/storefront-renderer";
import { jellyHaloPreview } from "./configs";
import { MESSY_PRODUCTS, messyPreviewConfig } from "./messy-data";

const publicFile = (url: string) => join(__dirname, "../../../public", url);

describe("messy sample data", () => {
  const messy = messyPreviewConfig(jellyHaloPreview);

  it("keeps the theme's own look and copy, and replaces only the store data", () => {
    expect(messy.themeId).toBe("jelly-halo");
    expect(messy.guide).toBe(jellyHaloPreview.guide);
    expect(messy.products).toBe(MESSY_PRODUCTS);
  });

  it("covers the awkward cases merchants create", () => {
    const names = MESSY_PRODUCTS.map((product) => product.name);
    expect(Math.max(...names.map((name) => name.length))).toBeGreaterThan(80);
    expect(Math.min(...names.map((name) => name.length))).toBeLessThan(5);
    expect(names.some((name) => /\S{40,}/.test(name))).toBe(true);
    expect(MESSY_PRODUCTS.some((product) => !product.imageUrl)).toBe(true);
    expect(MESSY_PRODUCTS.some((product) => product.available === false)).toBe(true);
    expect(messy.product.media.length).toBeGreaterThanOrEqual(10);
    expect(messy.product.option?.values.length).toBeGreaterThanOrEqual(8);
  });

  it("only points at sample photos that exist (scripts/build-messy-fixtures.mjs)", () => {
    const urls = [...MESSY_PRODUCTS.map((product) => product.imageUrl).filter(Boolean), ...messy.product.media.map((photo) => photo.url), messy.collection.imageUrl];
    for (const url of urls) expect(existsSync(publicFile(url)), url).toBe(true);
  });
});

describe("title length marker", () => {
  it("marks long and very long titles only", () => {
    expect(titleLength("Linen tote")).toEqual({});
    expect(titleLength("A product name that is a little longer than most")).toEqual({ "data-title-length": "long" });
    expect(titleLength(MESSY_PRODUCTS[0].name)).toEqual({ "data-title-length": "very-long" });
    expect(titleLength(undefined)).toEqual({});
  });
});
