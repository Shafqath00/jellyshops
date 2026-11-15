import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CommerceDatabase, SqlExecutor } from "../../src/commerce/repository.js";
import { createOnboardingProvisioner } from "../../src/onboarding/provision-store.js";
import { createPGliteDatabase } from "./pglite.js";

const merchant = "11111111-1111-4111-8111-111111111111";
const secondMerchant = "22222222-2222-4222-8222-222222222222";
const fields = {
  fullName: "Maya Stone", name: "Studio Stone", slug: "studio-stone", country: "GB" as const,
  theme: "jelly-avenue" as const, description: "Small batch pottery.", category: "Home",
  businessType: "individual", contactEmail: "hello@example.test", timezone: "Europe/London",
  productCategories: ["Ceramics", "Tableware", "ceramics"],
  product: { title: "Café cup", priceMinor: 1599, stock: 6 },
};

describe("onboarding store provisioning", () => {
  let db: Awaited<ReturnType<typeof createPGliteDatabase>>;
  let database: CommerceDatabase;
  const objects = new Map<string, Buffer>();
  const provision = createOnboardingProvisioner({
    async put(input) {
      const key = `${input.storeId}/${input.mediaId}.${input.extension}`;
      objects.set(key, input.contents);
      return key;
    },
    async open(key) { return objects.get(key) ?? null; },
    async remove(key) { objects.delete(key); },
  });

  beforeAll(async () => {
    db = await createPGliteDatabase();
    database = { transaction: (work) => db.transaction(tx => work(tx as SqlExecutor)) };
    for (const migration of [
      "20260918000000_add_store_owner.sql",
      "20260915120000_add_stripe_connect_commerce.sql",
      "20261020140329_store_settings_checkout.sql",
      "20261020163817_jelly_signature_customer_services.sql",
      "20261023000000_category_taxonomy.sql",
      "20261114000000_merchant_onboarding.sql",
    ]) {
      await db.exec(await readFile(new URL(`../../sql/migrations/${migration}`, import.meta.url), "utf8"));
    }
    for (const [id, email] of [[merchant, "maya@example.test"], [secondMerchant, "jules@example.test"]]) {
      await db.query('INSERT INTO "User" ("name","email","firebaseUid","updatedAt") VALUES ($1,$2,$3,NOW())', ["Merchant", email, id]);
    }
  }, 35_000);

  afterAll(async () => { await db?.close(); });

  it("applies a complete draft, including logo, categories and tracked stock", async () => {
    const logo = await sharp({ create: { width: 5, height: 5, channels: 4, background: "#2f5bff" } }).webp().toBuffer();
    const store = await database.transaction(sql => provision(sql, merchant, fields, logo, () => {}));
    expect(store).toMatchObject({ name: fields.name, slug: fields.slug, currency: "GBP", role: "OWNER" });
    expect((await db.query('SELECT "description","category","contactEmail","timezone" FROM "StoreSettings" WHERE "storeId"=$1', [store.id])).rows[0])
      .toEqual({ description: fields.description, category: fields.category, contactEmail: fields.contactEmail, timezone: fields.timezone });
    expect((await db.query('SELECT "themeId", "settings"->\'branding\'->>\'logoUrl\' AS logo FROM "ThemeConfiguration" WHERE "storeId"=$1', [store.id])).rows[0])
      .toEqual({ themeId: "jelly-avenue", logo: expect.stringContaining(`/api/public/media/${store.id}/`) });
    expect(objects.size).toBe(4);
    const products = (await db.query('SELECT "slug" AS handle,"status","primaryCategoryId","additionalCategoryIds" FROM "Product" WHERE "storeId"=$1', [store.id])).rows;
    expect(products).toEqual([{ handle: "cafe-cup", status: "DRAFT", primaryCategoryId: expect.any(String), additionalCategoryIds: [expect.any(String)] }]);
    expect((await db.query('SELECT v."priceMinor",v."trackInventory",i."quantity" FROM "ProductVariant" v JOIN "InventoryLevel" i ON i."variantId"=v."id" WHERE v."storeId"=$1', [store.id])).rows)
      .toEqual([{ priceMinor: 1599, trackInventory: true, quantity: 6 }]);
    expect((await db.query('SELECT id FROM "StorefrontPublication" WHERE "storeId"=$1', [store.id])).rows).toEqual([]);
  });

  it("returns a conflict for a claimed address and leaves the second merchant without a store", async () => {
    await db.query('INSERT INTO "Store" ("id","name","slug","country","currency","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())', ["claimed","Claimed","claimed-address","GB","GBP"]);
    await expect(database.transaction(sql => provision(sql, secondMerchant, { ...fields, slug: "claimed-address" }, null, () => {})))
      .rejects.toMatchObject({ code: "STORE_SLUG_TAKEN" });
    expect((await db.query('SELECT id FROM "Store" WHERE "owner_user_id"=$1', [secondMerchant])).rows).toEqual([]);
  });
});
