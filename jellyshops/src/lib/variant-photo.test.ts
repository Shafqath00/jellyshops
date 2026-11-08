import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "./domain";
import { cartProductImage, productGallery, withVariantPhotoFirst } from "./product-media";

afterEach(() => vi.unstubAllEnvs());

const media = [{ id: "front", url: "/front.jpg" }, { id: "king", url: "/king.jpg", appliesTo: { size: ["k"] } }, { id: "side", url: "/side.jpg" }];
const options = [{ id: "size", name: "Size", type: "variant", required: true, position: 0, values: [{ id: "s", label: "S", position: 0 }, { id: "k", label: "King", position: 1 }] }];
const product = (variantExtra: Record<string, unknown> = {}) => ({
  id: "bed", storeId: "store", imageUrl: "/front.jpg", media, options, inventoryOptionIds: ["size"],
  variants: [
    { id: "v-s", name: "S", sku: "", priceMinor: 1, stock: 1, options: { size: "s" } },
    { id: "v-k", name: "King", sku: "", priceMinor: 2, stock: 1, options: { size: "k" }, ...variantExtra },
  ],
}) as unknown as Product;
const king = [{ optionId: "size", valueId: "k" }];

describe("withVariantPhotoFirst", () => {
  it("moves the chosen photo to the front without duplicating it", () => {
    expect(withVariantPhotoFirst(media, media, { mediaId: "side" }).map((photo) => photo.id)).toEqual(["side", "front", "king"]);
    expect(withVariantPhotoFirst([media[1]], media, { mediaId: "side" }).map((photo) => photo.id)).toEqual(["side", "king"]);
  });
  it("changes nothing without a choice, or when the photo is gone", () => {
    expect(withVariantPhotoFirst(media, media, undefined)).toBe(media);
    expect(withVariantPhotoFirst(media, media, {})).toBe(media);
    expect(withVariantPhotoFirst(media, media, { mediaId: "deleted" })).toBe(media);
  });
});

describe("the storefront gallery", () => {
  it("puts the combination's own photo first, ahead of the choice-based photos", () => {
    vi.stubEnv("NEXT_PUBLIC_PRODUCT_MEDIA_STORE_IDS", "store");
    expect(productGallery(product(), king).map((photo) => photo.id)[0]).toBe("king");
    expect(productGallery(product({ mediaId: "side" }), king).map((photo) => photo.id)[0]).toBe("side");
  });
  it("applies the photo even when photo tagging is not enabled for the store", () => {
    expect(productGallery(product({ mediaId: "side" }), king).map((photo) => photo.id)[0]).toBe("side");
  });
  it("does not affect other combinations", () => {
    vi.stubEnv("NEXT_PUBLIC_PRODUCT_MEDIA_STORE_IDS", "store");
    expect(productGallery(product({ mediaId: "side" }), [{ optionId: "size", valueId: "s" }])[0].id).not.toBe("side");
  });
  it("shows the combination's photo in the cart", () => {
    const item = product({ mediaId: "side" });
    expect(cartProductImage(item, item.variants[1])).toBe("/side.jpg");
  });
});
