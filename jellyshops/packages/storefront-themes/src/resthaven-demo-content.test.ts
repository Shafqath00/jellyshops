import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The Resthaven demo store content pack (Phase 6): the catalogue a demo store is filled from. */
const folder = join(dirname(fileURLToPath(import.meta.url)), "themes", "jelly-resthaven");
interface DemoVariant { sku: string; options: Record<string, string>; priceMinor: number; stock: number }
interface DemoProduct { handle: string; title: string; type: string; collections: string[]; images: string[]; tags: string[]; options?: Array<{ name: string; values: string[] }>; variants: DemoVariant[]; specifications: Record<string, string>; compareAtPriceMinor?: number }
const pack = JSON.parse(readFileSync(join(folder, "demo-content.json"), "utf8")) as {
  currency: string; products: DemoProduct[]; collections: Array<{ handle: string; image: string }>;
  reviews: Array<{ product: string; rating: number }>; menus: Record<string, unknown[]>; pages: Array<{ handle: string; body: string[] }>;
};
const photo = (name: string) => existsSync(join(folder, "assets", `${name}.webp`));

describe("Resthaven demo content", () => {
  it("has at least 24 products, each with a photo of its own", () => {
    expect(pack.products.length).toBeGreaterThanOrEqual(24);
    const first = pack.products.map((product) => product.images[0]);
    expect(new Set(first).size).toBe(first.length);
    for (const product of pack.products) for (const image of product.images) expect(photo(image), `${product.handle}: ${image}.webp`).toBe(true);
    for (const collection of pack.collections) expect(photo(collection.image), collection.handle).toBe(true);
  });

  it("has unique handles and SKUs, sensible prices and a variant for every option value", () => {
    const handles = pack.products.map((product) => product.handle);
    expect(new Set(handles).size).toBe(handles.length);
    const skus = pack.products.flatMap((product) => product.variants.map((variant) => variant.sku));
    expect(new Set(skus).size).toBe(skus.length);
    for (const product of pack.products) {
      for (const variant of product.variants) expect(variant.priceMinor, product.handle).toBeGreaterThan(0);
      if (product.compareAtPriceMinor) expect(product.compareAtPriceMinor).toBeGreaterThan(Math.min(...product.variants.map((variant) => variant.priceMinor)));
      for (const option of product.options ?? []) expect(option.values.slice().sort(), product.handle).toEqual(product.variants.map((variant) => variant.options[option.name]).sort());
    }
  });

  it("puts every product in a real collection, reviews on real products, and discounted products in Sale", () => {
    const collections = new Set(pack.collections.map((collection) => collection.handle));
    for (const product of pack.products) for (const handle of product.collections) expect(collections.has(handle), `${product.handle} -> ${handle}`).toBe(true);
    const handles = new Set(pack.products.map((product) => product.handle));
    for (const review of pack.reviews) { expect(handles.has(review.product), review.product).toBe(true); expect(review.rating).toBeGreaterThanOrEqual(1); expect(review.rating).toBeLessThanOrEqual(5); }
    for (const product of pack.products) expect(product.collections.includes("sale"), product.handle).toBe(Boolean(product.compareAtPriceMinor));
  });

  it("links the two Harbour colours as one design and gives beds measurements per size", () => {
    const family = pack.products.filter((product) => product.tags.includes("family:harbour"));
    expect(family.map((product) => product.tags.find((tag) => tag.startsWith("Colour:")))).toEqual(["Colour:Oatmeal", "Colour:Sage"]);
    for (const bed of pack.products.filter((product) => product.type === "Bed")) {
      for (const size of bed.options?.[0]?.values ?? []) expect(bed.specifications[`${size} (W x L x H)`], `${bed.handle} ${size}`).toMatch(/^\d+ x \d+ x \d+ cm$/);
    }
  });

  it("has menus and information pages to install", () => {
    expect(pack.currency).toBe("GBP");
    expect(pack.menus.main.length).toBeGreaterThan(3);
    expect(pack.pages.map((page) => page.handle)).toEqual(expect.arrayContaining(["about", "delivery", "returns"]));
  });
});
