import { describe, expect, it, vi } from "vitest";
import { processConnectPaymentEvent } from "./processor.js";

describe("connect payment processor", () => {
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
