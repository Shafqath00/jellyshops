import { expect, it } from "vitest";
import type { CatalogAdminProduct } from "./api/types";
import { templateStoreCommerce, templateStoreLogo, templateStoreProducts } from "./template-store-data";

const node = (id: string, status: CatalogAdminProduct["status"]): CatalogAdminProduct => ({
  id, storeId: "s1", handle: id, title: `Product ${id}`, description: "", productType: null, status, available: true,
  media: [{ id: "m1", url: `https://cdn.example.com/${id}.jpg`, altText: null, position: 0 }],
  variants: [{ id: `${id}-v`, sku: "", title: "Default", priceMinor: 1800, inventoryQuantity: 3, available: true } as never],
});

it("turns the store's active products into product cards for the design preview", () => {
  const products = templateStoreProducts([node("a", "ACTIVE"), node("b", "DRAFT"), node("c", "ARCHIVED")], "moss", "GBP");
  expect(products.map((product) => product.name)).toEqual(["Product a"]);
  expect(products[0]).toMatchObject({ href: "/moss/products/a", imageUrl: "https://cdn.example.com/a.jpg" });
  expect(products[0].price).toContain("18.00");
});

it("reads a usable logo from the theme settings", () => {
  expect(templateStoreLogo({ branding: { logoUrl: "https://cdn.example.com/logo.png" } })).toBe("https://cdn.example.com/logo.png");
  expect(templateStoreLogo({ branding: { logoUrl: "javascript:alert(1)" } })).toBeUndefined();
  expect(templateStoreLogo(undefined)).toBeUndefined();
});

it("serves the store's products to the preview's product lists", async () => {
  const commerce = templateStoreCommerce([{ id: "1", name: "A", href: "#", imageUrl: "", price: "£1" }, { id: "2", name: "B", href: "#", imageUrl: "", price: "£2" }]);
  expect((await commerce.getProducts({ limit: 1 })).map((product) => product.id)).toEqual(["1"]);
  expect(await commerce.getProducts()).toHaveLength(2);
});
