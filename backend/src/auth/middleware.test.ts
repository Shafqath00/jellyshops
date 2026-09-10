import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal, StorePermission } from "./types.js";
import { requireMerchant, requireStoreAccess } from "./middleware.js";
import { errorHandler } from "../http/errors.js";

function createProtectedApp(principal: MerchantPrincipal, permission?: StorePermission) {
  const app = express();
  app.use((request, _response, next) => {
    request.id = "request-test";
    next();
  });
  app.get(
    "/api/stores/:storeId/private-check",
    requireMerchant({ verify: async () => principal } satisfies AuthProvider),
    requireStoreAccess(permission),
    (_request, response) => response.sendStatus(204),
  );
  app.use(errorHandler);
  return app;
}

describe("merchant authentication", () => {
  const owner = {
    merchantId: "merchant-demo",
    storeIds: ["store-demo"],
    storeRoles: { "store-demo": "OWNER" as const },
  };

  it("accepts the configured demo token for its store", async () => {
    const response = await request(createProtectedApp(owner))
      .get("/api/stores/store-demo/private-check")
      .set("Authorization", "Bearer jelly-demo-merchant");

    expect(response.status).toBe(204);
  });

  it("rejects a missing bearer token without calling the provider", async () => {
    const verify = vi.fn();
    const app = express();
    app.get("/private", requireMerchant({ verify }), (_request, response) => response.sendStatus(204));
    app.use(errorHandler);

    const response = await request(app).get("/private");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_INVALID");
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects a valid merchant for another store", async () => {
    const response = await request(createProtectedApp(owner))
      .get("/api/stores/store-other/private-check")
      .set("Authorization", "Bearer jelly-demo-merchant");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("STORE_FORBIDDEN");
  });

  it.each([
    ["OWNER", "storefront:write", 204],
    ["ADMIN", "media:write", 204],
    ["DESIGNER", "storefront:write", 204],
    ["STAFF", "storefront:read", 204],
    ["ORDER_MANAGER", "media:read", 204],
    ["STAFF", "storefront:write", 403],
    ["ORDER_MANAGER", "media:write", 403],
  ] as const)("applies %s permissions for %s", async (role, permission, expectedStatus) => {
    const principal: MerchantPrincipal = {
      merchantId: "merchant-role",
      storeIds: ["store-demo"],
      storeRoles: { "store-demo": role },
    };
    const response = await request(createProtectedApp(principal, permission))
      .get("/api/stores/store-demo/private-check")
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(expectedStatus);
  });

  it("denies permission when a membership has no role", async () => {
    const response = await request(createProtectedApp({
      merchantId: "merchant-missing-role",
      storeIds: ["store-demo"],
      storeRoles: {},
    }, "storefront:read"))
      .get("/api/stores/store-demo/private-check")
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(403);
  });
});
