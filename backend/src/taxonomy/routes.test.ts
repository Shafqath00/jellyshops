import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal } from "../auth/types.js";
import { errorHandler } from "../http/errors.js";
import { createTaxonomyRouter } from "./routes.js";

const principal = (role: "ADMIN" | "ORDER_MANAGER"): MerchantPrincipal => ({ userId: 9, storeIds: ["store-a"], storeRoles: { "store-a": role } });

function setup(role: "ADMIN" | "ORDER_MANAGER" = "ADMIN") {
  const service = {
    tree: vi.fn(async () => ({ categories: [], templates: [] })),
    createCategory: vi.fn(async (_s, input) => ({ id: "c1", ...input })),
    updateCategory: vi.fn(async (_s, id, patch) => ({ id, ...patch })),
    archiveCategory: vi.fn(async () => undefined),
    createTemplate: vi.fn(async (_s, categoryId, input) => ({ id: "t1", categoryId, ...input })),
    updateTemplate: vi.fn(async (_s, id, patch) => ({ id, ...patch })),
    deleteTemplate: vi.fn(async () => undefined),
  };
  const auth: AuthProvider = { verify: async () => principal(role) };
  const app = express();
  app.use((req, _res, next) => { req.id = "taxonomy-test"; next(); });
  app.use(express.json());
  app.use("/api/stores/:storeId/taxonomy", createTaxonomyRouter(service, auth));
  app.use(errorHandler);
  return { app, service };
}
const authed = (r: request.Test) => r.set("Authorization", "Bearer t");

describe("taxonomy routes", () => {
  it("lists the tree for the authorised store", async () => {
    const { app, service } = setup();
    expect((await authed(request(app).get("/api/stores/store-a/taxonomy/categories"))).status).toBe(200);
    expect(service.tree).toHaveBeenCalledWith("store-a");
  });
  it("denies other stores", async () => {
    const { app, service } = setup();
    expect((await authed(request(app).get("/api/stores/store-b/taxonomy/categories"))).status).toBeGreaterThanOrEqual(403);
    expect(service.tree).not.toHaveBeenCalled();
  });
  it("creates a category and validates the body", async () => {
    const { app, service } = setup();
    const ok = await authed(request(app).post("/api/stores/store-a/taxonomy/categories")).send({ name: "  Hats ", parentId: null });
    expect(ok.status).toBe(201);
    expect(service.createCategory).toHaveBeenCalledWith("store-a", { name: "Hats", parentId: null });
    expect((await authed(request(app).post("/api/stores/store-a/taxonomy/categories")).send({ name: " " })).status).toBe(400);
    expect((await authed(request(app).patch("/api/stores/store-a/taxonomy/categories/c1")).send({})).status).toBe(400);
  });
  it("applies template defaults and validates kinds", async () => {
    const { app, service } = setup();
    const ok = await authed(request(app).post("/api/stores/store-a/taxonomy/categories/c1/templates")).send({ name: "Size" });
    expect(ok.status).toBe(201);
    expect(service.createTemplate).toHaveBeenCalledWith("store-a", "c1", { name: "Size", optionKind: "configuration", displayType: "buttons", required: false, multiple: false, defaultValues: [] });
    expect((await authed(request(app).post("/api/stores/store-a/taxonomy/categories/c1/templates")).send({ name: "Size", optionKind: "bogus" })).status).toBe(400);
  });
  it("lets read-only roles list but not edit", async () => {
    const { app, service } = setup("ORDER_MANAGER");
    expect((await authed(request(app).get("/api/stores/store-a/taxonomy/categories"))).status).toBe(200);
    expect((await authed(request(app).post("/api/stores/store-a/taxonomy/categories")).send({ name: "Hats" })).status).toBe(403);
    expect(service.createCategory).not.toHaveBeenCalled();
  });
  it("archives categories and deletes templates with 204", async () => {
    const { app } = setup();
    expect((await authed(request(app).delete("/api/stores/store-a/taxonomy/categories/c1"))).status).toBe(204);
    expect((await authed(request(app).delete("/api/stores/store-a/taxonomy/templates/t1"))).status).toBe(204);
  });
});
