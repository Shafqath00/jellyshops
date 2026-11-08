import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { createApp } from "../app.js";
import type { SqlExecutor } from "../commerce/repository.js";
import { ProductReviewService } from "./service.js";

async function product(database: IntegrationDatabase, id: string, storeId: string, status = "ACTIVE"): Promise<void> {
  await database.query(`INSERT INTO "Product" ("id", "storeId", "title", "status", "slug", "updatedAt") VALUES ($1, $2, $1, $3::"ProductStatus", $1, NOW())`, [id, storeId, status]);
}

async function member(database: IntegrationDatabase, uid: string, storeId: string, role: string): Promise<void> {
  const user = (await database.query<{ id: number }>(
    `INSERT INTO "User" ("name", "email", "firebaseUid", "createdAt", "updatedAt") VALUES ($1, $2, $1, NOW(), NOW())
     ON CONFLICT ("firebaseUid") DO UPDATE SET "updatedAt" = NOW() RETURNING "id"`,
    [uid, `${uid}@example.test`],
  )).rows[0];
  await database.query(`INSERT INTO "StoreMembership" ("storeId", "userId", "role") VALUES ($1, $2, $3::"MembershipRole")`, [storeId, user.id, role]);
}

describe("ProductReviewService", () => {
  let database: IntegrationDatabase;
  let clock = 0;
  let service: ProductReviewService;
  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "a");
    await seedStore(database, "store-b", "b");
    await product(database, "serum", "store-a");
    await product(database, "draft", "store-a", "DRAFT");
    await product(database, "other", "store-b");
    clock = 0;
    service = new ProductReviewService(database as never, () => clock);
  });
  afterEach(async () => { await database.close(); });

  const review = (rating: number, name = "Sam") => ({ rating, authorName: name, title: "Lovely", body: "Soft on my skin.", email: "sam@example.test" });

  it("keeps new reviews pending until the merchant publishes them", async () => {
    expect(await service.submit("store-a", "serum", review(5), "1.1.1.1")).toEqual({ status: "pending" });
    expect((await service.listPublished("store-a", "serum")).reviews).toEqual([]);
    const { reviews, counts } = await service.listForMerchant("store-a");
    expect(counts).toEqual({ pending: 1, published: 0, hidden: 0 });
    expect(reviews[0]).toMatchObject({ productTitle: "serum", authorEmail: "sam@example.test", status: "pending", publishedAt: null });
    await service.setStatus("store-a", reviews[0].id, "published");
    const published = await service.listPublished("store-a", "serum");
    expect(published.reviews).toHaveLength(1);
    expect(published.reviews[0]).not.toHaveProperty("authorEmail");
  });

  it("works out the average, count and stars per rating from published reviews only", async () => {
    for (const rating of [5, 5, 4, 2]) await service.submit("store-a", "serum", review(rating), `ip-${rating}-${Math.random()}`);
    const { reviews } = await service.listForMerchant("store-a");
    for (const item of reviews.filter((entry) => entry.rating !== 2)) await service.setStatus("store-a", item.id, "published");
    const { summary } = await service.listPublished("store-a", "serum");
    expect(summary).toEqual({ average: 4.7, count: 3, distribution: [2, 1, 0, 0, 0] });
    expect(await service.summaries("store-a", ["serum", "draft", "missing"])).toEqual({ serum: { average: 4.7, count: 3 } });
  });

  it("refuses bad input, inactive or other stores' products, and too many reviews from one address", async () => {
    await expect(service.submit("store-a", "serum", review(6), "x")).rejects.toMatchObject({ code: "INVALID_RATING" });
    await expect(service.submit("store-a", "serum", { ...review(5), authorName: "  " }, "x")).rejects.toMatchObject({ code: "INVALID_NAME" });
    await expect(service.submit("store-a", "serum", { ...review(5), email: "not-an-email" }, "x")).rejects.toMatchObject({ code: "INVALID_EMAIL" });
    await expect(service.submit("store-a", "draft", review(5), "x")).rejects.toMatchObject({ status: 404 });
    await expect(service.submit("store-a", "other", review(5), "x")).rejects.toMatchObject({ status: 404 });
    for (let index = 0; index < 5; index++) await service.submit("store-a", "serum", review(4), "busy");
    await expect(service.submit("store-a", "serum", review(4), "busy")).rejects.toMatchObject({ status: 429 });
    clock += 11 * 60_000;
    await expect(service.submit("store-a", "serum", review(4), "busy")).resolves.toEqual({ status: "pending" });
  });

  it("only lets a store moderate its own reviews", async () => {
    await service.submit("store-a", "serum", review(5), "x");
    const id = (await service.listForMerchant("store-a")).reviews[0].id;
    expect((await service.listForMerchant("store-b")).reviews).toEqual([]);
    await expect(service.setStatus("store-b", id, "published")).rejects.toMatchObject({ status: 404 });
    await expect(service.remove("store-b", id)).rejects.toMatchObject({ status: 404 });
    await service.setStatus("store-a", id, "hidden");
    expect((await service.listForMerchant("store-a", { status: "hidden" })).reviews).toHaveLength(1);
    await service.remove("store-a", id);
    expect((await service.listForMerchant("store-a")).reviews).toEqual([]);
  });
});

