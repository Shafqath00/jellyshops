import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { StoreSettingsRepository } from "./settings.js";

describe("durable store settings", () => {
  let db: IntegrationDatabase;
  let repository: StoreSettingsRepository;
  beforeEach(async () => {
    db = await createPGliteDatabase(); await seedStore(db, "store-a", "store-a");
    await db.exec(await readFile(new URL("../../sql/migrations/20260915120000_add_stripe_connect_commerce.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../../sql/migrations/20261020140329_store_settings_checkout.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../../sql/migrations/20261020163817_jelly_signature_customer_services.sql", import.meta.url), "utf8"));
    repository = new StoreSettingsRepository({ transaction: (work) => db.transaction((tx) => work(tx)) });
  });
  afterEach(async () => { await db.close(); });
  it("persists shipping with revision checks and leaves currency fixed", async () => {
    expect(await repository.get("store-a")).toMatchObject({ revision: 0, shippingMinor: 0, currency: "USD", country: "US" });
    await expect(repository.update("store-a", { revision: 0, name: "Renamed", shippingMinor: 350 })).resolves.toMatchObject({ name: "Renamed", shippingMinor: 350, revision: 1 });
    await expect(repository.update("store-a", { revision: 0, shippingMinor: 999 })).rejects.toMatchObject({ status: 409 });
    expect(await repository.get("store-a")).toMatchObject({ name: "Renamed", shippingMinor: 350, currency: "USD" });
    await expect(repository.get("missing")).rejects.toMatchObject({ status: 404 });
  });
  it("rejects unsupported or mismatched market currencies", async () => {
    await db.query(`UPDATE "Store" SET "country" = 'IN', "currency" = 'USD' WHERE id = 'store-a'`);
    await expect(repository.getCheckoutPolicy("store-a")).rejects.toMatchObject({ code: "STORE_MARKET_INVALID" });
  });
});
