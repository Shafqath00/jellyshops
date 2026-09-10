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

describe("storefront routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it("creates and returns a private default draft", async () => {
    const response = await authed(app).get("/api/stores/store-demo/storefront/draft");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ storeId: "store-demo", revision: 0 });
    expect(response.body.document.regions.template[0].type).toBe("hero");
  });

  it("returns a typed conflict for a stale save", async () => {
    const initial = await authed(app).get("/api/stores/store-demo/storefront/draft");
    const body = { expectedRevision: 0, document: initial.body.document };
    await authed(app).put("/api/stores/store-demo/storefront/draft").send(body);
    const response = await authed(app).put("/api/stores/store-demo/storefront/draft").send(body);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("DRAFT_CONFLICT");
    expect(response.body.error.currentRevision).toBe(1);
  });

  it("keeps an edited draft private until publication", async () => {
    const initial = await authed(app).get("/api/stores/store-demo/storefront/draft");
    initial.body.document.regions.template[0].blocks[0].settings.text = "Private heading";
    await authed(app)
      .put("/api/stores/store-demo/storefront/draft")
      .send({ expectedRevision: 0, document: initial.body.document });

    expect((await request(app).get("/api/stores/store-demo/storefront/public")).status).toBe(404);

    await authed(app)
      .post("/api/stores/store-demo/storefront/publish")
      .send({ expectedRevision: 1 });
    const publicResponse = await request(app).get("/api/stores/store-demo/storefront/public");

    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.document.regions.template[0].blocks[0].settings.text).toBe("Private heading");
  });
});
