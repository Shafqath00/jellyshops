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

  it("rejects development auth in production", () => {
    expect(() =>
      loadConfig({ NODE_ENV: "production", AUTH_PROVIDER: "development" }),
    ).toThrow("AUTH_PROVIDER=development is not allowed in production");
  });
});
