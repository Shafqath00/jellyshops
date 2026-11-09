/**
 * One place that turns internal status codes into words a merchant reads.
 * The API keeps its enum codes; the admin never shows them.
 */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "critical" | "attention";
export type StatusKind = "order" | "payment" | "fulfilment" | "product" | "stock" | "content" | "message" | "stripe";

type Entry = { label: string; tone: StatusTone };

const MAPS: Record<StatusKind, Record<string, Entry>> = {
  order: {
    PENDING_PAYMENT: { label: "Waiting for payment", tone: "warning" },
    PAID: { label: "Paid, not confirmed", tone: "attention" },
    CONFIRMED: { label: "Confirmed", tone: "info" },
    PROCESSING: { label: "Being prepared", tone: "info" },
    SHIPPED: { label: "Shipped", tone: "info" },
    DELIVERED: { label: "Delivered", tone: "success" },
    CANCELLED: { label: "Cancelled", tone: "critical" },
    REFUNDED: { label: "Refunded", tone: "neutral" },
  },
  payment: {
    PENDING: { label: "Payment pending", tone: "warning" },
    PROCESSING: { label: "Payment processing", tone: "warning" },
    PAID: { label: "Paid", tone: "success" },
    SUCCEEDED: { label: "Paid", tone: "success" },
    FAILED: { label: "Payment failed", tone: "critical" },
    REFUNDED: { label: "Refunded", tone: "neutral" },
    PARTIALLY_REFUNDED: { label: "Partly refunded", tone: "neutral" },
    CANCELLED: { label: "Cancelled", tone: "critical" },
  },
  fulfilment: {
    UNFULFILLED: { label: "Unfulfilled", tone: "attention" },
    PARTIALLY_FULFILLED: { label: "Partly fulfilled", tone: "warning" },
    FULFILLED: { label: "Fulfilled", tone: "success" },
    PACKED: { label: "Packed", tone: "info" },
    OUT_FOR_DELIVERY: { label: "Out for delivery", tone: "info" },
    SHIPPED: { label: "Shipped", tone: "info" },
    DELIVERED: { label: "Delivered", tone: "success" },
    DELAYED: { label: "Delayed", tone: "warning" },
    FAILED_DELIVERY: { label: "Delivery failed", tone: "critical" },
    DELIVERY_FAILED: { label: "Delivery failed", tone: "critical" },
    RETURNED: { label: "Returned", tone: "neutral" },
    CANCELLED: { label: "Cancelled", tone: "critical" },
    PENDING_PAYMENT: { label: "Waiting for payment", tone: "warning" },
    PAID: { label: "Unfulfilled", tone: "attention" },
    CONFIRMED: { label: "Unfulfilled", tone: "attention" },
    PROCESSING: { label: "Being prepared", tone: "info" },
    REFUNDED: { label: "Refunded", tone: "neutral" },
  },
  product: {
    ACTIVE: { label: "Active", tone: "success" },
    DRAFT: { label: "Draft", tone: "neutral" },
    ARCHIVED: { label: "Archived", tone: "neutral" },
  },
  stock: {
    IN_STOCK: { label: "In stock", tone: "success" },
    LOW_STOCK: { label: "Low stock", tone: "warning" },
    OUT_OF_STOCK: { label: "Out of stock", tone: "critical" },
    NOT_TRACKED: { label: "Not tracked", tone: "neutral" },
  },
  content: {
    PUBLISHED: { label: "Published", tone: "success" },
    DRAFT: { label: "Draft", tone: "neutral" },
    ARCHIVED: { label: "Archived", tone: "neutral" },
    SCHEDULED: { label: "Scheduled", tone: "info" },
  },
  message: {
    NEW: { label: "New", tone: "info" },
    READ: { label: "Read", tone: "neutral" },
    CLOSED: { label: "Closed", tone: "success" },
  },
  stripe: {
    ACTIVE: { label: "Active", tone: "success" },
    PENDING: { label: "Pending", tone: "warning" },
    INACTIVE: { label: "Not active", tone: "warning" },
    RESTRICTED: { label: "Restricted", tone: "critical" },
  },
};

/** Sentence case fallback for a code we have not mapped yet: "ON_HOLD" -> "On hold". */
export function humanizeCode(value: string): string {
  const words = value.replaceAll(/[_-]+/g, " ").trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
}

export function statusInfo(kind: StatusKind, value?: string | null): Entry {
  if (!value) return { label: "None", tone: "neutral" };
  return MAPS[kind][value.toUpperCase()] ?? { label: humanizeCode(value), tone: "neutral" };
}

export const statusLabel = (kind: StatusKind, value?: string | null) => statusInfo(kind, value).label;

/** Options for a filter select: value stays the API code, the text is the label. */
export function statusOptions(kind: StatusKind, values: readonly string[]) {
  return values.map((value) => ({ value, label: statusLabel(kind, value) }));
}
