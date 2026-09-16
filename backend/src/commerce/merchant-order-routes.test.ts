import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal } from "../auth/types.js";
import { errorHandler } from "../http/errors.js";
import { createMerchantOrderRouter } from "./merchant-order-routes.js";
import type { MerchantOrderService } from "./merchant-orders.js";

const otherStoreMerchant: MerchantPrincipal = {
  userId: 4,
  storeIds: ["store-other"],
  storeRoles: { "store-other": "OWNER" },
};

describe("merchant order routes", () => {
  it("rejects a refund request before looking up an order from another store", async () => {
    const service = { refund: vi.fn() } as unknown as MerchantOrderService;
    const auth: AuthProvider = { verify: async () => otherStoreMerchant };
    const app = express();
    app.use(express.json());
    app.use("/api/stores/:storeId/orders", createMerchantOrderRouter(service, auth));
    app.use(errorHandler);

    const response = await request(app)
      .post("/api/stores/store-1/orders/order-owned-by-store-1/refunds")
      .set("Authorization", "Bearer merchant-token")
      .send({});

    expect(response.status).toBe(403);
    expect(service.refund).not.toHaveBeenCalled();
  });
});
