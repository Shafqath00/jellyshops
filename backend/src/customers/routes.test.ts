import express from "express";
import request from "supertest";
import { expect, it, vi } from "vitest";
import { createCustomerRouter, createEngagementRouter } from "./routes.js";
import { errorHandler } from "../http/errors.js";
import type { CustomerService } from "./service.js";

it("rejects missing/unverified customer authentication before calling data services", async () => {
  const profile = vi.fn(); const verify = vi.fn(async () => ({ id: "user", email: "user@example.test", verified: false }));
  const app = express();
  app.use("/stores/:storeId/customer", createCustomerRouter({ profile } as unknown as CustomerService, verify)); app.use(errorHandler);
  await request(app).get("/stores/a/customer/profile").expect(401);
  expect(verify).not.toHaveBeenCalled();
  await request(app).get("/stores/a/customer/profile").set("Authorization", "Bearer token").expect(401);
  expect(profile).not.toHaveBeenCalled();
});

it("rate-limits newsletter capture and never discloses unsubscribe credentials", async () => {
  const subscribe = vi.fn(async () => ({ token: "private-unsubscribe-token" })); const limiter = vi.fn(async () => {});
  const app = express(); app.use(express.json());
  app.use("/stores/:storeId/engagement", createEngagementRouter({ subscribe } as unknown as CustomerService, limiter)); app.use(errorHandler);
  const response = await request(app).post("/stores/a/engagement/newsletter").send({ email: "a@example.test", consent: true, source: "footer" }).expect(202);
  expect(response.body).toEqual({ accepted: true });
  expect(limiter).toHaveBeenCalledWith("a", expect.any(String));
  expect(response.headers["cache-control"]).toBe("no-store");
});
