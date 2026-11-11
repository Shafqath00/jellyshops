import { expect, it } from "vitest";
import type { Product } from "@/lib/domain";
import { productFamily, productFamilyName } from "./product-family";

const bed = (id: string, name: string, tags: string[], over: Partial<Product> = {}) => ({
  id, storeId: "s", name, slug: id, tags, published: true, archived: false, imageUrl: `https://cdn.test/${id}.jpg`, variants: [], options: [], ...over,
}) as unknown as Product;

const natural = bed("ascot-natural", "Ascot bed - Natural", ["family:Ascot", "Colour:Natural"]);
const navy = bed("ascot-navy", "Ascot bed - Navy", ["Family: ascot"], { options: [{ id: "c", name: "Colour", position: 0, display: "color", values: [{ id: "n", label: "Navy", color: "#1f2a44" }] }] as unknown as Product["options"] });
const hidden = bed("ascot-grey", "Ascot bed - Grey", ["family:ascot"], { published: false });
const other = bed("bowen", "Bowen bed", ["family:bowen"]);
const otherStore = bed("ascot-x", "Ascot bed - X", ["family:ascot"], { storeId: "t" });

it("reads the family tag, ignoring case", () => {
  expect(productFamilyName(navy)).toBe("ascot");
  expect(productFamilyName(other)).toBe("bowen");
  expect(productFamilyName(bed("plain", "Plain", ["sale"]))).toBeUndefined();
});

it("links published products of the same family in this store, with colour names and swatches", () => {
  expect(productFamily(natural, [natural, navy, hidden, other, otherStore], "shop")).toEqual({ label: "Colour", members: [
    { id: "ascot-natural", label: "Natural", href: "/shop/products/ascot-natural", current: true, image: "https://cdn.test/ascot-natural.jpg" },
    { id: "ascot-navy", label: "Navy", href: "/shop/products/ascot-navy", current: false, color: "#1f2a44" },
  ] });
});

it("has no family when the product is alone or untagged", () => {
  expect(productFamily(other, [natural, other], "shop")).toBeUndefined();
  expect(productFamily(bed("plain", "Plain", []), [natural], "shop")).toBeUndefined();
});
