import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { SqlExecutor } from "../../src/commerce/repository.js";
import { StoreBillingService, TRIAL_DAYS } from "../../src/billing/store-billing.js";
import { createOwnedStore } from "../../src/tenants/postgres-repository.js";
import { createPGliteDatabase, seedStore } from "./pglite.js";

const migration = (name: string) => readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8");

async function setup() {
  const database = await createPGliteDatabase();
  // Store settings columns come from migrations the shared list leaves out.
  for (const name of ["20260918000000_add_store_owner.sql", "20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql", "20261114000000_merchant_onboarding.sql"]) {
    await database.exec(await migration(name));
  }
  return database;
}

describe("StoreBilling (migration 20261123000000)", () => {
  it("marks every shop that already exists as exempt, and running it again changes nothing", async () => {
    const database = await setup();
    await seedStore(database, "store-old", "old-shop");
    // The list in pglite.ts ran the migration on an empty database; run it again as staging will, with a shop present.
    await database.exec(await migration("20261123000000_store_billing.sql"));
    await database.exec(await migration("20261123000000_store_billing.sql"));
    const rows = await database.query<{ storeId: string; status: string; plan: string }>(`SELECT "storeId", "status", "plan" FROM "StoreBilling"`);
    expect(rows.rows).toEqual([{ storeId: "store-old", status: "exempt", plan: "standard" }]);
  });

  it("starts a 14-day trial for every new shop, in the same transaction that creates it", async () => {
    const database = await setup();
    await database.query(`INSERT INTO "User" ("name", "email", "firebaseUid", "updatedAt") VALUES ('Merchant', 'merchant@example.test', '00000000-0000-4000-8000-000000000001', NOW())`);
    const before = Date.now();
    const store = await database.transaction((tx) => createOwnedStore({ query: (text, values) => tx.query(text, values) } as SqlExecutor, "00000000-0000-4000-8000-000000000001", { name: "New shop", slug: "new-shop", currency: "GBP", country: "GB" }));
    const row = (await database.query<{ status: string; trialEndsAt: Date }>(`SELECT "status", "trialEndsAt" FROM "StoreBilling" WHERE "storeId" = $1`, [store.id])).rows[0];
    expect(row?.status).toBe("trialing");
    const days = (new Date(row!.trialEndsAt).getTime() - before) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(TRIAL_DAYS - 0.01);
    expect(days).toBeLessThan(TRIAL_DAYS + 0.01);
  });

  it("refuses a status it does not know and a trial without an end date", async () => {
    const database = await setup();
    await seedStore(database, "store-a", "shop-a");
    await expect(database.query(`INSERT INTO "StoreBilling" ("storeId", "status") VALUES ('store-a', 'free')`)).rejects.toThrow();
    await expect(database.query(`INSERT INTO "StoreBilling" ("storeId", "status") VALUES ('store-a', 'trialing')`)).rejects.toThrow();
  });

  it("is read by the billing service: exempt shops are never limited, an ended trial closes the shop once enforced", async () => {
    const database = await setup();
    await seedStore(database, "store-exempt", "exempt-shop");
    await seedStore(database, "store-ended", "ended-shop");
    await database.query(`INSERT INTO "StoreBilling" ("storeId", "status") VALUES ('store-exempt', 'exempt')`);
    await database.query(`INSERT INTO "StoreBilling" ("storeId", "status", "trialEndsAt") VALUES ('store-ended', 'trialing', NOW() - INTERVAL '1 day')`);
    const sql = { query: (text: string, values?: unknown[]) => database.query(text, values) };
    const enforced = new StoreBillingService(sql, { enforced: true });
    expect(await enforced.planFor("store-exempt")).toBe("exempt");
    expect(await enforced.isPaused("store-exempt")).toBe(false);
    expect(await enforced.planFor("store-ended")).toBe("standard");
    expect(await enforced.state("store-ended")).toMatchObject({ status: "trialing", pauseReason: "trial-ended", paused: true });
    expect(await new StoreBillingService(sql, { enforced: false }).isPaused("store-ended")).toBe(false);
  });
});
