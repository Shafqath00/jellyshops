import express from "express";
import type Stripe from "stripe";
import type { StripeGateway } from "../client.js";
import type { StripeAccountService } from "../accounts/service.js";
import type { SqlExecutor } from "../../commerce/repository.js";
import { WebhookReceiptRepository } from "./receipt-repository.js";

function eventValue(event: unknown): Record<string, unknown> { return event && typeof event === "object" ? event as Record<string, unknown> : {}; }
function accountId(event: unknown): string | null {
  const value = eventValue(event);
  const related = eventValue(value.related_object);
  const id = related.id ?? value.account;
  return typeof id === "string" && id.startsWith("acct_") ? id : null;
}

export function createAccountsV2WebhookRouter(gateway: StripeGateway, accountService: StripeAccountService, sql: SqlExecutor): express.Router {
  const router = express.Router();
  const receipts = new WebhookReceiptRepository(sql);
  router.post("/", express.raw({ type: "application/json" }), async (request, response) => {
    try {
      const signature = request.header("stripe-signature");
      if (!signature) return response.status(400).json({ error: { code: "STRIPE_SIGNATURE_INVALID" } });
      const event = gateway.constructEvent("accounts-v2", request.body as Buffer, signature) as unknown as Stripe.V2.Core.EventNotification;
      const value = eventValue(event);
      const id = typeof value.id === "string" ? value.id : "";
      const type = typeof value.type === "string" ? value.type : "";
      if (!id || !type) return response.status(400).json({ error: { code: "STRIPE_EVENT_INVALID" } });
      const account = accountId(event);
      const receipt = await receipts.record({ id: `wh-${id}`, stripeEventId: id, type, payload: value, endpointFamily: "accounts-v2", stripeAccountId: account });
      if (!receipt.duplicate && account && type !== "v2.core.account.closed") await accountService.syncAccount(account);
      if (!receipt.duplicate && account && type === "v2.core.account.closed") await (accountService as unknown as { markClosed?: (id: string) => Promise<unknown> }).markClosed?.(account);
      return response.status(200).json({ received: true, duplicate: receipt.duplicate });
    } catch { return response.status(400).json({ error: { code: "STRIPE_WEBHOOK_INVALID" } }); }
  });
  return router;
}
