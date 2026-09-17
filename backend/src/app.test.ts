import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

describe("service foundation", () => {
  it("returns a request id from health checks", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers["x-request-id"]).toMatch(/[0-9a-f-]{36}/);
  });

  it("serves the storefront workspace for the demo merchant", async () => {
    const response = await request(createApp())
      .get("/api/stores/store-demo/storefront/workspace")
      .set("authorization", "Bearer jelly-demo-merchant");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      generation: expect.any(Number),
      updatedAt: expect.any(String),
    }));
  });

  it("provides a home template so the editor can finish loading", async () => {
    const response = await request(createApp())
      .get("/api/stores/store-demo/storefront/templates")
      .set("authorization", "Bearer jelly-demo-merchant");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([expect.objectContaining({ id: "home", type: "home" })]);
  });

  it("returns the current public storefront document", async () => {
    const response = await request(createApp()).get("/api/stores/store-demo/storefront/public");

    expect(response.status).toBe(200);
    expect(response.body.document).toEqual(expect.objectContaining({
      storeId: "store-demo",
      theme: expect.objectContaining({ presetId: expect.any(String) }),
      regions: expect.objectContaining({ template: expect.any(Array) }),
    }));
  });

  it("reports checkout configuration is unavailable instead of returning a misleading 404", async () => {
    const response = await request(createApp())
      .post("/api/public/stores/store-demo/checkout/attempts")
      .send({});

    expect(response.status).toBe(503);
    expect(response.body.error).toEqual(expect.objectContaining({
      code: "CHECKOUT_NOT_CONFIGURED",
    }));
  });

  it("rejects development auth in production", () => {
    expect(() =>
      loadConfig({ NODE_ENV: "production", AUTH_PROVIDER: "development" }),
    ).toThrow("AUTH_PROVIDER=development is not allowed in production");
  });
});
