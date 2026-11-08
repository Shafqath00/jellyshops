import { humanizeCode } from "@/components/admin/status";
import type { MerchantOrderDetail, OrderActivity } from "./api/types";

type Notification = NonNullable<MerchantOrderDetail["notifications"]>[number];

const EMAIL_NAMES: Record<string, string> = {
  PLACED: "Order confirmation",
  PAYMENT_CONFIRMED: "Payment confirmation",
  PROCESSING: "Order being prepared",
  SHIPPED: "Shipping confirmation",
  DELIVERED: "Delivery confirmation",
  CANCELLED: "Cancellation",
  REFUND_PROCESSED: "Refund confirmation",
  DIGITAL_READY: "Download ready",
};

/** "Order confirmation email" for PLACED. */
export const emailName = (type?: string | null) => `${type ? EMAIL_NAMES[type] ?? humanizeCode(type) : "Customer"} email`;

/** A notification that will not be retried on its own and needs the merchant. */
export const needsRetry = (notification: Notification) => notification.status === "FAILED" || notification.status === "UNCERTAIN";

const reasonFor = (notification?: Notification) => {
  const reason = notification?.lastError || notification?.error;
  return reason ? ` Reason: ${reason.replace(/\s+/g, " ").trim()}.` : "";
};

/**
 * Turns a timeline event into a sentence. Email events name the email and, when sending failed,
 * say why and whether Jelly will try again.
 */
export function describeActivity(event: OrderActivity, notifications: Notification[] = []): string {
  if (event.message) return event.message;
  const payload = event.payload ?? {};
  const notification = notifications.find((item) => item.id === payload.notificationId);
  const name = emailName(String(payload.type ?? notification?.type ?? ""));
  if (event.type === "NOTIFICATION_ACCEPTED") return `${name} sent to the customer.`;
  if (event.type === "NOTIFICATION_QUEUED") return `${name} queued to send.`;
  if (event.type === "NOTIFICATION_FAILED") {
    if (payload.uncertain === true) return `${name}: the email service did not confirm delivery, so it may not have arrived. Check with the customer or resend it.`;
    const attempts = typeof payload.attempts === "number" ? ` (attempt ${payload.attempts})` : "";
    const final = payload.status === "FAILED" || payload.status === "UNCERTAIN";
    return `${name} could not be sent${attempts}.${reasonFor(notification)} ${final ? "Jelly has stopped trying. Use Retry under Customer emails." : "Jelly will try again automatically."}`;
  }
  return humanizeCode(event.type);
}
