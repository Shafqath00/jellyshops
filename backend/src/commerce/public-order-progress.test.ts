import { describe, expect, it } from "vitest";
import {
  buildPublicProgress,
  buildPublicShipments,
  buildPublicTimeline,
  type PublicShipmentRow,
} from "./public-order-progress.js";

const placed = "2026-10-20T10:00:00.000Z";
const lines = [{ variantId: "v1", titleSnapshot: "Belted wool coat" }, { variantId: "v2", titleSnapshot: "Crewneck" }];

function shipment(overrides: Partial<PublicShipmentRow> = {}): PublicShipmentRow {
  return {
    id: "shipment-1",
    status: "SHIPPED",
    carrier: "Royal Mail",
    trackingNumber: "RM123",
    trackingUrl: "https://track.example.com/RM123",
    items: [{ variantId: "v1", quantity: 1 }],
    createdAt: "2026-10-21T09:00:00.000Z",
    deliveredAt: null,
    ...overrides,
  };
}

describe("public shipments", () => {
  it("shows carrier, tracking, link and item titles, and drops any other fields", () => {
    const [result] = buildPublicShipments([{ ...shipment(), ...({ storeId: "store-a", notes: "staff only" } as object) } as PublicShipmentRow], lines);
    expect(result).toEqual({
      id: "shipment-1",
      status: "SHIPPED",
      carrier: "Royal Mail",
      trackingNumber: "RM123",
      trackingUrl: "https://track.example.com/RM123",
      items: [{ title: "Belted wool coat", quantity: 1 }],
      shippedAt: "2026-10-21T09:00:00.000Z",
      deliveredAt: null,
      exception: null,
    });
    expect(JSON.stringify(result)).not.toContain("staff only");
  });

  it("never returns a link that is not http or https", () => {
    const [result] = buildPublicShipments([shipment({ trackingUrl: "javascript:alert(1)" })], lines);
    expect(result.trackingUrl).toBeNull();
  });

  it("keeps a shipment with unknown items and skips zero or invalid quantities", () => {
    const [result] = buildPublicShipments([shipment({ items: [{ variantId: "gone", quantity: 2 }, { variantId: "v2", quantity: 0 }] })], lines);
    expect(result.items).toEqual([{ title: "Item", quantity: 2 }]);
  });

  it("orders shipments by when they were sent", () => {
    const results = buildPublicShipments([
      shipment({ id: "late", createdAt: "2026-10-23T09:00:00.000Z" }),
      shipment({ id: "early", createdAt: "2026-10-21T09:00:00.000Z" }),
    ], lines);
    expect(results.map((item) => item.id)).toEqual(["early", "late"]);
  });
});

describe("public timeline", () => {
  it("starts with the order placed and includes only allowlisted events", () => {
    const timeline = buildPublicTimeline(placed, [
      { type: "STATUS_CHANGED", details: { previousStatus: "PAID", status: "PROCESSING" }, createdAt: "2026-10-20T12:00:00.000Z" },
      { type: "NOTE_ADDED", details: { body: "Customer prefers morning delivery" }, createdAt: "2026-10-20T13:00:00.000Z" },
      { type: "TRACKING_UPDATED", details: { trackingNumber: "RM123" }, createdAt: "2026-10-21T09:00:00.000Z" },
      { type: "STATUS_CHANGED", details: { status: "NOT_A_STATUS" }, createdAt: "2026-10-21T10:00:00.000Z" },
    ]);
    expect(timeline).toEqual([
      { label: "Order placed", at: placed },
      { label: "Being prepared", at: "2026-10-20T12:00:00.000Z" },
    ]);
    expect(JSON.stringify(timeline)).not.toContain("morning delivery");
    expect(JSON.stringify(timeline)).not.toContain("RM123");
  });

  it("includes cancellation and sorts entries by time", () => {
    const timeline = buildPublicTimeline(placed, [
      { type: "ORDER_CANCELLED", details: {}, createdAt: "2026-10-22T08:00:00.000Z" },
      { type: "STATUS_CHANGED", details: { status: "SHIPPED" }, createdAt: "2026-10-21T08:00:00.000Z" },
    ]);
    expect(timeline.map((entry) => entry.label)).toEqual(["Order placed", "Shipped", "Order cancelled"]);
  });
});

describe("public progress", () => {
  const timelineFor = (status: string) => buildPublicTimeline(placed, status === "PROCESSING" ? [{ type: "STATUS_CHANGED", details: { status }, createdAt: "2026-10-20T12:00:00.000Z" }] : []);

  it("marks only the steps that have evidence, and the last reached one as current", () => {
    const shipments = buildPublicShipments([shipment()], lines);
    const progress = buildPublicProgress({ status: "SHIPPED", timeline: timelineFor("SHIPPED"), shipments });
    expect(progress.map((step) => [step.key, step.state])).toEqual([
      ["PLACED", "done"],
      ["PROCESSING", "done"],
      ["SHIPPED", "current"],
      ["DELIVERED", "upcoming"],
    ]);
    expect(progress[2].at).toBe("2026-10-21T09:00:00.000Z");
  });

  it("marks delivered when a shipment has a delivery date", () => {
    const shipments = buildPublicShipments([shipment({ deliveredAt: "2026-10-23T15:00:00.000Z" })], lines);
    const progress = buildPublicProgress({ status: "DELIVERED", timeline: timelineFor("DELIVERED"), shipments });
    expect(progress.at(-1)).toMatchObject({ key: "DELIVERED", state: "current", at: "2026-10-23T15:00:00.000Z" });
  });

  it("shows only placed for a paid order that has not moved on", () => {
    const progress = buildPublicProgress({ status: "CONFIRMED", timeline: buildPublicTimeline(placed, []), shipments: [] });
    expect(progress.map((step) => step.state)).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
  });

  it("has no progress for unpaid, cancelled or refunded orders", () => {
    for (const status of ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"]) {
      expect(buildPublicProgress({ status, timeline: buildPublicTimeline(placed, []), shipments: [] })).toEqual([]);
    }
  });
});
