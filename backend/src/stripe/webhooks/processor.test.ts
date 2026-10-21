import { describe, expect, it, vi } from "vitest";
import { processConnectPaymentEvent } from "./processor.js";

describe("connect payment processor", () => {
  it("does not acknowledge a receipt before its payment transition commits", async () => {
    const sql = { query: vi.fn(async (statement: string) => {
      if (statement.includes('FROM "Payment"')) return { rows: [{ id: "pay-1", orderId: "order-1", storeId: "store-1", status: "PENDING" }] };
      if (statement.includes('sold_reservations AS')) throw new Error("database unavailable");
      return { rows: [] };
    }) };
    await expect(processConnectPaymentEvent(sql, { id: "receipt-retry", stripeAccountId: "acct_1", type: "payment_intent.succeeded", payload: { data: { object: { id: "pi_1" } } } })).rejects.toThrow("database unavailable");
    expect(sql.query.mock.calls.some(([statement]) => statement.includes('SET "processedAt"'))).toBe(false);
  });

  it("marks a successful direct payment paid and sells held inventory", async () => {
    const sql = { query: vi.fn(async (statement: string) => {
      if (statement.includes('FROM "Payment"')) return { rows: [{ id: "pay-1", orderId: "order-1", storeId: "store-1", status: "PENDING" }] };
      return { rows: [{ id: "x" }] };
    }) };
    await processConnectPaymentEvent(sql, { id: "receipt-1", stripeAccountId: "acct_1", type: "payment_intent.succeeded", payload: { id: "evt_1", data: { object: { id: "pi_1" } } } });
    expect(sql.query).toHaveBeenCalledWith(
      expect.stringContaining('sold_reservations AS'),
      ["order-1", "store-1", "pay-1"],
    );
    expect(sql.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "InventoryLevel" AS inventory'),
      ["order-1", "store-1", "pay-1"],
    );
  });
});

  it("allows a verified successful payment after a failed attempt without regressing settled states", async () => {
    const sql = { query: vi.fn(async (statement: string) => statement.includes('FROM "Payment"') ? { rows: [{ id: "pay-1", orderId: "order-1", storeId: "store-1", status: "FAILED" }] } : { rows: [] }) };
    await processConnectPaymentEvent(sql, { id: "retry-success", stripeAccountId: "acct_1", type: "payment_intent.succeeded", payload: { data: { object: { id: "pi_1" } } } });
    const settlement = sql.query.mock.calls.find(([statement]) => statement.includes('paid_payment AS'))![0];
    expect(settlement).toContain(`"status" IN ('PENDING', 'PROCESSING', 'FAILED')`);
  });

  it("does not treat a partially refunded charge as a full refund", async () => {
    const sql = { query: vi.fn(async (_statement: string) => ({ rows: [{ id: "p1", orderId: "o1", storeId: "s1" }] })) };
    await processConnectPaymentEvent(sql, { id: "partial", stripeAccountId: "acct_1", type: "charge.refunded", payload: { data: { object: { id: "ch_1", payment_intent: "pi_1", amount: 1000, amount_refunded: 300, refunded: false } } } });
    expect(sql.query.mock.calls.some(([statement]) => statement.includes(`SET "status" = 'REFUNDED'`))).toBe(false);
    expect(sql.query.mock.calls.some(([statement]) => statement.includes('UPDATE "InventoryLevel"'))).toBe(false);
  });

  it("processes a fully refunded legacy charge but prevents restocking fulfilled goods", async () => {
    const sql = { query: vi.fn(async (_statement: string) => ({ rows: [{ id: "p1", orderId: "o1", storeId: "s1" }] })) };
    await processConnectPaymentEvent(sql, { id: "full", stripeAccountId: "acct_1", type: "charge.refunded", payload: { data: { object: { id: "ch_1", payment_intent: "pi_1", amount: 1000, amount_refunded: 1000, refunded: true } } } });
    expect(sql.query.mock.calls.some(([statement]) => statement.includes(`SET "status" = 'REFUNDED'`))).toBe(true);
    const restock = sql.query.mock.calls.find(([statement]) => statement.includes('UPDATE "InventoryLevel"'))![0];
    expect(restock).toContain('original_order."fulfilmentStartedAt" IS NULL');
  });

  it("delegates ledger-managed charge refunds before legacy status or inventory mutations", async () => {
    const sql = { query: vi.fn(async (_statement: string) => ({ rows: [] })) };
    const hooks = { settlePaymentIntent: vi.fn(), settleRefund: vi.fn(), settleChargeRefund: vi.fn().mockResolvedValue(true) };
    await processConnectPaymentEvent(sql, { id: "managed-refund", stripeAccountId: "acct_1", type: "charge.refunded", payload: { data: { object: { id: "ch_1", payment_intent: { id: "pi_1" }, refunded: true } } } }, hooks);
    expect(hooks.settleChargeRefund).toHaveBeenCalledWith("pi_1", sql, "acct_1");
    expect(sql.query.mock.calls).toHaveLength(1);
    expect(sql.query.mock.calls[0][0]).toContain('SET "processedAt"');
  });

  it("releases cancellation reservations and decrements reserved inventory in one guarded statement", async () => {
    let cancelled = false;
    const sql = { query: vi.fn(async (statement: string) => {
      if (statement.includes('SELECT *') && statement.includes('FROM "Payment"')) return { rows: [{ id: "p1", orderId: "o1", storeId: "s1" }] };
      if (statement.includes('UPDATE "Order"')) { if (cancelled) return { rows: [] }; cancelled = true; return { rows: [{ id: "o1" }] }; }
      if (statement.includes('FROM "CheckoutAttempt"')) return { rows: [{ id: "attempt-1" }] };
      return { rows: [] };
    }) };
    const event = { id: "cancel", stripeAccountId: "acct_1", type: "payment_intent.canceled", payload: { data: { object: { id: "pi_1" } } } };
    await processConnectPaymentEvent(sql, event); await processConnectPaymentEvent(sql, { ...event, id: "cancel-redelivery" });
    const releases = sql.query.mock.calls.filter(([statement]) => statement.includes('WITH released AS'));
    expect(releases).toHaveLength(1);
    expect(releases[0][0]).toContain(`AND "status" = 'HELD'`);
    expect(releases[0][0]).toContain('inventory.reserved - totals.quantity');
  });

