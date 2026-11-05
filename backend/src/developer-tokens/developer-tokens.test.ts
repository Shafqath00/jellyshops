import { existsSync, readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path, { resolve } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { createApp } from "../app.js";
import type { SqlExecutor } from "../commerce/repository.js";
import { DeveloperTokenService, hashDeveloperToken, MAX_ACTIVE_TOKENS } from "./service.js";

async function member(database: IntegrationDatabase, uid: string, storeId: string, role: string): Promise<void> {
  const user = (await database.query<{ id: number }>(
    `INSERT INTO "User" ("name", "email", "firebaseUid", "createdAt", "updatedAt") VALUES ($1, $2, $1, NOW(), NOW())
     ON CONFLICT ("firebaseUid") DO UPDATE SET "updatedAt" = NOW() RETURNING "id"`,
    [uid, `${uid}@example.test`],
  )).rows[0];
  await database.query(`INSERT INTO "StoreMembership" ("storeId", "userId", "role") VALUES ($1, $2, $3::"MembershipRole")`, [storeId, user.id, role]);
}

describe("DeveloperTokenService", () => {
  let database: IntegrationDatabase;
  let service: DeveloperTokenService;
  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "aaa");
    await seedStore(database, "store-b", "bbb");
    await member(database, "owner-uid", "store-a", "OWNER");
    service = new DeveloperTokenService(database as never);
  });
  afterEach(async () => database.close());

  it("shows the token once and keeps only its hash", async () => {
    const { token, summary } = await service.create("store-a", "owner-uid", { name: "  Studio   laptop " });
    expect(token).toMatch(/^jdt_[A-Za-z0-9_-]{43}$/);
    expect(summary).toMatchObject({ name: "Studio laptop", prefix: token.slice(0, 12), scopes: ["themes"], expiresAt: null, revokedAt: null });
    const stored = (await database.query<{ tokenHash: string }>(`SELECT * FROM "DeveloperToken"`)).rows[0];
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored.tokenHash).toBe(hashDeveloperToken(token));
    expect(JSON.stringify(await service.list("store-a"))).not.toContain(token);
    expect(await service.list("store-b")).toEqual([]);
  });

  it("accepts a valid token for its own store and records when it was used", async () => {
    const { token, summary } = await service.create("store-a", "owner-uid", { name: "CI" });
    expect(await service.verify(token)).toEqual({ tokenId: summary.id, storeId: "store-a", scopes: ["themes"] });
    expect((await service.list("store-a"))[0].lastUsedAt).not.toBeNull();
    expect(await service.verify("jdt_not-a-real-token")).toBeNull();
    expect(await service.verify("not even a developer token")).toBeNull();
  });

  it("stops a token that is revoked, expired, or whose creator no longer manages the store", async () => {
    const revoked = await service.create("store-a", "owner-uid", { name: "Old" });
    await service.revoke("store-a", revoked.summary.id);
    expect(await service.verify(revoked.token)).toBeNull();
    await expect(service.revoke("store-b", revoked.summary.id)).rejects.toMatchObject({ status: 404 });

    const expiring = await service.create("store-a", "owner-uid", { name: "Short", expiresInDays: 30 });
    expect(await service.verify(expiring.token)).not.toBeNull();
    await database.query(`UPDATE "DeveloperToken" SET "expiresAt" = NOW() - INTERVAL '1 minute' WHERE "id" = $1`, [expiring.summary.id]);
    expect(await service.verify(expiring.token)).toBeNull();

    await member(database, "staff-uid", "store-a", "STAFF");
    const fromStaff = await service.create("store-a", "staff-uid", { name: "Staff" });
    expect(await service.verify(fromStaff.token)).toBeNull();

    const fromOwner = await service.create("store-a", "owner-uid", { name: "Leaving" });
    await database.query(`DELETE FROM "StoreMembership" WHERE "storeId" = 'store-a'`);
    expect(await service.verify(fromOwner.token)).toBeNull();
  });

  it("refuses bad names and expiry choices, and too many active tokens", async () => {
    await expect(service.create("store-a", "owner-uid", { name: "   " })).rejects.toMatchObject({ code: "INVALID_NAME" });
    await expect(service.create("store-a", "owner-uid", { name: "x".repeat(81) })).rejects.toMatchObject({ code: "INVALID_NAME" });
    await expect(service.create("store-a", "owner-uid", { name: "Odd", expiresInDays: 7 })).rejects.toMatchObject({ code: "INVALID_EXPIRY" });
    for (let index = 0; index < MAX_ACTIVE_TOKENS; index++) await service.create("store-a", "owner-uid", { name: `T${index}` });
    await expect(service.create("store-a", "owner-uid", { name: "One more" })).rejects.toMatchObject({ status: 409, code: "TOO_MANY_TOKENS" });
  });
});

