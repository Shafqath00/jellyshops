import { describe, expect, it } from "vitest";
import type { PublicOrderResult } from "@/features/commerce/api/types";
import { confirmationState, deliveryExpectation, deliveryLines, paymentStatus } from "./order-confirmation-model";

const result = (order: Record<string, unknown>, extra: Partial<PublicOrderResult> = {}): PublicOrderResult => ({ order, items: [{ fulfillmentType: "PHYSICAL" }], payment: null, ...extra });

describe("order confirmation rules", () => {
  it("shows paid only when the server has the order as paid", () => {
    expect(confirmationState(result({ status: "PENDING_PAYMENT" }), false)).toBe("pending");
    expect(confirmationState(result({ status: "PAID" }), false)).toBe("paid");
    expect(confirmationState(result({ status: "SHIPPED" }), false)).toBe("paid");
    expect(confirmationState(result({ status: "PENDING_PAYMENT" }), true)).toBe("failed");
    expect(confirmationState(result({ status: "PENDING_PAYMENT" }, { payment: { status: "FAILED" } }), false)).toBe("failed");
    expect(confirmationState(result({ status: "CANCELLED" }), false)).toBe("cancelled");
    expect(paymentStatus("pending")).toEqual({ label: "Confirming…", tone: "pending" });
  });

  it("writes the address as lines and says honestly what happens to the parcel", () => {
    expect(deliveryLines(result({ delivery: { name: "Ada", line1: "1 High St", city: "Leeds", region: "", postalCode: "LS1", country: "GB" } }))).toEqual(["Ada", "1 High St", "Leeds", "LS1", "United Kingdom"]);
    expect(deliveryLines(result({}))).toEqual([]);
    expect(deliveryExpectation(result({ status: "PENDING_PAYMENT" }), "pending")).toBe("Prepared once your payment is confirmed");
    expect(deliveryExpectation(result({ status: "PAID" }, { shipments: [{ id: "s", status: "SHIPPED", carrier: null, trackingNumber: null, trackingUrl: null, items: [], shippedAt: "2026-11-18T10:00:00Z", deliveredAt: null, exception: null }] }), "paid")).toBe("On its way, sent 18 Nov");
    expect(deliveryExpectation({ order: { status: "PAID" }, items: [{ fulfillmentType: "DIGITAL" }], payment: null }, "paid")).toBe("Download links are sent to your email");
  });
});
