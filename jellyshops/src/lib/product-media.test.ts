import { afterEach, expect, it, vi } from "vitest";
import type { Product } from "./domain";
import { cartProductImage } from "./product-media";

afterEach(() => vi.unstubAllEnvs());
it("cart resolves variant colour when a legacy cart has no explicit selections", () => {
  vi.stubEnv("NEXT_PUBLIC_PRODUCT_MEDIA_STORE_IDS", "store");
  const product = { id: "shirt", storeId: "store", imageUrl: "/white.jpg", media: [{ id: "white", url: "/white.jpg", appliesTo: { colour: ["white"] } }, { id: "black", url: "/black.jpg", appliesTo: { colour: ["black"] } }], options: [{ id: "colour", name: "Colour", type: "variant", required: true, values: [{ id: "white", label: "White" }, { id: "black", label: "Black" }] }] } as unknown as Product;
  const variant = { id: "black-medium", options: { colour: "black" } } as unknown as Product["variants"][number];
  expect(cartProductImage(product, variant)).toBe("/black.jpg");
  vi.stubEnv("NEXT_PUBLIC_PRODUCT_MEDIA_STORE_IDS", "other");
  expect(cartProductImage(product, variant)).toBe("/white.jpg");
});
