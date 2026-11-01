import { describe, expect, it, vi } from "vitest";
import type { CatalogReader } from "../catalog/service.js";
import { validateCart } from "./checkout-cart.js";
import type { CommerceRepository } from "./repository.js";

function deps(variant: Record<string, unknown>, media: unknown[] = []): Parameters<typeof validateCart>[0] {
  const variants: Record<string, unknown> = { v1: { id: "v1", productId: "p1", title: "King", sku: "K1", priceMinor: 20000, options: {}, available: true, sellable: true, ...variant } };
  const catalog = {
    getVariant: async (_store: string, id: string) => variants[id] ?? null,
    getProduct: async () => ({ id: "p1", title: "Bed", options: [], media }),
  } as unknown as CatalogReader;
  return { catalog, repository: {} as CommerceRepository };
}
const run = (dependencies: Parameters<typeof validateCart>[0]) => validateCart(dependencies, "store", "INR", [{ variantId: "v1", quantity: 1, configurationSelections: [] }], 0);

describe("checkout rules for a combination", () => {
  it("accepts a combination that is being sold", async () => {
    expect((await run(deps({}))).lines).toHaveLength(1);
  });

  it("refuses a combination the merchant has stopped selling, even when it has stock", async () => {
    await expect(run(deps({ sellable: false, available: false }))).rejects.toMatchObject({ status: 409, code: "VARIANT_UNAVAILABLE" });
    await expect(run(deps({ sellable: false, available: true }))).rejects.toMatchObject({ status: 409, code: "VARIANT_UNAVAILABLE" });
  });

  it("still reports an ordinary sold-out combination as out of stock", async () => {
    await expect(run(deps({ available: false }))).rejects.toMatchObject({ status: 409, code: "OUT_OF_STOCK" });
  });

  it("uses the combination's own photo for the order line image", async () => {
    vi.stubEnv("PRODUCT_MEDIA_STORE_IDS", "store");
    try {
      const media = [{ id: "front", url: "front.jpg" }, { id: "king", url: "king.jpg" }];
      expect((await run(deps({ mediaId: "king" }, media))).lines[0].imageSnapshot).toBe("king.jpg");
      expect((await run(deps({ mediaId: null }, media))).lines[0].imageSnapshot).toBe("front.jpg");
      expect((await run(deps({ mediaId: "removed" }, media))).lines[0].imageSnapshot).toBe("front.jpg");
    } finally { vi.unstubAllEnvs(); }
  });
});
