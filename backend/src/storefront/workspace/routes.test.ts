import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal } from "../../auth/types.js";
import { errorHandler } from "../../http/errors.js";
import { createStorefrontWorkspaceRouter, type StorefrontWorkspaceApi } from "./routes.js";

const principal: MerchantPrincipal = {
  userId: 7,
  storeIds: ["store-a"],
  storeRoles: { "store-a": "ADMIN" },
};
const authProvider: AuthProvider = { verify: async () => principal };

function setup() {
  const api: StorefrontWorkspaceApi = {
    getWorkspace: vi.fn(async () => ({ generation: 12, updatedAt: new Date(0) })),
    listTemplates: vi.fn(async () => []),
    getTemplate: vi.fn(async () => null),
    createTemplate: vi.fn(async () => ({ template: { id: "template-1", revision: 0 }, generation: 13 })),
    updateTemplate: vi.fn(async () => ({ template: { id: "template-1", revision: 4 }, generation: 14 })),
    cloneTemplate: vi.fn(async () => ({ template: { id: "template-2", revision: 0 }, generation: 14 })),
    listGlobalSections: vi.fn(async () => []),
    getGlobalSection: vi.fn(async () => null),
    createGlobalSection: vi.fn(async () => ({ globalSection: { id: "global-1", revision: 0 }, generation: 13 })),
    updateGlobalSection: vi.fn(async () => ({ globalSection: { id: "global-1", revision: 2 }, generation: 14 })),
    listPresets: vi.fn(async () => []),
    createPreset: vi.fn(async () => ({ preset: { id: "preset-1", revision: 0 }, generation: 13 })),
    instantiatePreset: vi.fn(async () => ({ id: "section-copy", type: "hero" })),
    listMenus: vi.fn(async () => []),
    getMenu: vi.fn(async () => null),
    createMenu: vi.fn(async () => ({ menu: { id: "menu-1", revision: 0 }, generation: 13 })),
    updateMenu: vi.fn(async () => ({ menu: { id: "menu-1", revision: 3 }, generation: 14 })),
    getThemeConfiguration: vi.fn(async () => null),
    saveThemeConfiguration: vi.fn(async () => ({ theme: { storeId: "store-a", revision: 1 }, generation: 13 })),
    getAssignment: vi.fn(async () => null),
    assignTemplate: vi.fn(async () => ({ assignment: { resourceType: "page", resourceId: "page-1", revision: 0 }, generation: 13 })),
  };
  const app = express();
  app.use((req, _res, next) => { req.id = "workspace-test"; next(); });
  app.use(express.json());
  app.use("/api/stores/:storeId/storefront", createStorefrontWorkspaceRouter(api, authProvider));
  app.use(errorHandler);
  return { app, api };
}

describe("normalized storefront workspace routes", () => {
  it("returns workspace generation only to an authorized store member", async () => {
    const { app, api } = setup();
    const allowed = await request(app)
      .get("/api/stores/store-a/storefront/workspace")
      .set("Authorization", "Bearer token");
    const denied = await request(app)
      .get("/api/stores/store-b/storefront/workspace")
      .set("Authorization", "Bearer token");

    expect(allowed.status).toBe(200);
    expect(allowed.body.generation).toBe(12);
    expect(denied.status).toBe(403);
    expect(api.getWorkspace).toHaveBeenCalledWith("store-a");
  });

  it("passes expected revision separately when updating a template", async () => {
    const { app, api } = setup();
    const response = await request(app)
      .patch("/api/stores/store-a/storefront/templates/template-1")
      .set("Authorization", "Bearer token")
      .send({ expectedRevision: 3, name: "Featured", storeId: "store-b" });

    expect(response.status).toBe(200);
    expect(api.updateTemplate).toHaveBeenCalledWith(
      "store-a",
      "template-1",
      3,
      { name: "Featured" },
    );
    expect(response.body.generation).toBe(14);
  });

  it("creates nested menus using the authorized store context", async () => {
    const { app, api } = setup();
    const items = [{ id: "shop", label: "Shop", target: { kind: "collection", resourceId: "collection-1" }, children: [] }];
    const response = await request(app)
      .post("/api/stores/store-a/storefront/menus")
      .set("Authorization", "Bearer token")
      .send({ name: "Main", handle: "main", items, storeId: "store-b" });

    expect(response.status).toBe(201);
    expect(api.createMenu).toHaveBeenCalledWith("store-a", { name: "Main", handle: "main", items });
  });

  it("upserts an assignment with null create revision and explicit resource type", async () => {
    const { app, api } = setup();
    const response = await request(app)
      .put("/api/stores/store-a/storefront/assignments/page/page-1")
      .set("Authorization", "Bearer token")
      .send({ templateId: "template-page", expectedRevision: null });

    expect(response.status).toBe(200);
    expect(api.assignTemplate).toHaveBeenCalledWith("store-a", {
      resourceType: "page",
      resourceId: "page-1",
      templateId: "template-page",
      expectedRevision: null,
    });
  });

  it("uses storefront edit permission for mutations", async () => {
    const designer: MerchantPrincipal = {
      userId: 8,
      storeIds: ["store-a"],
      storeRoles: { "store-a": "STAFF" },
    };
    const provider: AuthProvider = { verify: async () => designer };
    const { api } = setup();
    const app = express();
    app.use((req, _res, next) => { req.id = "workspace-test"; next(); });
    app.use(express.json());
    app.use("/api/stores/:storeId/storefront", createStorefrontWorkspaceRouter(api, provider));
    app.use(errorHandler);

    const response = await request(app)
      .post("/api/stores/store-a/storefront/templates")
      .set("Authorization", "Bearer token")
      .send({ type: "page", name: "Default", layout: { sections: [] } });

    expect(response.status).toBe(403);
    expect(api.createTemplate).not.toHaveBeenCalled();
  });
});
