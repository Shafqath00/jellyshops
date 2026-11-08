import { describe, expect, it, vi } from "vitest";
import { FulfilmentService } from "./fulfilment.js";

describe("fulfilment state machine", () => {
  it("advances only an authoritative paid order", async () => {
    const tx = { query: vi.fn(async (sql: string) => {
      if (sql.includes('"status" FROM "Order"')) return { rows: [{ status: "PAID" }] };
      if (sql.includes('FROM "Payment"')) return { rows: [{ status: "PAID" }] };
      return { rows: [{ status: "CONFIRMED" }] };
    }) };
    const repository = { transaction: vi.fn(async (work: any) => work(tx)) } as any;
    const result = await new FulfilmentService(repository).transition("store-1", "order-1", "CONFIRMED");
    expect(result.status).toBe("CONFIRMED");
  });

  it("rejects an unpaid order", async () => {
    const tx = { query: vi.fn(async (sql: string) => sql.includes('"status" FROM "Order"') ? { rows: [{ status: "PENDING_PAYMENT" }] } : { rows: [{ status: "PENDING" }] }) };
    const repository = { transaction: vi.fn(async (work: any) => work(tx)) } as any;
    await expect(new FulfilmentService(repository).transition("store-1", "order-1", "CONFIRMED")).rejects.toMatchObject({ code: "ORDER_TRANSITION_INVALID" });
  });
});
