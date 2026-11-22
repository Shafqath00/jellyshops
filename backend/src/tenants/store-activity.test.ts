import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { createStoreActivityRecorder, createStoreVisitRouter, recordMerchantActivity } from "./store-activity.js";

describe("store activity", () => {
  let db: IntegrationDatabase | undefined;
  afterEach(async () => { await db?.close(); db = undefined; });
  const read = async (id: string) => (await db!.query<{ lastMerchantActivityAt: Date | null; lastOrderAt: Date | null; lastVisitAt: Date | null; lifecycleState: string }>(`SELECT * FROM "Store" WHERE "id" = $1`, [id])).rows[0];

  it("records merchant work once an hour, every paid order, and a visit once a day", async () => {
    db = await createPGliteDatabase(); await seedStore(db, "store-a", "a");
    expect((await read("store-a")).lifecycleState).toBe("active");
    let clock = 1_000_000;
    const queries: string[] = [];
    const sql = { query: async (text: string, values?: unknown[]) => { queries.push(text); return db!.query(text, values) as never; } };
    const recorder = createStoreActivityRecorder(sql, () => clock);
    await recorder.merchantSeen("store-a"); await recorder.merchantSeen("store-a");
    expect((await read("store-a")).lastMerchantActivityAt).toBeInstanceOf(Date);
    expect(queries).toHaveLength(1);
    clock += 61 * 60 * 1000;
    await recorder.merchantSeen("store-a");
    expect(queries).toHaveLength(2);
    await recorder.orderPaid("store-a"); await recorder.orderPaid("store-a");
    expect(queries).toHaveLength(4);
    await recorder.visited("store-a"); await recorder.visited("store-a");
    expect(queries).toHaveLength(5);
    const row = await read("store-a");
    expect(row.lastOrderAt).toBeInstanceOf(Date);
    expect(row.lastVisitAt).toBeInstanceOf(Date);
  });

  it("switches itself off on a database without the new columns", async () => {
    db = await createPGliteDatabase(); await seedStore(db, "store-a", "a");
    await db!.exec(`ALTER TABLE "Store" DROP COLUMN "lastVisitAt"`);
    const queries: string[] = [];
    const recorder = createStoreActivityRecorder({ query: async (text: string, values?: unknown[]) => { queries.push(text); return db!.query(text, values) as never; } });
    await expect(recorder.visited("store-a")).resolves.toBeUndefined();
    await recorder.merchantSeen("store-a");
    expect(queries).toHaveLength(1);
  });

  it("records merchant activity only after an authorised, successful store request", async () => {
    const seen: string[] = [];
    const recorder = { merchantSeen: async (id: string) => { seen.push(id); }, orderPaid: async () => undefined, visited: async () => undefined };
    const app = express();
    app.use(recordMerchantActivity(recorder));
    app.get("/api/stores/:storeId/ok", (req, res) => { req.storeContext = {} as never; res.json({}); });
    app.get("/api/stores/:storeId/denied", (_req, res) => { res.status(403).json({}); });
    app.get("/api/stores/:storeId/anonymous", (_req, res) => { res.json({}); });
    await request(app).get("/api/stores/store-a/ok");
    await request(app).get("/api/stores/store-a/denied");
    await request(app).get("/api/stores/store-a/anonymous");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen).toEqual(["store-a"]);
  });

  it("answers visit beacons with 204 and ignores odd store ids", async () => {
    const visited: string[] = [];
    const app = express().use("/api/public/stores", createStoreVisitRouter({ merchantSeen: async () => undefined, orderPaid: async () => undefined, visited: async (id) => { visited.push(id); } }));
    expect((await request(app).post("/api/public/stores/store-a/visit")).status).toBe(204);
    expect((await request(app).post("/api/public/stores/bad%20id/visit")).status).toBe(204);
    expect(visited).toEqual(["store-a"]);
  });
});
