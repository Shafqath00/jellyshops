import { describe, expect, it } from "vitest";
import { ordersCsv } from "./orders-csv";
import type { OrderListResult } from "./api/types";

describe("ordersCsv", () => {
  it("uses readable statuses and escapes quotes", () => {
    const order = { id: "o1", number: "JS-1", createdAt: "2026-11-08T10:00:00.000Z", status: "PROCESSING", paymentStatus: "PAID", fulfilmentStatus: null, customerSnapshot: { name: 'Asha "AR" Rao', email: "asha@example.com" }, items: [{ titleSnapshot: "Tee", quantity: 2 }], totalMinor: 6400, currency: "GBP" } as unknown as OrderListResult["orders"][number];
    const [header, line] = ordersCsv([order]).split("\r\n");
    expect(header).toBe('"Order","Date","Customer","Email","Items","Payment","Fulfilment","Total","Currency"');
    expect(line).toBe('"JS-1","2026-11-08T10:00:00.000Z","Asha ""AR"" Rao","asha@example.com","Tee x 2","Paid","Being prepared","64.00","GBP"');
  });
});
