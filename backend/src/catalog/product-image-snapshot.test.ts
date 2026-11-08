import { afterEach, describe, expect, it, vi } from "vitest";
import { productImageSnapshot } from "./product-image-snapshot.js";

const options = [{ id: "colour", name: "Colour", type: "variant" as const, required: false, values: [{ id: "black", label: "Black" }, { id: "white", label: "White" }] }];
const media = [{ id: "shared", url: "shared.jpg" }, { id: "black", url: "black.jpg", appliesTo: { colour: ["black"] } }, { id: "white", url: "white.jpg", appliesTo: { colour: ["white"] } }];
afterEach(() => vi.unstubAllEnvs());
describe("configured line image snapshots", () => {
  it("keeps the cover for stores outside the rollout", () => {
    vi.stubEnv("PRODUCT_MEDIA_STORE_IDS", "other");
    expect(productImageSnapshot("store", media, options, [{ optionId: "colour", valueId: "white" }])).toBe("shared.jpg");
  });
  it("uses the actual selection and fills legacy selections from the chosen variant", () => {
    vi.stubEnv("PRODUCT_MEDIA_STORE_IDS", "store");
    expect(productImageSnapshot("store", media, options, [{ optionId: "colour", valueId: "white" }], { colour: "black" })).toBe("white.jpg");
    expect(productImageSnapshot("store", media, options, [], { colour: "black" })).toBe("black.jpg");
  });
});
