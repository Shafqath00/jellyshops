import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import type { AppConfig } from "../config.js";

async function createTestApp() {
  const directory = await mkdtemp(path.join(tmpdir(), "jelly-api-"));
  const config: AppConfig = {
    port: 3001,
    nodeEnv: "test",
    corsOrigins: ["http://localhost:3000"],
    authProvider: "development",
    repositoryProvider: "local-json",
    mediaProvider: "local-files",
    dataDirectory: directory,
    uploadDirectory: path.join(directory, "uploads"),
    maxUploadBytes: 1024 * 1024,
    demoStoreId: "store-demo",
  };
  return createApp({ config });
}

function authed(app: ReturnType<typeof createApp>) {
  return {
    get: (url: string) => request(app).get(url).set("Authorization", "Bearer jelly-demo-merchant"),
    put: (url: string) => request(app).put(url).set("Authorization", "Bearer jelly-demo-merchant"),
    post: (url: string) => request(app).post(url).set("Authorization", "Bearer jelly-demo-merchant"),
  };
}

describe("legacy storefront routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("keeps the V3 draft readable for migration compatibility", async () => {
    const response = await authed(app).get("/api/stores/store-demo/storefront/draft");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ storeId: "store-demo", revision: 0 });
    expect(response.body.document.regions.template[0].type).toBe("hero");
  });

  it("rejects legacy draft writes so new changes cannot bypass normalized resources", async () => {
    const initial = await authed(app).get("/api/stores/store-demo/storefront/draft");
    const response = await authed(app)
      .put("/api/stores/store-demo/storefront/draft")
      .send({ expectedRevision: 0, document: initial.body.document });

    expect(response.status).toBe(404);
    const unchanged = await authed(app).get("/api/stores/store-demo/storefront/draft");
    expect(unchanged.body.revision).toBe(0);
  });

  it("temporarily keeps V3 publication available until compiler publishing replaces it", async () => {
    const response = await authed(app)
      .post("/api/stores/store-demo/storefront/publish")
      .send({ expectedRevision: 0 });

    expect(response.status).toBe(201);
    const publicResponse = await request(app).get("/api/stores/store-demo/storefront/public");
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.sourceRevision).toBe(0);
  });
});
