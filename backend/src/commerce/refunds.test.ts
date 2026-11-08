import { describe, expect, it, vi } from "vitest";
import { RefundService } from "./refunds.js";

it("creates a full refund in the connected-account context", async () => {
  const tx = { query: vi.fn(async (sql: string) => sql.includes('FROM "Order"') ? { rows: [{ id: "o", status: "PAID" }] } : sql.includes('FROM "Payment"') ? { rows: [{ id: "p", status: "PAID", amountMinor: 100, paymentIntentId: "pi_1", stripeAccountId: "acct_1" }] } : sql.includes('FROM "Refund"') ? { rows: [] } : { rows: [{ id: "r" }] }), releaseAttempt: vi.fn() };
  const repo = { transaction: vi.fn(async (work: any) => work(tx)) } as any;
  const stripe = { createFullRefund: vi.fn(async () => ({ id: "re_1" })) } as any;
  await new RefundService(repo, stripe).fullRefund("s", "o");
  expect(stripe.createFullRefund).toHaveBeenCalledWith(expect.objectContaining({ paymentIntentId: "pi_1" }), expect.objectContaining({ connectedAccountId: "acct_1" }));
});
