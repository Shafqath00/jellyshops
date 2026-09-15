import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../http/errors.js";
import type { AuthProvider } from "../auth/types.js";
import type { TenantRepository } from "./repository.js";
import { createMerchantRouter } from "./routes.js";

function setup() {
  const auth: AuthProvider = {
    verify: vi.fn().mockResolvedValue({
      userId: 42,
      storeIds: [],
      storeRoles: {},
    }),
  };
  const tenants: TenantRepository = {
    resolveMerchant: vi.fn(),
    listStores: vi.fn().mockResolvedValue([]),
    createStore: vi.fn(),
  };
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.id = "merchant-routes-test";
    next();
  });
  app.use("/api", createMerchantRouter(auth, tenants));
  app.use(errorHandler);
  const authed = () => ({ Authorization: "Bearer client-id-token" });
  return { auth, tenants, app, authed };
}

describe("merchant routes", () => {
  it("returns the authenticated merchant and its current stores", async () => {
    const { app, tenants, authed } = setup();
    vi.mocked(tenants.listStores).mockResolvedValue([
      { id: "store-a", name: "A", slug: "a-store", currency: "USD", country: "US", role: "OWNER" },
    ]);

    const response = await request(app).get("/api/me").set(authed());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      merchantId: 42,
      stores: [{ id: "store-a", name: "A", slug: "a-store", currency: "USD", country: "US", role: "OWNER" }],
    });
    expect(tenants.listStores).toHaveBeenCalledWith(42);
  });

  it("lists stores through the same authenticated merchant", async () => {
    const { app, tenants, authed } = setup();

    const response = await request(app).get("/api/stores").set(authed());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ stores: [] });
    expect(tenants.listStores).toHaveBeenCalledWith(42);
  });

  it("creates a native owner store from a strict validated request", async () => {
    const { app, tenants, authed } = setup();
    vi.mocked(tenants.createStore).mockResolvedValue({
      id: "store-new",
      name: "Jelly Goods",
      slug: "jelly-goods",
      currency: "USD",
      country: "US",
      role: "OWNER",
    });

    const response = await request(app).post("/api/stores").set(authed()).send({
      name: "  Jelly Goods  ",
      slug: "jelly-goods",
      currency: "USD",
      country: "US",
    });

    expect(response.status).toBe(201);
    expect(response.body.store).toMatchObject({ id: "store-new", role: "OWNER" });
    expect(tenants.createStore).toHaveBeenCalledWith(42, {
      name: "Jelly Goods",
      slug: "jelly-goods",
      currency: "USD",
      country: "US",
    });
  });

  it("rejects malformed and extra store fields without calling persistence", async () => {
    const { app, tenants, authed } = setup();

    const response = await request(app).post("/api/stores").set(authed()).send({
      name: "",
      slug: "Bad Slug",
      currency: "usd",
      country: "USA",
      commerceProvider: "SHOPIFY",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("REQUEST_INVALID");
    expect(response.body.error.issues).toEqual(expect.any(Array));
    expect(tenants.createStore).not.toHaveBeenCalled();
  });

  it("rejects an invalid principal identifier before tenant access", async () => {
    const { app, auth, tenants, authed } = setup();
    vi.mocked(auth.verify).mockResolvedValue({ userId: 0, storeIds: [], storeRoles: {} });

    const response = await request(app).get("/api/stores").set(authed());

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("PRINCIPAL_INVALID");
    expect(tenants.listStores).not.toHaveBeenCalled();
  });
});
