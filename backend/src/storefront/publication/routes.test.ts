import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal } from "../../auth/types.js";
import { errorHandler } from "../../http/errors.js";
import { createStorefrontPublicationRouter, type StorefrontPublicationApi } from "./routes.js";

const principal: MerchantPrincipal = {
  userId: 7,
  storeIds: ["store-a"],
  storeRoles: { "store-a": "OWNER" },
};
const authProvider: AuthProvider = { verify: async () => principal };

function setup() {
  const api: StorefrontPublicationApi = {
    publish: vi.fn(async () => ({
      ok: true as const,
      publication: { id: "pub-1", storeId: "store-a", sourceGeneration: 8 },
      diagnostics: [],
      reused: false,
    })),
  };
  const app = express();
  app.use((req, _res, next) => { req.id = "publish-test"; next(); });
  app.use(express.json());
  app.use("/api/stores/:storeId/storefront", createStorefrontPublicationRouter(api, authProvider));
  app.use(errorHandler);
  return { app, api };
}

describe("compiled storefront publish route", () => {
  it("publishes using the authorized store and actor user", async () => {
    const { app, api } = setup();
    const response = await request(app)
      .post("/api/stores/store-a/storefront/publish")
      .set("Authorization", "Bearer token")
      .send({ expectedGeneration: 8, idempotencyKey: "publish-123" });

    expect(response.status).toBe(201);
    expect(api.publish).toHaveBeenCalledWith("store-a", 8, "publish-123", 7);
    expect(response.body).toMatchObject({ ok: true, reused: false, publication: { id: "pub-1" } });
  });

  it("returns 200 when an idempotent publish is reused", async () => {
    const { app, api } = setup();
    vi.mocked(api.publish).mockResolvedValueOnce({
      ok: true,
      publication: { id: "pub-1", storeId: "store-a", sourceGeneration: 8 },
      diagnostics: [],
      reused: true,
    });

    const response = await request(app)
      .post("/api/stores/store-a/storefront/publish")
      .set("Authorization", "Bearer token")
      .send({ expectedGeneration: 8, idempotencyKey: "publish-123" });

    expect(response.status).toBe(200);
    expect(response.body.reused).toBe(true);
  });

  it("returns compiler diagnostics without creating a publication", async () => {
    const { app, api } = setup();
    vi.mocked(api.publish).mockResolvedValueOnce({
      ok: false,
      diagnostics: [{ severity: "error", code: "MISSING_GLOBAL_SECTION", message: "Missing global" }],
    });

    const response = await request(app)
      .post("/api/stores/store-a/storefront/publish")
      .set("Authorization", "Bearer token")
      .send({ expectedGeneration: 8, idempotencyKey: "publish-123" });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ ok: false, diagnostics: [{ code: "MISSING_GLOBAL_SECTION" }] });
  });

  it("requires storefront publish permission", async () => {
    const designer: MerchantPrincipal = {
      userId: 9,
      storeIds: ["store-a"],
      storeRoles: { "store-a": "DESIGNER" },
    };
    const provider: AuthProvider = { verify: async () => designer };
    const { api } = setup();
    const app = express();
    app.use((req, _res, next) => { req.id = "publish-test"; next(); });
    app.use(express.json());
    app.use("/api/stores/:storeId/storefront", createStorefrontPublicationRouter(api, provider));
    app.use(errorHandler);

    const response = await request(app)
      .post("/api/stores/store-a/storefront/publish")
      .set("Authorization", "Bearer token")
      .send({ expectedGeneration: 8, idempotencyKey: "publish-123" });

    expect(response.status).toBe(403);
    expect(api.publish).not.toHaveBeenCalled();
  });
});
