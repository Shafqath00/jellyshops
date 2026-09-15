import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal } from "../auth/types.js";
import { errorHandler } from "../http/errors.js";
import { createCustomDataRouter } from "./routes.js";

const principal: MerchantPrincipal = {
  userId: 9,
  storeIds: ["store-a"],
  storeRoles: { "store-a": "ADMIN" },
};
const auth: AuthProvider = { verify: async () => principal };

function setup() {
  const customData = {
    createMetafieldDefinition: vi.fn(async (_storeId, input) => ({ id: "def-1", ...input })),
    listMetafieldDefinitions: vi.fn(async () => []),
    updateMetafieldDefinition: vi.fn(async (_storeId, id, patch) => ({ id, ...patch })),
    setMetafieldValue: vi.fn(async (_storeId, definitionId, ownerId, value) => ({ definitionId, ownerId, value })),
  };
  const metaobjects = {
    createDefinition: vi.fn(async (_storeId, input) => ({ id: "meta-def", ...input })),
    listDefinitions: vi.fn(async () => []),
    updateDefinition: vi.fn(async (_storeId, id, patch) => ({ id, ...patch })),
    createEntry: vi.fn(async (_storeId, definitionId, input) => ({ id: "entry-1", definitionId, ...input })),
    listEntries: vi.fn(async () => []),
    updateEntry: vi.fn(async (_storeId, id, patch) => ({ id, ...patch })),
  };
  const registry = {
    listDynamicSources: vi.fn(async () => [{
      id: "resource:product:title",
      label: "Product title",
      valueType: "string",
      requiredContext: "product",
      binding: { kind: "resource_field", resource: "product", field: "title" },
    }]),
  };
  const app = express();
  app.use((req, _res, next) => { req.id = "custom-data-test"; next(); });
  app.use(express.json());
  app.use("/api/stores/:storeId/custom-data", createCustomDataRouter({ customData, metaobjects, registry }, auth));
  app.use(errorHandler);
  return { app, customData, registry };
}

describe("custom data routes", () => {
  it("uses the authorized store for definition creation", async () => {
    const { app, customData } = setup();
    const response = await request(app)
      .post("/api/stores/store-a/custom-data/metafields")
      .set("Authorization", "Bearer token")
      .send({
        storeId: "store-b",
        ownerType: "product",
        namespace: "details",
        key: "material",
        name: "Material",
        type: "string",
        storefrontVisible: true,
        origin: "jelly",
      });

    expect(response.status).toBe(201);
    expect(customData.createMetafieldDefinition).toHaveBeenCalledWith(
      "store-a",
      expect.not.objectContaining({ storeId: "store-b" }),
    );
  });

  it("lists dynamic source contracts without loading values", async () => {
    const { app, registry } = setup();
    const response = await request(app)
      .get("/api/stores/store-a/custom-data/dynamic-sources?context=product&accepts=string")
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(200);
    expect(registry.listDynamicSources).toHaveBeenCalledWith("store-a", "product", ["string"]);
    expect(response.body[0].id).toBe("resource:product:title");
  });

  it("rejects access to another store before any custom-data call", async () => {
    const { app, customData } = setup();
    const response = await request(app)
      .get("/api/stores/store-b/custom-data/metafields?ownerType=product")
      .set("Authorization", "Bearer token");

    expect(response.status).toBe(403);
    expect(customData.listMetafieldDefinitions).not.toHaveBeenCalled();
  });
});
