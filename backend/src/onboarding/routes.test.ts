import { readFile } from "node:fs/promises";
import express from "express";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPGliteDatabase, type IntegrationDatabase } from "../../test/integration/pglite.js";
import type { CommerceDatabase } from "../commerce/repository.js";
import { ApiError, errorHandler } from "../http/errors.js";
import { createOnboardingRouter } from "./routes.js";
import { OnboardingService, type OnboardingPolicies } from "./service.js";

const maya = "11111111-1111-4111-8111-111111111111";
const alex = "22222222-2222-4222-8222-222222222222";
const policy: OnboardingPolicies = { termsUrl: "https://example.test/terms", privacyUrl: "https://example.test/privacy", version: "test-1" };

describe("merchant setup API", () => {
  let database: IntegrationDatabase;
  let adapter: CommerceDatabase;
  const app = express();
  const cleanup = vi.fn(async () => undefined);

  beforeAll(async () => {
    database = await createPGliteDatabase();
    for (const migration of ["20260918000000_add_store_owner.sql", "20261114000000_merchant_onboarding.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${migration}`, import.meta.url), "utf8"));
    }
    await database.query(
      `INSERT INTO "User" ("firebaseUid", "name", "email", "updatedAt")
       VALUES ($1, 'Maya Kim', 'maya@example.test', NOW()), ($2, 'Alex Green', 'alex@example.test', NOW())`,
      [maya, alex],
    );
    adapter = { transaction: work => database.transaction(work) };
    const service = new OnboardingService(adapter, async (sql, merchant, answers, _logo, onRollback) => {
      onRollback(cleanup);
      const store = {
        id: `store-${merchant}`, name: answers.name, slug: answers.slug, currency: "USD", country: answers.country, role: "OWNER" as const,
      };
      await sql.query(
        `INSERT INTO "Store" ("id","owner_user_id","name","slug","currency","country","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
        [store.id, merchant, store.name, store.slug, store.currency, store.country],
      );
      return store;
    }, policy);
    app.use(express.json());
    app.use("/api/onboarding", createOnboardingRouter({
      async verify(token) {
        if (!["maya", "alex", "unconfirmed"].includes(token)) throw new ApiError(401, "AUTH_INVALID", "Invalid sign-in.");
        return { userId: token === "maya" ? maya : alex, emailVerified: token !== "unconfirmed", storeIds: [], storeRoles: {} };
      },
    }, service));
    app.use(errorHandler);
  });

  afterAll(async () => { await database?.close(); });

  it("requires verified, current consent and owner-scopes all draft and image access", async () => {
    const base = "/api/onboarding";
    await request(app).get(base + "/policies").expect(200, policy);
    await request(app).get(base).expect(401);
    await request(app).post(base + "/consent").auth("unconfirmed", { type: "bearer" }).send({ version: policy.version }).expect(403);

    const args = { revision: 0, step: "store", answers: { fullName: "Maya Kim", name: "Maya Ceramics", slug: "maya-ceramics", country: "US" } };
    const initial = await request(app).get(base).auth("maya", { type: "bearer" }).expect(200);
    expect(initial.body).toMatchObject({ answers: { fullName: "Maya Kim" }, consentRequired: true });
    await request(app).patch(base).auth("maya", { type: "bearer" }).send(args).expect(403);
    await request(app).post(base + "/consent").auth("maya", { type: "bearer" }).send({ version: "old" }).expect(409);
    await request(app).post(base + "/consent").auth("maya", { type: "bearer" }).send({ version: policy.version }).expect(204);
    const draft = await request(app).patch(base).auth("maya", { type: "bearer" }).send(args).expect(200);
    expect(draft.body).toMatchObject({ revision: 1, step: "store", answers: args.answers, consentRequired: false });
    const conflict = await request(app).patch(base).auth("maya", { type: "bearer" }).send(args).expect(409);
    expect(conflict.body.error).toMatchObject({ code: "ONBOARDING_REVISION_CONFLICT", currentRevision: 1 });
    const independent = await request(app).get(base).auth("alex", { type: "bearer" }).expect(200);
    expect(independent.body.answers).toEqual({ fullName: "Alex Green" });

    const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: "red" } }).png().toBuffer();
    await request(app).put(base + "/images/profile").auth("maya", { type: "bearer" }).attach("file", png, "profile.png").expect(200);
    await request(app).get(base + "/images/profile").auth("maya", { type: "bearer" }).expect("Cache-Control", "no-store").expect("Content-Type", "image/webp").expect(200);
    await request(app).get(base + "/images/profile").auth("alex", { type: "bearer" }).expect(404);
    await request(app).put(base + "/images/logo").auth("maya", { type: "bearer" }).attach("file", Buffer.from("<svg/>"), "logo.svg").expect(415);
    await request(app).get(base + "/availability?slug=admin").auth("maya", { type: "bearer" }).expect(200, { available: false });

    const first = await request(app).post(base + "/complete").auth("maya", { type: "bearer" }).send({ revision: 1 }).expect(200);
    expect(first.body.store.slug).toBe("maya-ceramics");
    await request(app).post(base + "/complete").auth("maya", { type: "bearer" }).send({ revision: 1 }).expect(200, first.body);
    const profile = await request(app).get(base + "/profile").auth("maya", { type: "bearer" }).expect(200);
    expect(profile.body).toEqual({ fullName: "Maya Kim", bio: "", email: "maya@example.test", hasImage: true });
    await request(app).get(base + "/availability?slug=maya-ceramics").auth("alex", { type: "bearer" }).expect(200, { available: false });

    await request(app).post(base + "/consent").auth("alex", { type: "bearer" }).send({ version: policy.version }).expect(204);
    await request(app).patch(base).auth("alex", { type: "bearer" })
      .send({ revision: 0, step: "review", answers: { ...args.answers, fullName: "Alex Green" } }).expect(200);
    const taken = await request(app).post(base + "/complete").auth("alex", { type: "bearer" }).send({ revision: 1 }).expect(409);
    expect(taken.body.error.code).toBe("STORE_SLUG_TAKEN");
    expect(cleanup).toHaveBeenCalledTimes(1);
    const preserved = await request(app).get(base).auth("alex", { type: "bearer" }).expect(200);
    expect(preserved.body).toMatchObject({ revision: 1, step: "review", answers: { fullName: "Alex Green", slug: "maya-ceramics" }, store: null });
  });

  it("fails closed when deployment policy URLs are absent", async () => {
    const service = new OnboardingService(adapter, vi.fn(), null);
    expect(() => service.getPolicies()).toThrowError(expect.objectContaining({ status: 503 }));
    await expect(service.assertStoreCreationConsent(alex, false)).rejects.toMatchObject({ status: 503 });
    await expect(service.assertStoreCreationConsent(maya, true)).resolves.toBeUndefined();
  });

  it("keeps attached media if the connection drops after the completion transaction commits", async () => {
    const merchant = "33333333-3333-4333-8333-333333333333";
    const rollback = vi.fn(async () => undefined);
    let disconnectAfterCommit = false;
    const service = new OnboardingService({
      async transaction(work) {
        const result = await adapter.transaction(work);
        if (disconnectAfterCommit) {
          disconnectAfterCommit = false;
          throw new Error("Connection ended before the COMMIT reply arrived");
        }
        return result;
      },
    }, async (sql, userId, answers, _logo, onRollback) => {
      onRollback(rollback);
      const store = {
        id: "store-commit-reply-missing", name: answers.name, slug: answers.slug,
        currency: "USD", country: "US", role: "OWNER" as const,
      };
      await sql.query(
        `INSERT INTO "Store" ("id","owner_user_id","name","slug","currency","country","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
        [store.id, userId, store.name, store.slug, store.currency, store.country],
      );
      return store;
    }, policy);
    await service.acceptConsent(merchant, policy.version);
    const { saveOnboardingSchema } = await import("./schema.js");
    const saved = await service.save(merchant, saveOnboardingSchema.parse({
      revision: 0, step: "review",
      answers: { fullName: "Mina Chen", name: "Mina Gifts", slug: "mina-gifts", country: "US" },
    }));

    disconnectAfterCommit = true;
    await expect(service.complete(merchant, saved.revision)).resolves.toMatchObject({ id: "store-commit-reply-missing" });
    expect(rollback).not.toHaveBeenCalled();
  });
});
