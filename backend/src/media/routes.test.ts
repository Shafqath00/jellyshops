import sharp from "sharp";
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

async function createMediaApp(extra: Partial<AppConfig> = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "jelly-media-"));
  const config: AppConfig = {
    port: 3001,
    nodeEnv: "test",
    corsOrigins: ["http://localhost:3000"],
    trustProxy: false,
    authProvider: "development",
    repositoryProvider: "local-json",
    mediaProvider: "local-files",
    dataDirectory: path.join(directory, "data"),
    uploadDirectory: path.join(directory, "uploads"),
    maxUploadBytes: 1024 * 1024,
    demoStoreId: "store-demo",
    ...extra,
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

  it("serves WebP derivatives with immutable caching and distinct representation validators", async () => {
    const uploaded = await request(app).post("/api/stores/store-demo/media")
      .set("Authorization", "Bearer jelly-demo-merchant")
      .attach("file", tinyPng, { filename: "hero.png", contentType: "image/png" });
    const original = await request(app).get(uploaded.body.url);
    const resized = await request(app).get(`${uploaded.body.url}?w=320`);
    expect(resized.headers["content-type"]).toMatch(/^image\/webp/);
    expect(resized.headers["cache-control"]).toBe("public, max-age=31536000, s-maxage=31536000, immutable");
    expect(resized.headers.etag).toMatch(/^"[a-f0-9]{32}-320"$/);
    expect(resized.headers.etag).not.toBe(original.headers.etag);
    expect((await request(app).get(`${uploaded.body.url}?w=320`).set("If-None-Match", resized.headers.etag)).status).toBe(304);
    for (const width of ["0", "500", "320.0", "", "320&w=640"]) {
      expect((await request(app).get(`${uploaded.body.url}?w=${width}`)).status).toBe(400);
    }
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
    expect(await sharp(publicImage.body).raw().toBuffer()).toEqual(await sharp(tinyPng).raw().toBuffer());

    const removed = await request(app)
      .delete(`/api/stores/store-demo/media/${uploaded.body.id}`)
      .set("Authorization", "Bearer jelly-demo-merchant");
    expect(removed.status).toBe(204);
    expect((await request(app).get(uploaded.body.url)).status).toBe(404);
  });
  it("points old photo addresses at the public photo domain once one is configured", async () => {
    const cdnApp = await createMediaApp({ mediaPublicBase: "https://img.example.test" });
    const photo = await sharp({ create: { width: 700, height: 500, channels: 3, background: "red" } }).png().toBuffer();
    const uploaded = await request(cdnApp).post("/api/stores/store-demo/media").set("Authorization", "Bearer jelly-demo-merchant").attach("file", photo, { filename: "bed.png", contentType: "image/png" });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.publicUrl).toBe(`https://img.example.test/store-demo/${uploaded.body.id}.png`);
    const original = await request(cdnApp).get(uploaded.body.url);
    expect(original.status).toBe(301);
    expect(original.headers.location).toBe(uploaded.body.publicUrl);
    expect(original.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    // A 700px photo has copies at 320, 640 and its own width (960); 1920 is served by the largest one.
    expect((await request(cdnApp).get(`${uploaded.body.url}?w=640`)).headers.location).toBe(`${uploaded.body.publicUrl}.w640.webp`);
    expect((await request(cdnApp).get(`${uploaded.body.url}?w=1920`)).headers.location).toBe(`${uploaded.body.publicUrl}.w960.webp`);
    expect((await request(cdnApp).get(`${uploaded.body.url}?w=500`)).status).toBe(400);
  });
});

describe("media upload plan rules", () => {
  const trialRules = { uploadRules: async () => ({ fileBytes: 200 * 1024, uploadsPerMinute: 3 }), check: async () => {}, checkFileSize: async () => {}, usage: async () => ({}) };

  async function appWithRules(rules: { uploadRules: () => Promise<{ fileBytes: number; uploadsPerMinute: number } | null> }) {
    const directory = await mkdtemp(path.join(tmpdir(), "jelly-media-plan-"));
    const config: AppConfig = {
      port: 3001, nodeEnv: "test", corsOrigins: ["http://localhost:3000"], trustProxy: false, authProvider: "development",
      repositoryProvider: "local-json", mediaProvider: "local-files", dataDirectory: path.join(directory, "data"),
      uploadDirectory: path.join(directory, "uploads"), maxUploadBytes: 1024 * 1024, demoStoreId: "store-demo",
    };
    return createApp({ config, planLimits: rules as never });
  }

  it("refuses a file over the plan's size with 413 before reading it", async () => {
    const app = await appWithRules(trialRules);
    const response = await request(app)
      .post("/api/stores/store-demo/media")
      .set("Authorization", "Bearer jelly-demo-merchant")
      .attach("file", Buffer.alloc(400 * 1024), { filename: "big.png", contentType: "image/png" });
    expect(response.status).toBe(413);
    expect(response.body.error ?? response.body).toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("limits uploads per store per minute with 429", async () => {
    const app = await appWithRules(trialRules);
    const send = () => request(app).post("/api/stores/store-demo/media").set("Authorization", "Bearer jelly-demo-merchant")
      .attach("file", tinyPng, { filename: "a.png", contentType: "image/png" });
    for (let index = 0; index < 3; index++) expect((await send()).status).toBe(201);
    const refused = await send();
    expect(refused.status).toBe(429);
    expect(refused.body.error ?? refused.body).toMatchObject({ code: "UPLOAD_RATE_LIMIT" });
  });
});
