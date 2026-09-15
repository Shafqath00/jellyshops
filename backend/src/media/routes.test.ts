import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import type { AppConfig } from "../config.js";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function createMediaApp() {
  const directory = await mkdtemp(path.join(tmpdir(), "jelly-media-"));
  const config: AppConfig = {
    port: 3001,
    nodeEnv: "test",
    corsOrigins: ["http://localhost:3000"],
    authProvider: "development",
    repositoryProvider: "local-json",
    mediaProvider: "local-files",
    dataDirectory: path.join(directory, "data"),
    uploadDirectory: path.join(directory, "uploads"),
    maxUploadBytes: 1024 * 1024,
    demoStoreId: "store-demo",
  };
  return createApp({ config });
}

describe("media routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    app = await createMediaApp();
  });

  it("stores a decoded PNG under an opaque id", async () => {
    const response = await request(app)
      .post("/api/stores/store-demo/media")
      .set("Authorization", "Bearer jelly-demo-merchant")
      .attach("file", tinyPng, { filename: "../../hero.png", contentType: "image/png" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      mimeType: "image/png",
      originalName: "hero.png",
      referenced: false,
      width: 1,
      height: 1,
    });
    expect(response.body.id).toMatch(/[0-9a-f-]{36}/);
    expect(response.body.url).toBe(`/api/public/media/store-demo/${response.body.id}`);
  });

  it("rejects executable content labelled as an image", async () => {
    const response = await request(app)
      .post("/api/stores/store-demo/media")
      .set("Authorization", "Bearer jelly-demo-merchant")
      .attach("file", Buffer.from("console.log('x')"), { filename: "fake.png", contentType: "image/png" });

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("MEDIA_TYPE_UNSUPPORTED");
  });

  it("lists, serves, and deletes an unreferenced upload", async () => {
    const uploaded = await request(app)
      .post("/api/stores/store-demo/media")
      .set("Authorization", "Bearer jelly-demo-merchant")
      .attach("file", tinyPng, { filename: "hero.png", contentType: "image/png" });

    const list = await request(app)
      .get("/api/stores/store-demo/media")
      .set("Authorization", "Bearer jelly-demo-merchant");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(uploaded.body.id);

    const publicImage = await request(app).get(uploaded.body.url);
    expect(publicImage.status).toBe(200);
    expect(publicImage.headers["content-type"]).toMatch(/^image\/png/);
    expect(publicImage.body).toEqual(tinyPng);

    const removed = await request(app)
      .delete(`/api/stores/store-demo/media/${uploaded.body.id}`)
      .set("Authorization", "Bearer jelly-demo-merchant");
    expect(removed.status).toBe(204);
    expect((await request(app).get(uploaded.body.url)).status).toBe(404);
  });
});
