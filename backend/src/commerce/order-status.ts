/**
 * The one list of order status changes the platform allows.
 *
 * Checkout creates orders as PENDING_PAYMENT. Only the Stripe webhook
 * (payment_intent.succeeded) moves them to PAID; an unpaid order can only be
 * paid or cancelled, so it can never jump straight to shipped. The database
 * enforces the same list with the trigger in
 * `sql/migrations/20261118010000_order_email_after_payment.sql`
 * (`order-status.test.ts` keeps the two in step).
 */
export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PENDING",
  "PAID",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  // Older orders were created as PENDING; they follow the same rule.
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["CONFIRMED", "PROCESSING", "SHIPPED", "CANCELLED", "REFUNDED"],
  CONFIRMED: ["PROCESSING", "SHIPPED", "CANCELLED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/** True when an order may move from `from` to `to`. Staying on the same status is always allowed. */
export function canTransitionOrder(from: string, to: string): boolean {
  if (from === to) return true;
  if (!isOrderStatus(from) || !isOrderStatus(to)) return false;
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}
