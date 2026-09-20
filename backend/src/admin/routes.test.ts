import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import type { AuthProvider } from "../auth/types.js";
import { errorHandler } from "../http/errors.js";
import { createAdminRouter } from "./routes.js";

describe("admin routes", () => {
  it("rejects a summary request for a store outside the merchant context", async () => {
    const auth: AuthProvider = { verify: async () => ({ userId: "merchant-a", storeIds: ["store-a"], storeRoles: { "store-a": "OWNER" } }) };
    const summary = { getSummary: vi.fn() };
    const customers = { list: vi.fn(), get: vi.fn() };
    const app = express();
    app.use("/api/stores/:storeId", createAdminRouter({ summary, customers }, auth));
    app.use(errorHandler);
    await request(app).get("/api/stores/store-b/admin-summary").set("Authorization", "Bearer token").expect(403);
    expect(summary.getSummary).not.toHaveBeenCalled();
  });
});
