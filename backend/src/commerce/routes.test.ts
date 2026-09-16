import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCommerceRouter, createPublicOrderRouter } from "./routes.js";
import { CheckoutService } from "./service.js";
import { errorHandler } from "../http/errors.js";
import type { CommerceRepository, CommerceTransaction } from "./repository.js";
import type { CatalogReader } from "../catalog/service.js";
import type { StripeAccountService } from "../stripe/accounts/service.js";

function setup() {
  const service = {
    begin: vi.fn(async () => ({ attemptId: "attempt-1", orderId: "order-1", publicToken: "token-123" })),
  } as unknown as CheckoutService;

  const app = express();
  app.use(express.json());
  app.use("/api/public/stores/:storeId/checkout", createCommerceRouter(service));
  app.use(errorHandler);

  return { app, service };
}

describe("commerce routes", () => {
  it("POST /attempts calls CheckoutService.begin", async () => {
    const { app, service } = setup();
    const response = await request(app)
      .post("/api/public/stores/store-1/checkout/attempts")
      .send({
        cartKey: "cart-123",
        currency: "usd",
        items: [{ variantId: "v1", quantity: 1 }],
        customerSnapshot: { email: "test@example.com" },
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      attemptId: "attempt-1",
      orderId: "order-1",
      publicToken: "token-123",
    });
    expect(service.begin).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-1" }));
  });

  it("GET public order uses the public token and returns the server view", async () => {
    const service = { getPublicOrder: vi.fn(async () => ({ order: { id: "order-1" }, items: [], payment: null })) } as unknown as CheckoutService;
    const app = express();
    app.use("/api/public/stores/:storeId/orders", createPublicOrderRouter(service));
    app.use(errorHandler);
    const response = await request(app).get("/api/public/stores/store-1/orders/public-token");
    expect(response.status).toBe(200);
    expect(response.body.order.id).toBe("order-1");
    expect(service.getPublicOrder).toHaveBeenCalledWith("store-1", "public-token");
  });
});
