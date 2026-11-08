import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../../test/integration/pglite.js";
import { errorHandler } from "../../http/errors.js";
import { accessToken, hashPassword, tokenMatches, verifyPassword } from "./password.js";
import { createPublicAccessRouter } from "./routes.js";
import { StorefrontAccessService } from "./service.js";

describe("password hashing", () => {
  it("verifies the right password, rejects others, and never stores it as text", async () => {
    const hash = await hashPassword("open sesame");
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain("open sesame");
    expect(await verifyPassword("open sesame", hash)).toBe(true);
    expect(await verifyPassword("Open sesame", hash)).toBe(false);
    expect(await verifyPassword("open sesame", "plain-text")).toBe(false);
    expect(await hashPassword("open sesame")).not.toBe(hash);
  });

  it("ties access tokens to the store and the current password", async () => {
    const hash = await hashPassword("one");
    const token = accessToken("store-a", hash);
    expect(tokenMatches("store-a", hash, token)).toBe(true);
    expect(tokenMatches("store-b", hash, token)).toBe(false);
    expect(tokenMatches("store-a", await hashPassword("two"), token)).toBe(false);
    expect(tokenMatches("store-a", hash, undefined)).toBe(false);
  });
});

describe("StorefrontAccessService", () => {
  let database: IntegrationDatabase;
  let clock = 0;
  let service: StorefrontAccessService;
  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "a");
    await seedStore(database, "store-b", "b");
    clock = 0;
    service = new StorefrontAccessService(database as never, () => clock);
  });
  afterEach(async () => database.close());

  it("is off until a password is set, and refuses to turn on without one", async () => {
    await expect(service.getSettings("store-a")).resolves.toEqual({ enabled: false, hasPassword: false, message: "" });
    await expect(service.status("store-a")).resolves.toEqual({ protected: false, unlocked: true, message: "" });
    await expect(service.saveSettings("store-a", { enabled: true })).rejects.toMatchObject({ code: "PASSWORD_REQUIRED" });
    await expect(service.saveSettings("store-a", { password: "ab" })).rejects.toMatchObject({ code: "INVALID_PASSWORD" });
  });

  it("protects one store only, unlocks with the password and signs shoppers out when it changes", async () => {
    await service.saveSettings("store-a", { password: "tulip", enabled: true, message: "  Opening soon  " });
    await expect(service.getSettings("store-a")).resolves.toEqual({ enabled: true, hasPassword: true, message: "Opening soon" });
    expect(JSON.stringify(await service.getSettings("store-a"))).not.toContain("scrypt");
    await expect(service.status("store-b")).resolves.toMatchObject({ protected: false, unlocked: true });
    await expect(service.status("store-a")).resolves.toEqual({ protected: true, unlocked: false, message: "Opening soon" });

    expect(await service.unlock("store-a", "wrong", "1.1.1.1")).toBeNull();
    const token = await service.unlock("store-a", "tulip", "1.1.1.1");
    expect(token).toBeTruthy();
    await expect(service.status("store-a", token)).resolves.toMatchObject({ unlocked: true });
    expect(await service.unlock("store-b", "tulip", "1.1.1.1")).toBeNull();

    await service.saveSettings("store-a", { password: "daisy" });
    await expect(service.status("store-a", token)).resolves.toMatchObject({ protected: true, unlocked: false });
    await service.saveSettings("store-a", { enabled: false });
    await expect(service.status("store-a", token)).resolves.toMatchObject({ protected: false, unlocked: true });
    await expect(service.getSettings("store-a")).resolves.toMatchObject({ enabled: false, hasPassword: true });
  });

  it("limits wrong tries per store and address, and lets them in again after a minute", async () => {
    await service.saveSettings("store-a", { password: "tulip", enabled: true });
    for (let attempt = 0; attempt < 8; attempt++) expect(await service.unlock("store-a", "nope", "2.2.2.2")).toBeNull();
    await expect(service.unlock("store-a", "tulip", "2.2.2.2")).rejects.toMatchObject({ status: 429 });
    expect(await service.unlock("store-a", "tulip", "3.3.3.3")).toBeTruthy();
    clock = 61_000;
    expect(await service.unlock("store-a", "tulip", "2.2.2.2")).toBeTruthy();
  });

  it("serves status and unlock over HTTP without caching", async () => {
    await service.saveSettings("store-a", { password: "tulip", enabled: true });
    const app = express();
    app.use(express.json());
    app.use("/api/public/stores/:storeId/storefront/access", createPublicAccessRouter(service));
    app.use(errorHandler);
    const base = "/api/public/stores/store-a/storefront/access";
    expect((await request(app).post(`${base}/unlock`).send({ password: "bad" })).status).toBe(401);
    const ok = await request(app).post(`${base}/unlock`).send({ password: "tulip" });
    expect(ok.status).toBe(200);
    expect(ok.headers["cache-control"]).toBe("no-store");
    const status = await request(app).get(`${base}/status`).set("x-storefront-access", ok.body.token);
    expect(status.body).toMatchObject({ protected: true, unlocked: true });
    expect((await request(app).get(`${base}/status`)).body.unlocked).toBe(false);
  });
});
