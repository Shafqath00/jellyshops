import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "./postgres-repository.js";
import { CatalogService } from "./service.js";

describe("variant shipping details", () => {
  let database: IntegrationDatabase;
  let service: CatalogService;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql", "20261028041000_order_item_shipping_snapshot.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    // Added to Product by the order-management migration, which these catalog tests do not load.
    await database.exec(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fulfillmentType" TEXT NOT NULL DEFAULT 'PHYSICAL' CHECK ("fulfillmentType" IN ('PHYSICAL','DIGITAL'))`);
    const repository = new CatalogPostgresRepository(database);
    service = new CatalogService(repository, repository);
    await seedStore(database, "store-a", "store-a");
  });
  afterEach(async () => { await database.close(); });

  const shipping = { weightGrams: 250, lengthMm: 300, widthMm: 200, heightMm: 50, countryOfOrigin: "IN", hsCode: "610910" };
  const create = (extra: Record<string, unknown> = {}) => service.createProduct("store-a", { handle: "tee", title: "Tee", status: "ACTIVE", variants: [{ title: "Standard", priceMinor: 2500, quantity: 5, ...shipping }], ...extra });
  const addLine = async (variantId: string, quantity = 2) => {
    await database.query(`INSERT INTO "Order" (id,"storeId",number,"publicToken","customerSnapshot","subtotalMinor","shippingMinor","totalMinor",currency) VALUES ('order-1','store-a','1','token','{}',100,0,100,'USD') ON CONFLICT DO NOTHING`);
    await database.query(`INSERT INTO "OrderItem" ("orderId","storeId","variantId","titleSnapshot","unitPriceMinor",quantity) VALUES ('order-1','store-a',$1,'Tee',100,$2) ON CONFLICT ("orderId","variantId") DO UPDATE SET quantity=EXCLUDED.quantity`, [variantId, quantity]);
  };
  const snapshot = async () => (await database.query<{ shippingSnapshot: unknown }>(`SELECT "shippingSnapshot" FROM "OrderItem" WHERE "orderId"='order-1'`)).rows[0]?.shippingSnapshot;

  it("stores shipping details, keeps them when a save omits them, and clears them with null", async () => {
    const product = await create();
    expect(product.variants[0]).toMatchObject(shipping);
    const variantId = product.variants[0].id;
    const kept = await service.updateProduct("store-a", product.id, { variants: [{ id: variantId, title: "Standard", priceMinor: 2600 }] });
    expect(kept.variants[0]).toMatchObject({ priceMinor: 2600, ...shipping });
    const partly = await service.updateProduct("store-a", product.id, { variants: [{ id: variantId, title: "Standard", priceMinor: 2600, weightGrams: 300, hsCode: null }] });
    expect(partly.variants[0]).toMatchObject({ ...shipping, weightGrams: 300, hsCode: null });
    const cleared = await service.updateProduct("store-a", product.id, { variants: [{ id: variantId, title: "Standard", priceMinor: 2600, weightGrams: null, lengthMm: null, widthMm: null, heightMm: null, countryOfOrigin: null, hsCode: null }] });
    expect(cleared.variants[0]).toMatchObject({ weightGrams: null, lengthMm: null, widthMm: null, heightMm: null, countryOfOrigin: null, hsCode: null });
  });

  it("treats a product as physical unless it is made digital, and lets that change", async () => {
    const product = await create();
    expect(product.fulfillmentType).toBe("PHYSICAL");
    expect((await service.updateProduct("store-a", product.id, { fulfillmentType: "DIGITAL" })).fulfillmentType).toBe("DIGITAL");
    expect((await service.updateProduct("store-a", product.id, { title: "Tee 2" })).fulfillmentType).toBe("DIGITAL");
    expect((await service.updateProduct("store-a", product.id, { fulfillmentType: "PHYSICAL" })).fulfillmentType).toBe("PHYSICAL");
    const digital = await service.createProduct("store-a", { handle: "guide", title: "Guide", fulfillmentType: "DIGITAL", variants: [{ title: "PDF", priceMinor: 500 }] });
    expect(digital.fulfillmentType).toBe("DIGITAL");
  });

  it("rejects impossible values at the database", async () => {
    const { variants: [{ id }] } = await create();
    const set = (column: string, value: unknown) => database.query(`UPDATE "ProductVariant" SET "${column}"=$2 WHERE "id"=$1`, [id, value]);
    await expect(set("weightGrams", -1)).rejects.toThrow(/weightGrams/);
    await expect(set("weightGrams", 100_000_001)).rejects.toThrow(/weightGrams/);
    await expect(set("lengthMm", 10_000_001)).rejects.toThrow(/lengthMm/);
    await expect(set("countryOfOrigin", "in")).rejects.toThrow(/countryOfOrigin/);
    await expect(set("countryOfOrigin", "IND")).rejects.toThrow(/countryOfOrigin/);
    await expect(set("hsCode", "6109")).rejects.toThrow(/hsCode/);
    await expect(set("hsCode", "6109.10")).rejects.toThrow(/hsCode/);
    await set("hsCode", "6109100012");
  });

  it("copies the shipping details onto an order line when it is created, and never rewrites them", async () => {
    const product = await create();
    const variantId = product.variants[0].id;
    await addLine(variantId);
    expect(await snapshot()).toEqual(shipping);
    // Editing the product afterwards leaves the order as it was.
    await service.updateProduct("store-a", product.id, { variants: [{ id: variantId, title: "Standard", priceMinor: 2500, weightGrams: 999, hsCode: null }] });
    expect(await snapshot()).toEqual(shipping);
  });

  it("records nothing for a variant without details, and keeps an explicit snapshot", async () => {
    const bare = await service.createProduct("store-a", { handle: "bare", title: "Bare", variants: [{ title: "Standard", priceMinor: 100 }] });
    await addLine(bare.variants[0].id);
    expect(await snapshot()).toBeNull();

    await database.query(`DELETE FROM "OrderItem" WHERE "orderId"='order-1'`);
    const withDetails = await create();
    await database.query(`INSERT INTO "OrderItem" ("orderId","storeId","variantId","titleSnapshot","unitPriceMinor",quantity,"shippingSnapshot") VALUES ('order-1','store-a',$1,'Tee',100,1,'{"weightGrams":111}')`, [withDetails.variants[0].id]);
    expect(await snapshot()).toEqual({ weightGrams: 111 });
  });

  it("keeps zero as a real weight", async () => {
    const product = await service.createProduct("store-a", { handle: "air", title: "Air", variants: [{ title: "Standard", priceMinor: 100, weightGrams: 0 }] });
    await addLine(product.variants[0].id);
    expect(await snapshot()).toEqual({ weightGrams: 0 });
  });
});
