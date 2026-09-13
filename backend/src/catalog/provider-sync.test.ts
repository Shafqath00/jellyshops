import { describe, expect, it, vi } from "vitest";
import { CatalogProviderSync, type CatalogSyncWriter, type ProviderProductInput } from "./provider-sync.js";

const providerProduct: ProviderProductInput = {
  externalId: "gid://provider/Product/123",
  handle: "chocolate-cake",
  title: "Chocolate Cake",
  description: "Rich cake",
  vendor: "Jelly Foods",
  productType: "Cake",
  tags: ["featured"],
  status: "ACTIVE",
  variants: [
    {
      externalId: "gid://provider/ProductVariant/456",
      title: "Default",
      sku: "CAKE-1",
      priceMinor: 1500,
      compareAtPriceMinor: 1800,
      options: { Size: "Default" },
      trackInventory: true,
      quantity: 9,
      reserved: 0,
    },
  ],
};

describe("CatalogProviderSync", () => {
  it("passes only provider-neutral canonical inputs to the writer", async () => {
    const writer: CatalogSyncWriter = {
      upsertProviderProduct: vi.fn(async (_storeId, input) => ({ id: "jelly-product", externalId: input.externalId })),
    };
    const sync = new CatalogProviderSync(writer);

    await expect(sync.upsertProduct("store-a", providerProduct)).resolves.toEqual({
      id: "jelly-product",
      externalId: providerProduct.externalId,
    });

    expect(writer.upsertProviderProduct).toHaveBeenCalledWith("store-a", providerProduct);
  });

  it("requires stable external ids for products and variants", async () => {
    const writer: CatalogSyncWriter = {
      upsertProviderProduct: vi.fn(),
    };
    const sync = new CatalogProviderSync(writer);

    await expect(sync.upsertProduct("store-a", { ...providerProduct, externalId: "" }))
      .rejects.toThrow(/external id/i);
    await expect(sync.upsertProduct("store-a", {
      ...providerProduct,
      variants: [{ ...providerProduct.variants[0], externalId: "" }],
    })).rejects.toThrow(/external id/i);
    expect(writer.upsertProviderProduct).not.toHaveBeenCalled();
  });

  it("normalizes duplicate tags without introducing provider-specific fields", async () => {
    const writer: CatalogSyncWriter = {
      upsertProviderProduct: vi.fn(async (_storeId, input) => ({ id: "jelly-product", externalId: input.externalId })),
    };
    const sync = new CatalogProviderSync(writer);

    await sync.upsertProduct("store-a", { ...providerProduct, tags: ["featured", "featured", "cake"] });

    expect(writer.upsertProviderProduct).toHaveBeenCalledWith(
      "store-a",
      expect.objectContaining({ tags: ["featured", "cake"] }),
    );
  });
});
