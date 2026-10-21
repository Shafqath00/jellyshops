import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createConnectPaymentsWebhookRouter } from "./connect-payments-route.js";
import type { StripeGateway } from "../client.js";

describe("Connect payments webhook route", () => {
  it("retries an existing receipt when its previous processing failed", async () => {
    const gateway = { constructEvent: vi.fn(() => ({ id: "evt_retry", type: "payment_intent.payment_failed", account: "acct_1", data: { object: { id: "pi_1" } } })) } as unknown as StripeGateway;
    const sql = { query: vi.fn(async (statement: string) => {
      if (statement.includes('FROM "StripeWebhookEvent"')) return { rows: [{ id: "receipt-retry", processedAt: null }] };
      if (statement.includes('FROM "Payment"')) return { rows: [{ id: "pay-1", orderId: "order-1", storeId: "store-1", status: "PENDING" }] };
      return { rows: [] };
    }) };
    const app = express(); app.use("/webhook", createConnectPaymentsWebhookRouter(gateway, sql));
    const response = await request(app).post("/webhook").set("stripe-signature", "sig").send({});
    expect(response.status).toBe(200);
    expect(sql.query.mock.calls.some(([statement]) => statement.includes('UPDATE "Payment"'))).toBe(true);
  });

  it("uses top-level event.account and acknowledges a payment event", async () => {
    const gateway = { constructEvent: vi.fn(() => ({ id: "evt_1", type: "payment_intent.payment_failed", account: "acct_1", data: { object: { id: "pi_1" } } })) } as unknown as StripeGateway;
    const sql = { query: vi.fn(async (statement: string) => statement.includes("INSERT") ? { rows: [{ id: "receipt-1" }] } : { rows: [] }) };
    const app = express(); app.use("/webhooks/stripe/connect-payments", createConnectPaymentsWebhookRouter(gateway, sql));
    const response = await request(app).post("/webhooks/stripe/connect-payments").set("stripe-signature", "sig").send({});
    expect(response.status).toBe(200);
    expect(sql.query).toHaveBeenCalledWith(expect.stringContaining('"stripeAccountId"'), expect.arrayContaining(["acct_1"]));
  });
});
