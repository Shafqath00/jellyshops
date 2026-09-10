import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { FirebaseAuthProvider } from "../../src/auth/firebase-auth-provider.js";
import type { FirebaseTokenVerifier } from "../../src/auth/firebase-token-verifier.js";
import type { AppConfig } from "../../src/config.js";
import { PrismaStorefrontRepository } from "../../src/storefront/prisma-repository.js";
import { PrismaTenantRepository } from "../../src/tenants/prisma-tenant-repository.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

describe("merchant onboarding flow", () => {
  let fixture: IntegrationDatabase;
  let app: ReturnType<typeof createApp>;
  let storeId: string;

  const verifier: FirebaseTokenVerifier = {
    async verify(token) {
      if (token === "merchant-one") {
        return { uid: "merchant-one-uid", email: "one@example.test", emailVerified: true, name: "One" };
      }
      if (token === "merchant-two") {
        return { uid: "merchant-two-uid", email: "two@example.test", emailVerified: true, name: "Two" };
      }
      throw Object.assign(new Error("invalid"), { code: "auth/argument-error" });
    },
  };

  const authorization = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    fixture = await createIntegrationDatabase();
    const directory = await mkdtemp(path.join(tmpdir(), "jelly-merchant-flow-"));
    const config: AppConfig = {
      port: 3001,
      nodeEnv: "test",
      corsOrigins: ["http://localhost:3000"],
      authProvider: "firebase",
      repositoryProvider: "prisma",
      mediaProvider: "local-files",
      dataDirectory: directory,
      uploadDirectory: path.join(directory, "uploads"),
      maxUploadBytes: 1024 * 1024,
      demoStoreId: "store-demo",
    };
    const tenants = new PrismaTenantRepository(fixture.database.client);
    app = createApp({
      config,
      authProvider: new FirebaseAuthProvider(verifier, tenants),
      tenantRepository: tenants,
      storefrontRepository: new PrismaStorefrontRepository(fixture.database.client),
    });
  });

  afterAll(async () => {
    await fixture?.close();
  });

  it("onboards a merchant, creates a store, saves, publishes, and exposes only the public snapshot", async () => {
    const firstProfile = await request(app).get("/api/me").set(authorization("merchant-one"));
    expect(firstProfile.status).toBe(200);
    expect(firstProfile.body.stores).toEqual([]);

    const created = await request(app).post("/api/stores").set(authorization("merchant-one")).send({
      name: "Jelly Store",
      slug: "jelly-store",
      currency: "USD",
      country: "US",
    });
    expect(created.status).toBe(201);
    expect(created.body.store.role).toBe("OWNER");
    storeId = created.body.store.id;

    const listed = await request(app).get("/api/stores").set(authorization("merchant-one"));
    expect(listed.body.stores).toHaveLength(1);
    const draft = await request(app)
      .get(`/api/stores/${storeId}/storefront/draft`)
      .set(authorization("merchant-one"));
    const saved = await request(app)
      .put(`/api/stores/${storeId}/storefront/draft`)
      .set(authorization("merchant-one"))
      .send({ expectedRevision: 0, document: draft.body.document });
    expect(saved.status).toBe(200);
    expect(saved.body.revision).toBe(1);
    const published = await request(app)
      .post(`/api/stores/${storeId}/storefront/publish`)
      .set(authorization("merchant-one"))
      .send({ expectedRevision: 1 });
    expect(published.status).toBe(201);
    const publicRead = await request(app).get(`/api/stores/${storeId}/storefront/public`);
    expect(publicRead.status).toBe(200);
    expect(publicRead.body.sourceRevision).toBe(1);
  });

  it("denies a second merchant every private store and media operation", async () => {
    for (const operation of [
      request(app).get(`/api/stores/${storeId}/storefront/draft`),
      request(app).put(`/api/stores/${storeId}/storefront/draft`).send({ expectedRevision: 1, document: {} }),
      request(app).post(`/api/stores/${storeId}/storefront/publish`).send({ expectedRevision: 1 }),
      request(app).get(`/api/stores/${storeId}/media`),
      request(app).post(`/api/stores/${storeId}/media`),
      request(app).delete(`/api/stores/${storeId}/media/none`),
    ]) {
      const response = await operation.set(authorization("merchant-two"));
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("STORE_FORBIDDEN");
    }
  });

  it("hides archived stores from merchant lists and public reads", async () => {
    await fixture.database.client.store.update({ where: { id: storeId }, data: { archivedAt: new Date() } });
    const listed = await request(app).get("/api/stores").set(authorization("merchant-one"));
    expect(listed.body.stores).toEqual([]);
    await expect(request(app).get(`/api/stores/${storeId}/storefront/public`)).resolves.toMatchObject({ status: 404 });
  });
});
