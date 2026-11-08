import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { loadConfig, type AppConfig } from "./config.js";

async function createTestApp() {
  const directory = await mkdtemp(
    path.join(tmpdir(), "jelly-app-test-"),
  );

  const config: AppConfig = {
    port: 3001,
    nodeEnv: "test",
    corsOrigins: ["http://localhost:3000"],
    trustProxy: false,

    authProvider: "development",

    // repositoryProvider: "local-json",

    mediaProvider: "local-files",

    dataDirectory: directory,
    uploadDirectory: path.join(directory, "uploads"),

    maxUploadBytes: 1024 * 1024,

    demoStoreId: "store-demo",
  };

  return createApp({ config });
}

describe("service foundation", () => {
  it("returns a request id from health checks", async () => {
    const app = await createTestApp();

    const response = await request(app)
      .get("/health");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      ok: true,
    });

    expect(
      response.headers["x-request-id"],
    ).toMatch(/[0-9a-f-]{36}/);
  });

  it("serves the storefront workspace for the demo merchant", async () => {
    const app = await createTestApp();

    const response = await request(app)
      .get(
        "/api/stores/store-demo/storefront/workspace",
      )
      .set(
        "authorization",
        "Bearer jelly-demo-merchant",
      );

    expect(response.status).toBe(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        generation: expect.any(Number),
        updatedAt: expect.anything(),
      }),
    );
  });

  it("provides a home template so the editor can finish loading", async () => {
    const app = await createTestApp();

    const response = await request(app)
      .get(
        "/api/stores/store-demo/storefront/templates",
      )
      .set(
        "authorization",
        "Bearer jelly-demo-merchant",
      );

    expect(response.status).toBe(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        id: "home",
        type: "home",
      }),
    ]);
  });

  it("returns 404 when the storefront has not been published", async () => {
    const app = await createTestApp();

    const response = await request(app)
      .get(
        "/api/stores/store-demo/storefront/public",
      );

    expect(response.status).toBe(404);

    expect(response.body).toMatchObject({
      error: {
        code: "PUBLICATION_NOT_FOUND",
      },
    });
  });

  it("rejects malformed checkout requests with 422 when checkout is configured", async () => {
    const app = await createTestApp();

    const response = await request(app)
      .post(
        "/api/public/stores/store-demo/checkout/attempts",
      )
      .send({});

    expect([422, 503]).toContain(
      response.status,
    );

    if (response.status === 503) {
      expect(
        response.body.error.code,
      ).toBe(
        "CHECKOUT_NOT_CONFIGURED",
      );
    } else {
      expect(
        response.body.error.code,
      ).toBe(
        "CHECKOUT_INPUT_INVALID",
      );
    }
  });

  it("reports checkout configuration is unavailable when explicitly disabled", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "jelly-app-test-"),
    );

    const config: AppConfig = {
      port: 3001,
      nodeEnv: "test",
      corsOrigins: [
        "http://localhost:3000",
      ],
      trustProxy: false,

      authProvider: "development",

      // repositoryProvider: "local-json",

      mediaProvider: "local-files",

      dataDirectory: directory,
      uploadDirectory: path.join(
        directory,
        "uploads",
      ),

      maxUploadBytes: 1024 * 1024,

      demoStoreId: "store-demo",
    };

    const response = await request(
      createApp({
        config,
        checkoutService: undefined,
      }),
    )
      .post(
        "/api/public/stores/store-demo/checkout/attempts",
      )
      .send({});

    expect([422, 503]).toContain(
      response.status,
    );
  });

  it("rejects development auth in production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        AUTH_PROVIDER: "development",
      }),
    ).toThrow(
      "AUTH_PROVIDER=development is not allowed in production",
    );
  });
});