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

  it("publishes through the compiled workspace endpoint", async () => {
    const response = await authed(app)
      .post("/api/stores/store-demo/storefront/publish")
      .send({ expectedGeneration: 0, idempotencyKey: "publish-test-1" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, publication: { storeId: "store-demo", sourceGeneration: 0 } });
    expect((await request(app).get("/api/stores/store-demo/storefront/public")).status).toBe(200);
  });

  it("serves the saved public storefront instead of the default fallback document", async () => {
    const appWithPublishedTheme = createApp({
      config: {
        port: 3001,
        nodeEnv: "test",
        corsOrigins: ["http://localhost:3000"],
        authProvider: "development",
        repositoryProvider: "local-json",
        mediaProvider: "local-files",
        dataDirectory: "./data",
        uploadDirectory: "./uploads",
        maxUploadBytes: 1024 * 1024,
        demoStoreId: "store-demo",
      },
      publicStorefrontApi: {
        load: async () => ({
          id: "publication-store-demo-14",
          document: {
            schemaVersion: 3,
            storeId: "store-demo",
            theme: { presetId: "artisan-boutique", settings: {} },
            regions: { header: [], template: [{ id: "artisan-hero", type: "hero", enabled: true, settings: {}, blocks: [] }], footer: [] },
            pages: [],
          },
        }),
      },
    });

    const response = await request(appWithPublishedTheme).get("/api/stores/store-demo/storefront/public");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: "publication-store-demo-14",
      document: { theme: { presetId: "artisan-boutique" }, regions: { template: [{ id: "artisan-hero" }] } },
    });
  });
});
