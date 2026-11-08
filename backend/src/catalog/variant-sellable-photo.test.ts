import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "./postgres-repository.js";
import { CatalogService } from "./service.js";
import { productImageSnapshot } from "./product-image-snapshot.js";

describe("selling a combination and its photo", () => {
  let database: IntegrationDatabase;
  let service: CatalogService;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    const repository = new CatalogPostgresRepository(database);
    service = new CatalogService(repository, repository);
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
  });
  afterEach(async () => { await database.close(); });

  const seedMedia = (storeId: string, id: string) => database.query(`INSERT INTO "Media"("id","storeId","type","storageKey","url","mimeType","byteSize","originalName","altText") VALUES ($1,$2,'image',$1,$3,'image/jpeg',1,$1,'Alt')`, [id, storeId, `https://example.com/${id}.jpg`]);
  const bed = (extra: Record<string, unknown> = {}) => service.createProduct("store-a", {
    handle: "bed", title: "Bed", status: "ACTIVE",
    variants: [{ title: "Single", sku: "B-S", priceMinor: 10000, quantity: 5 }, { title: "King", sku: "B-K", priceMinor: 20000, quantity: 5 }],
    ...extra,
  });

  describe("sellable", () => {
    it("defaults to sellable, can be switched off and on, and survives saves that leave it out", async () => {
      const product = await bed();
      const [single, king] = product.variants;
      expect(product.variants.every((variant) => variant.sellable === true && variant.available)).toBe(true);

      const off = await service.updateProduct("store-a", product.id, { variants: [{ id: king.id, title: "King", priceMinor: 20000, sellable: false }] });
      expect(off.variants.find((variant) => variant.id === king.id)).toMatchObject({ sellable: false, available: false, quantity: 5 });
      expect(off.variants.find((variant) => variant.id === single.id)).toMatchObject({ sellable: true, available: true });

      const kept = await service.updateProduct("store-a", product.id, { variants: [{ id: king.id, title: "King", priceMinor: 21000 }] });
      expect(kept.variants.find((variant) => variant.id === king.id)).toMatchObject({ sellable: false, priceMinor: 21000 });

      const on = await service.updateProduct("store-a", product.id, { variants: [{ id: king.id, title: "King", priceMinor: 21000, sellable: true }] });
      expect(on.variants.find((variant) => variant.id === king.id)).toMatchObject({ sellable: true, available: true });
    });

    it("keeps the stock of a combination that is not being sold", async () => {
      const product = await bed();
      const king = product.variants[1];
      await service.updateProduct("store-a", product.id, { variants: [{ id: king.id, title: "King", priceMinor: 20000, sellable: false }] });
      const [row] = (await service.listInventory("store-a", { limit: 10, query: "King" })).nodes;
      expect(row).toMatchObject({ quantity: 5, trackInventory: true });
    });

    it("makes the product unavailable only when every combination is switched off", async () => {
      const product = await bed();
      const [single, king] = product.variants;
      const some = await service.updateProduct("store-a", product.id, { variants: [{ id: single.id, title: "Single", priceMinor: 10000, sellable: false }] });
      expect(some.available).toBe(true);
      const none = await service.updateProduct("store-a", product.id, { variants: [{ id: king.id, title: "King", priceMinor: 20000, sellable: false }] });
      expect(none.available).toBe(false);
    });

    it("leaves a product out of 'available' listings when no combination can be bought", async () => {
      const product = await bed();
      const inStock = async () => (await service.listProducts("store-a", { limit: 10, available: true })).nodes.map((entry) => entry.id);
      expect(await inStock()).toEqual([product.id]);
      await service.updateProduct("store-a", product.id, { variants: product.variants.map((variant) => ({ id: variant.id, title: variant.title, priceMinor: variant.priceMinor, sellable: false })) });
      expect(await inStock()).toEqual([]);
    });

    it("treats a digital product's combinations the same way", async () => {
      const guide = await service.createProduct("store-a", { handle: "guide", title: "Guide", fulfillmentType: undefined, variants: [{ title: "PDF", priceMinor: 500 }] });
      const off = await service.updateProduct("store-a", guide.id, { variants: [{ id: guide.variants[0].id, title: "PDF", priceMinor: 500, sellable: false }] });
      expect(off.variants[0].available).toBe(false);
    });
  });

  describe("combination photo", () => {
    it("links a combination to one of the product's photos and clears it with null", async () => {
      await seedMedia("store-a", "front"); await seedMedia("store-a", "side");
      const product = await bed({ media: [{ mediaId: "front" }, { mediaId: "side" }] });
      const king = product.variants[1];
      const set = await service.updateProduct("store-a", product.id, { variants: [{ id: king.id, title: "King", priceMinor: 20000, mediaId: "side" }] });
      expect(set.variants.find((variant) => variant.id === king.id)?.mediaId).toBe("side");
      expect(set.variants.find((variant) => variant.id !== king.id)?.mediaId).toBeNull();

      const kept = await service.updateProduct("store-a", product.id, { variants: [{ id: king.id, title: "King", priceMinor: 20500 }] });
      expect(kept.variants.find((variant) => variant.id === king.id)?.mediaId).toBe("side");

      const cleared = await service.updateProduct("store-a", product.id, { variants: [{ id: king.id, title: "King", priceMinor: 20500, mediaId: null }] });
      expect(cleared.variants.find((variant) => variant.id === king.id)?.mediaId).toBeNull();
    });

    it("can be set when the product and its photos are created together", async () => {
      await seedMedia("store-a", "front");
      const product = await service.createProduct("store-a", { handle: "chair", title: "Chair", media: [{ mediaId: "front" }], variants: [{ title: "Oak", priceMinor: 100, mediaId: "front" }] });
      expect(product.variants[0].mediaId).toBe("front");
    });

    it("refuses a photo that is not one of this product's photos, and changes nothing", async () => {
      await seedMedia("store-a", "front"); await seedMedia("store-a", "unused"); await seedMedia("store-b", "foreign");
      const product = await bed({ media: [{ mediaId: "front" }] });
      const king = product.variants[1];
      for (const mediaId of ["unused", "foreign", "does-not-exist"]) {
        await expect(service.updateProduct("store-a", product.id, { variants: [{ id: king.id, title: "King", priceMinor: 99999, mediaId }] })).rejects.toMatchObject({ code: "VARIANT_MEDIA_INVALID" });
      }
      await expect(service.createProduct("store-a", { handle: "bad", title: "Bad", variants: [{ title: "X", priceMinor: 1, mediaId: "front" }] })).rejects.toMatchObject({ code: "VARIANT_MEDIA_INVALID" });
    });

    it("unlinks a combination when its photo is removed from the product", async () => {
      await seedMedia("store-a", "front"); await seedMedia("store-a", "side");
      const product = await bed({ media: [{ mediaId: "front" }, { mediaId: "side" }] });
      const [single, king] = product.variants;
      await service.updateProduct("store-a", product.id, { variants: [{ id: single.id, title: "Single", priceMinor: 10000, mediaId: "front" }, { id: king.id, title: "King", priceMinor: 20000, mediaId: "side" }] });
      const after = await service.updateProduct("store-a", product.id, { media: [{ mediaId: "front" }] });
      expect(after.variants.find((variant) => variant.id === single.id)?.mediaId).toBe("front");
      expect(after.variants.find((variant) => variant.id === king.id)?.mediaId).toBeNull();
    });

    it("is the first photo used for the order line image, ahead of the choice-based gallery", () => {
      vi.stubEnv("PRODUCT_MEDIA_STORE_IDS", "store-a");
      const media = [{ id: "front", url: "front.jpg" }, { id: "side", url: "side.jpg", appliesTo: { size: ["k"] } }];
      const options = [{ id: "size", name: "Size", type: "variant", required: true, values: [{ id: "s", label: "S" }, { id: "k", label: "K" }] }];
      expect(productImageSnapshot("store-a", media as never, options, [{ optionId: "size", valueId: "k" }], { size: "k" })).toBe("side.jpg");
      expect(productImageSnapshot("store-a", media as never, options, [{ optionId: "size", valueId: "k" }], { size: "k" }, "front")).toBe("front.jpg");
      expect(productImageSnapshot("store-a", media as never, options, [{ optionId: "size", valueId: "k" }], { size: "k" }, "gone")).toBe("side.jpg");
      expect(productImageSnapshot("store-a", media as never, options, [], {}, null)).toBe("front.jpg");
      vi.unstubAllEnvs();
    });
  });
});
