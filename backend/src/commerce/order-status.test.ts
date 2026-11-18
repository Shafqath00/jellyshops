import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { canTransitionOrder, ORDER_STATUSES, ORDER_STATUS_TRANSITIONS } from "./order-status.js";

describe("order status rules", () => {
  it("never lets an unpaid order skip payment", () => {
    expect(canTransitionOrder("PENDING_PAYMENT", "PAID")).toBe(true);
    expect(canTransitionOrder("PENDING_PAYMENT", "CANCELLED")).toBe(true);
    for (const next of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "REFUNDED"]) expect(canTransitionOrder("PENDING_PAYMENT", next)).toBe(false);
  });

  it("treats cancelled and refunded orders as final, and repeats as harmless", () => {
    for (const next of ORDER_STATUSES) {
      if (next !== "CANCELLED") expect(canTransitionOrder("CANCELLED", next)).toBe(false);
      if (next !== "REFUNDED") expect(canTransitionOrder("REFUNDED", next)).toBe(false);
    }
    expect(canTransitionOrder("SHIPPED", "SHIPPED")).toBe(true);
    expect(canTransitionOrder("SHIPPED", "nonsense")).toBe(false);
  });

  it("matches the database guard", async () => {
    const sql = await readFile(new URL("../../sql/migrations/20261118010000_order_email_after_payment.sql", import.meta.url), "utf8");
    const fromSql: Record<string, string[]> = {};
    for (const match of sql.matchAll(/WHEN '([A-Z_]+)' THEN ARRAY\[([^\]]*)\]/g)) fromSql[match[1]!] = [...match[2]!.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]!);
    const fromCode = Object.fromEntries(Object.entries(ORDER_STATUS_TRANSITIONS).filter(([, next]) => next.length > 0).map(([from, next]) => [from, [...next]]));
    expect(fromSql).toEqual(fromCode);
  });
});
