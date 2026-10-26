/**
 * Customer-facing view of an order's delivery: progress steps, shipments and
 * a timeline. Everything the shopper can see is built here from an explicit
 * allowlist, so a new internal event type or column is never exposed by
 * accident. Pure functions only: the repository supplies the rows.
 */

export interface PublicShipmentRow {
  id: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: unknown;
  createdAt: string | Date;
  deliveredAt: string | Date | null;
}

export interface PublicOrderEventRow {
  type: string;
  details: unknown;
  createdAt: string | Date;
}

export interface PublicShipment {
  id: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: Array<{ title: string; quantity: number }>;
  shippedAt: string;
  deliveredAt: string | null;
}

export interface PublicTimelineEntry {
  label: string;
  at: string;
}

export type ProgressState = "done" | "current" | "upcoming";

export interface PublicProgressStep {
  key: "PLACED" | "PROCESSING" | "SHIPPED" | "DELIVERED";
  label: string;
  state: ProgressState;
  at: string | null;
}

const toIso = (value: string | Date | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Order statuses a shopper is told about in the timeline, with the words shown for each. */
const TIMELINE_STATUS_LABELS: Record<string, string> = {
  PROCESSING: "Being prepared",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
};

/** Event types that become public timeline entries. Anything not listed here stays internal. */
const PUBLIC_EVENT_LABELS: Record<string, string> = {
  ORDER_CANCELLED: "Order cancelled",
};

function itemTitles(items: unknown, lines: Array<{ variantId?: unknown; titleSnapshot?: unknown }> = []): Array<{ title: string; quantity: number }> {
  if (!Array.isArray(items)) return [];
  return items.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { variantId, quantity } = entry as { variantId?: unknown; quantity?: unknown };
    const count = typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
    if (!count) return [];
    const line = lines.find((candidate) => candidate.variantId === variantId);
    const title = typeof line?.titleSnapshot === "string" && line.titleSnapshot.trim() ? line.titleSnapshot : "Item";
    return [{ title, quantity: count }];
  });
}

/** Shipments as the shopper sees them. Internal fields and staff detail are dropped. */
export function buildPublicShipments(
  fulfilments: readonly PublicShipmentRow[],
  lines: Array<{ variantId?: unknown; titleSnapshot?: unknown }>,
): PublicShipment[] {
  return fulfilments
    .map((row) => ({
      id: row.id,
      status: row.status,
      carrier: row.carrier || null,
      trackingNumber: row.trackingNumber || null,
      trackingUrl: row.trackingUrl && /^https?:\/\//.test(row.trackingUrl) ? row.trackingUrl : null,
      items: itemTitles(row.items, lines),
      shippedAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
      deliveredAt: toIso(row.deliveredAt),
    }))
    .sort((a, b) => a.shippedAt.localeCompare(b.shippedAt));
}

/** Timeline entries from allowlisted events, oldest first. The first entry is always "Order placed". */
export function buildPublicTimeline(
  orderCreatedAt: string | Date,
  events: readonly PublicOrderEventRow[],
): PublicTimelineEntry[] {
  const entries: PublicTimelineEntry[] = [{ label: "Order placed", at: toIso(orderCreatedAt) ?? new Date(0).toISOString() }];
  for (const event of events) {
    const at = toIso(event.createdAt);
    if (!at) continue;
    if (event.type === "STATUS_CHANGED") {
      const status = (event.details as { status?: unknown } | null)?.status;
      const label = typeof status === "string" ? TIMELINE_STATUS_LABELS[status] : undefined;
      if (label) entries.push({ label, at });
    } else if (PUBLIC_EVENT_LABELS[event.type]) {
      entries.push({ label: PUBLIC_EVENT_LABELS[event.type], at });
    }
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * The four delivery steps and how far the order has got. A step is "done" only
 * when its evidence exists: a status change, a shipment, or a delivery date.
 * Cancelled, refunded and unpaid orders have no progress to show.
 */
export function buildPublicProgress(input: {
  status: string;
  timeline: readonly PublicTimelineEntry[];
  shipments: readonly PublicShipment[];
}): PublicProgressStep[] {
  if (["PENDING_PAYMENT", "CANCELLED", "REFUNDED"].includes(input.status)) return [];
  const at = (label: string) => input.timeline.find((entry) => entry.label === label)?.at ?? null;
  const shippedAt = input.shipments.map((shipment) => shipment.shippedAt).sort()[0] ?? at("Shipped");
  const deliveredAt = input.shipments.map((shipment) => shipment.deliveredAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? at("Delivered");
  const reached = {
    PLACED: true,
    PROCESSING: ["PROCESSING", "SHIPPED", "DELIVERED"].includes(input.status) || at("Being prepared") !== null || input.shipments.length > 0,
    SHIPPED: ["SHIPPED", "DELIVERED"].includes(input.status) || input.shipments.length > 0,
    DELIVERED: input.status === "DELIVERED" || input.shipments.some((shipment) => shipment.deliveredAt !== null),
  };
  const steps: Array<Omit<PublicProgressStep, "state">> = [
    { key: "PLACED", label: "Placed", at: at("Order placed") },
    { key: "PROCESSING", label: "Being prepared", at: at("Being prepared") },
    { key: "SHIPPED", label: "Shipped", at: shippedAt },
    { key: "DELIVERED", label: "Delivered", at: deliveredAt },
  ];
  const reachedKeys = steps.filter((step) => reached[step.key]).map((step) => step.key);
  const current = reachedKeys.at(-1);
  return steps.map((step) => ({
    ...step,
    state: step.key === current ? "current" : reachedKeys.includes(step.key) ? "done" : "upcoming",
    at: step.at ?? null,
  }));
}
