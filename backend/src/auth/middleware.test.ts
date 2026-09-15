import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal, StorePermission } from "./types.js";
import { requireMerchant, requireStorePermission } from "./middleware.js";
import { errorHandler } from "../http/errors.js";

function createProtectedApp(principal: MerchantPrincipal, permission: StorePermission) {
  const app = express();
  app.use((request, _response, next) => {
    request.id = "request-test";
    next();
  });
  app.get(
    "/api/stores/:storeId/private-check",
    requireMerchant({ verify: async () => principal } satisfies AuthProvider),
    requireStorePermission(permission),
    (request, response) => response.status(200).json(request.storeContext),
  );
  app.use(errorHandler);
  return app;
}

describe("merchant authentication", () => {
  const owner: MerchantPrincipal = {
    userId: 1,
    storeIds: ["store-demo"],
    storeRoles: { "store-demo": "OWNER" },
  };

  it("accepts an authorized store and attaches its request context", async () => {
    const response = await request(createProtectedApp(owner, "storefront:view"))
      .get("/api/stores/store-demo/private-check")
      .set("Authorization", "Bearer jelly-demo-merchant");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ storeId: "store-demo", userId: 1, role: "OWNER" });
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
    const response = await request(createProtectedApp(owner, "storefront:view"))
      .get("/api/stores/store-other/private-check")
      .set("Authorization", "Bearer jelly-demo-merchant");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("STORE_FORBIDDEN");
  });

  it.each([
    ["OWNER", "storefront:publish", 200],
    ["ADMIN", "storefront:publish", 200],
    ["DESIGNER", "storefront:edit", 200],
    ["DESIGNER", "storefront:publish", 403],
    ["DEVELOPER", "developer:build", 200],
    ["DEVELOPER", "developer:publish", 403],
    ["STAFF", "content:view", 200],
    ["STAFF", "storefront:edit", 403],
    ["ORDER_MANAGER", "catalog:view", 200],
    ["ORDER_MANAGER", "storefront:edit", 403],
  ] as const)("applies %s permissions for %s", async (role, permission, expectedStatus) => {
    const principal: MerchantPrincipal = {
      userId: 2,
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
      userId: 3,
      storeIds: ["store-demo"],
      storeRoles: {},
    }, "storefront:view"))
      .get("/api/stores/store-demo/private-check")
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(403);
  });
});
