import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import type { CommerceDatabase, SqlExecutor } from "../../src/commerce/repository.js";
import { errorHandler } from "../../src/http/errors.js";
import { StoreSettingsRepository } from "../../src/tenants/settings.js";
import { createRetiredAddressRouter, isRetiredAddress, resetSlugHistoryCheck } from "../../src/tenants/slug-history.js";
import { createPGliteDatabase, seedStore } from "./pglite.js";

type Database = Awaited<ReturnType<typeof createPGliteDatabase>>;

function transactionDatabase(database: Database): CommerceDatabase {
  return { async transaction(work) { return database.transaction((tx) => work({ query: (sql, values) => tx.query(sql, values) } as SqlExecutor)); } };
}

async function setup() {
  resetSlugHistoryCheck();
  const database = await createPGliteDatabase();
  // Store settings columns come from migrations the shared list leaves out.
  for (const migration of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql", "20261114000000_merchant_onboarding.sql"]) {
    await database.exec(await readFile(new URL(`../../sql/migrations/${migration}`, import.meta.url), "utf8"));
  }
  await seedStore(database, "store-a", "first-shop");
  await seedStore(database, "store-b", "second-shop");
  const db = transactionDatabase(database);
  const settings = new StoreSettingsRepository(db);
  const rename = async (storeId: string, slug: string) => {
    const current = await settings.get(storeId);
    return settings.update(storeId, { revision: current.revision, slug });
  };
  return { database, db, settings, rename };
}

describe("changing a shop's address", () => {
  beforeEach(() => resetSlugHistoryCheck());

  it("keeps the old address, which then points to the new one", async () => {
    const { db, rename } = await setup();
    expect((await rename("store-a", "brand-new-shop")).slug).toBe("brand-new-shop");

    const app = express().use("/api/public/slugs", createRetiredAddressRouter(db)).use(errorHandler);
    const moved = await request(app).get("/api/public/slugs/first-shop");
    expect(moved.status).toBe(200);
    expect(moved.body).toEqual({ slug: "brand-new-shop" });
    expect(moved.headers["cache-control"]).toBe("public, max-age=300");
    expect((await request(app).get("/api/public/slugs/never-used")).status).toBe(404);
  });

  it("follows a shop through several moves", async () => {
    const { db, rename } = await setup();
    await rename("store-a", "second-name");
    await rename("store-a", "third-name");
    const app = express().use("/api/public/slugs", createRetiredAddressRouter(db)).use(errorHandler);
    expect((await request(app).get("/api/public/slugs/first-shop")).body).toEqual({ slug: "third-name" });
    expect((await request(app).get("/api/public/slugs/second-name")).body).toEqual({ slug: "third-name" });
  });

  it("never gives a retired address to another shop", async () => {
    const { db, rename } = await setup();
    await rename("store-a", "brand-new-shop");
    await expect(rename("store-b", "first-shop")).rejects.toMatchObject({ status: 422, code: "STORE_SLUG_TAKEN" });
    expect(await db.transaction((sql) => isRetiredAddress(sql, "first-shop"))).toBe(true);
  });

  it("lets a shop take its own old address back", async () => {
    const { db, rename } = await setup();
    await rename("store-a", "brand-new-shop");
    expect((await rename("store-a", "first-shop")).slug).toBe("first-shop");
    expect(await db.transaction((sql) => isRetiredAddress(sql, "first-shop"))).toBe(false);
    expect(await db.transaction((sql) => isRetiredAddress(sql, "brand-new-shop"))).toBe(true);
  });

  it("allows 3 changes in 30 days", async () => {
    const { rename } = await setup();
    await rename("store-a", "name-one");
    await rename("store-a", "name-two");
    await rename("store-a", "name-three");
    await expect(rename("store-a", "name-four")).rejects.toMatchObject({ status: 422, code: "STORE_SLUG_CHANGE_LIMIT" });
  });
});
