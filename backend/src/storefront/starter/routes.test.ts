import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal } from "../../auth/types.js";
import { errorHandler } from "../../http/errors.js";
import { createStorefrontStarterRouter, type StorefrontStarterApi } from "./routes.js";

const principal: MerchantPrincipal = { userId: "merchant-a", storeIds: ["store-a"], storeRoles: { "store-a": "OWNER" } };
const authProvider: AuthProvider = { verify: async () => principal };

function setup() {
  const api: StorefrontStarterApi = { install: vi.fn(async (storeId, starterPackId) => ({ storeId, starterPackId: starterPackId as "fresh-market", starterPackVersion: "1.0.0", generation: 1, installed: true })) };
  const app = express();
  app.use((req, _res, next) => { req.id = "starter-test"; next(); });
  app.use("/api/stores/:storeId/storefront/starters", createStorefrontStarterRouter(api, authProvider));
  app.use(errorHandler);
  return { app, api };
}

describe("storefront starter install route", () => {
  it("installs using the authenticated store context", async () => {
    const { app, api } = setup();
    const response = await request(app).post("/api/stores/store-a/storefront/starters/fresh-market/install").set("Authorization", "Bearer token");
    expect(response.status).toBe(201);
    expect(api.install).toHaveBeenCalledWith("store-a", "fresh-market");
  });

  it("rejects unknown starter IDs and cross-store requests", async () => {
    const { app, api } = setup();
    const unknown = await request(app).post("/api/stores/store-a/storefront/starters/unknown/install").set("Authorization", "Bearer token");
    const forbidden = await request(app).post("/api/stores/store-b/storefront/starters/fresh-market/install").set("Authorization", "Bearer token");
    expect(unknown.status).toBe(400);
    expect(forbidden.status).toBe(404);
    expect(api.install).not.toHaveBeenCalled();
  });
});
