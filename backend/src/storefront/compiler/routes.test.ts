import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal } from "../../auth/types.js";
import { errorHandler } from "../../http/errors.js";
import { WorkspaceGenerationConflictError } from "../workspace/errors.js";
import { createStorefrontCompilerRouter, type StorefrontCompilerApi } from "./routes.js";

const principal: MerchantPrincipal = {
  userId: 7,
  storeIds: ["store-a"],
  storeRoles: { "store-a": "DESIGNER" },
};
const authProvider: AuthProvider = { verify: async () => principal };

function setup() {
  const api: StorefrontCompilerApi = {
    compile: vi.fn(async () => ({
      ok: true,
      diagnostics: [{ severity: "warning", code: "SEO_DESCRIPTION_MISSING", message: "Missing SEO" }],
      dependencies: { edges: [] },
      snapshot: { schemaVersion: 4, storeId: "store-a", sourceGeneration: 5 },
    })),
  };
  const app = express();
  app.use((req, _res, next) => { req.id = "compiler-test"; next(); });
  app.use(express.json());
  app.use("/api/stores/:storeId/storefront", createStorefrontCompilerRouter(api, authProvider));
  app.use(errorHandler);
  return { app, api };
}

describe("storefront compiler routes", () => {
  it("validates the requested workspace generation without publishing", async () => {
    const { app, api } = setup();
    const response = await request(app)
      .post("/api/stores/store-a/storefront/validate")
      .set("Authorization", "Bearer token")
      .send({ expectedGeneration: 5 });

    expect(response.status).toBe(200);
    expect(api.compile).toHaveBeenCalledWith("store-a", 5);
    expect(response.body).toMatchObject({ ok: true, diagnostics: [{ severity: "warning" }] });
    expect(response.body).not.toHaveProperty("snapshot");
  });

  it("returns the compiled snapshot for preview without publishing it", async () => {
    const { app, api } = setup();
    const response = await request(app)
      .post("/api/stores/store-a/storefront/preview/compile")
      .set("Authorization", "Bearer token")
      .send({ expectedGeneration: 5 });

    expect(response.status).toBe(200);
    expect(response.body.snapshot).toMatchObject({ schemaVersion: 4, sourceGeneration: 5 });
  });

  it("returns blocking diagnostics without a preview snapshot", async () => {
    const { app, api } = setup();
    vi.mocked(api.compile).mockResolvedValueOnce({
      ok: false,
      diagnostics: [{ severity: "error", code: "MISSING_GLOBAL_SECTION", message: "Missing global" }],
      dependencies: { edges: [] },
    });

    const response = await request(app)
      .post("/api/stores/store-a/storefront/preview/compile")
      .set("Authorization", "Bearer token")
      .send({ expectedGeneration: 5 });

    expect(response.status).toBe(422);
    expect(response.body.ok).toBe(false);
    expect(response.body).not.toHaveProperty("snapshot");
  });

  it("exposes the current generation when the requested preview is stale", async () => {
    const { app, api } = setup();
    vi.mocked(api.compile).mockRejectedValueOnce(new WorkspaceGenerationConflictError(6));

    const response = await request(app)
      .post("/api/stores/store-a/storefront/validate")
      .set("Authorization", "Bearer token")
      .send({ expectedGeneration: 5 });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({ code: "WORKSPACE_GENERATION_CONFLICT", currentGeneration: 6 });
  });
});
