import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createAccountsV2WebhookRouter } from "./accounts-v2-route.js";
import type { StripeGateway } from "../client.js";
import type { StripeAccountService } from "../accounts/service.js";

function setup() {
  const gateway = { constructEvent: vi.fn(), } as unknown as StripeGateway;
  const accountService = { syncAccount: vi.fn(), markClosed: vi.fn() } as unknown as StripeAccountService;
  const sql = { query: vi.fn(async (statement: string) => statement.includes("INSERT") ? { rows: [{ id: "wh-event" }] } : { rows: [] }) };
  const app = express();
  app.use("/webhooks/stripe/accounts-v2", createAccountsV2WebhookRouter(gateway, accountService, sql));
  return { app, gateway, accountService, sql };
}

describe("Accounts v2 webhook route", () => {
  it("rejects a request without a signature before recording a receipt", async () => {
    const { app, sql } = setup();
    const response = await request(app).post("/webhooks/stripe/accounts-v2").send({ id: "evt_1" });
    expect(response.status).toBe(400);
    expect(sql.query).not.toHaveBeenCalled();
  });

  it("records a thin event and synchronizes the related account", async () => {
    const { app, gateway, accountService } = setup();
    vi.mocked(gateway.constructEvent).mockReturnValue({ id: "evt_1", type: "v2.core.account.updated", related_object: { id: "acct_123" } } as any);
    const response = await request(app).post("/webhooks/stripe/accounts-v2").set("stripe-signature", "sig").send({ id: "evt_1" });
    expect(response.status).toBe(200);
    expect(accountService.syncAccount).toHaveBeenCalledWith("acct_123");
  });
});