describe("reviews in the assembled app", () => {
  it("lets shoppers send and read reviews, and the merchant publish them", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "jelly-reviews-app-"));
    const database = await createPGliteDatabase();
    try {
      await seedStore(database, "store-a", "aaa");
      await seedStore(database, "store-b", "bbb");
      await product(database, "serum", "store-a");
      await member(database, "0", "store-a", "OWNER");
      const commerceDatabase = { transaction: (work: (sql: SqlExecutor) => Promise<unknown>) => database.transaction((tx) => work({ query: (sql: string, values?: unknown[]) => tx.query(sql, values as never) } as never)) };
      const app = createApp({
        config: { port: 3001, nodeEnv: "test", corsOrigins: [], trustProxy: false, authProvider: "development", mediaProvider: "local-files", dataDirectory: directory, uploadDirectory: path.join(directory, "uploads"), maxUploadBytes: 1024 * 1024, demoStoreId: "store-a" },
        storefrontSql: database as never,
        commerceDatabase: commerceDatabase as never,
      } as never);
      const merchant = { Authorization: "Bearer jelly-demo-merchant" };

      const sent = await request(app).post("/api/public/stores/store-a/reviews/products/serum").send({ rating: 5, authorName: "Ana", body: "Great", email: "ana@example.test" });
      expect(sent.status).toBe(202);
      // A filled-in hidden field means a bot: accepted, not stored.
      await request(app).post("/api/public/stores/store-a/reviews/products/serum").send({ rating: 1, authorName: "Bot", website: "spam.example" }).expect(202);
      expect((await request(app).post("/api/public/stores/store-a/reviews/products/serum").send({ rating: 5, authorName: "Ana", extra: true })).status).toBe(400);

      expect((await request(app).get("/api/stores/store-a/reviews")).status).toBe(401);
      // Another store is hidden entirely, as elsewhere in the merchant API.
      expect((await request(app).get("/api/stores/store-b/reviews").set(merchant)).status).toBe(404);
      const listed = await request(app).get("/api/stores/store-a/reviews?status=pending").set(merchant).expect(200);
      expect(listed.body.reviews).toHaveLength(1);
      await request(app).patch(`/api/stores/store-a/reviews/${listed.body.reviews[0].id}`).set(merchant).send({ status: "published" }).expect(200);

      const shown = await request(app).get("/api/public/stores/store-a/reviews/products/serum").expect(200);
      expect(shown.body.summary).toMatchObject({ average: 5, count: 1 });
      expect(JSON.stringify(shown.body)).not.toContain("ana@example.test");
      const summary = await request(app).get("/api/public/stores/store-a/reviews/summary?productIds=serum,nope").expect(200);
      expect(summary.body.summaries).toEqual({ serum: { average: 5, count: 1 } });

      await request(app).delete(`/api/stores/store-a/reviews/${listed.body.reviews[0].id}`).set(merchant).expect(204);
    } finally { await database.close(); }
  });
});