describe("developer tokens in the assembled app", () => {
  it("upload a theme with a token, are refused on other stores and other routes, and stop when revoked", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "jelly-tokens-app-"));
    const database = await createPGliteDatabase();
    try {
      await seedStore(database, "store-a", "aaa");
      await seedStore(database, "store-b", "bbb");
      // The development sign-in is user "0", owner of store-a.
      await member(database, "0", "store-a", "OWNER");
      const commerceDatabase = { transaction: (work: (sql: SqlExecutor) => Promise<unknown>) => database.transaction((tx) => work({ query: (sql: string, values?: unknown[]) => tx.query(sql, values as never) } as never)) };
      const app = createApp({
        config: { port: 3001, nodeEnv: "test", corsOrigins: [], trustProxy: false, authProvider: "development", mediaProvider: "local-files", dataDirectory: directory, uploadDirectory: path.join(directory, "uploads"), maxUploadBytes: 1024 * 1024, demoStoreId: "store-a" },
        storefrontSql: database as never,
        commerceDatabase: commerceDatabase as never,
      } as never);
      const merchant = { Authorization: "Bearer jelly-demo-merchant" };

      const created = await request(app).post("/api/stores/store-a/developer-tokens").set(merchant).send({ name: "Laptop", expiresInDays: 90 });
      expect(created.status).toBe(201);
      expect(created.headers["cache-control"]).toBe("no-store");
      const token = created.body.token as string;
      const asToken = { Authorization: `Bearer ${token}` };
      expect((await request(app).post("/api/stores/store-a/developer-tokens").send({ name: "x" })).status).toBe(401);

      const listed = await request(app).get("/api/stores/store-a/developer-tokens").set(merchant);
      expect(listed.body.tokens).toHaveLength(1);
      expect(JSON.stringify(listed.body)).not.toContain(token);

      const uploaded = await request(app).post("/api/stores/store-a/theme-packages").set(asToken).send(examplePackage("token-theme"));
      expect(uploaded.status).toBe(201);
      expect((await request(app).get("/api/stores/store-a/theme-packages").set(asToken)).status).toBe(200);
      // Another store, and a route outside theme packages, are off limits.
      expect((await request(app).get("/api/stores/store-b/theme-packages").set(asToken)).status).toBe(403);
      expect((await request(app).get("/api/stores/store-a/developer-tokens").set(asToken)).status).toBe(401);

      await request(app).post(`/api/stores/store-a/developer-tokens/${created.body.summary.id}/revoke`).set(merchant).expect(204);
      const afterRevoke = await request(app).get("/api/stores/store-a/theme-packages").set(asToken);
      expect(afterRevoke.status).toBe(401);
      expect(afterRevoke.body.error.message).toContain("not valid");
    } finally { await database.close(); }
  });
});

function examplePackage(id: string) {
  const directory = [resolve(process.cwd(), "../docs/examples/jelly-studio"), resolve(process.cwd(), "docs/examples/jelly-studio")].find((candidate) => existsSync(candidate)) ?? "";
  const read = (name: string) => readFileSync(resolve(directory, name), "utf8").replaceAll("jelly-studio", id);
  const asset = (name: string) => ({ path: name, contentType: "image/svg+xml", base64: Buffer.from(read(`assets/${name}`)).toString("base64") });
  return { format: 1, manifest: JSON.parse(read("theme.json")), starter: JSON.parse(read("starter.json")), css: "", assets: [asset("preview.svg"), asset("mark.svg")] };
}
