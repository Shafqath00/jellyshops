import type { PublicOrderResult } from "@/features/commerce/api/types";
import type { ConfirmationState } from "./components/checkout-confirmation";

/**
 * What the confirmation page shows, worked out only from our server's copy of
 * the order. "Paid" needs the order itself to be paid (set by the Stripe
 * webhook); the redirect back from Stripe can only turn a still-unpaid order
 * into "failed" (Stripe said so) or leave it "pending".
 */
export function confirmationState(result: PublicOrderResult, redirectFailed: boolean): ConfirmationState {
  const status = String(result.order.status ?? "");
  if (status === "CANCELLED") return "cancelled";
  if (status === "REFUNDED") return "refunded";
  if (status === "PENDING_PAYMENT" || status === "PENDING") return redirectFailed || result.payment?.status === "FAILED" ? "failed" : "pending";
  return "paid";
}

export type PaymentTone = "success" | "pending" | "danger" | "neutral";

export function paymentStatus(state: ConfirmationState): { label: string; tone: PaymentTone } {
  switch (state) {
    case "paid": return { label: "Paid", tone: "success" };
    case "pending": return { label: "Confirming…", tone: "pending" };
    case "failed": return { label: "Not taken", tone: "danger" };
    case "refunded": return { label: "Refunded", tone: "neutral" };
    case "cancelled": return { label: "Cancelled", tone: "neutral" };
  }
}

const COUNTRY_NAMES: Record<string, string> = { GB: "United Kingdom", US: "United States", IN: "India", IE: "Ireland", CA: "Canada", AU: "Australia" };

/** The delivery address as display lines, or nothing for digital-only orders. */
export function deliveryLines(result: PublicOrderResult): string[] {
  const delivery = result.order.delivery;
  if (!delivery || typeof delivery !== "object") return [];
  const value = delivery as Record<string, unknown>;
  const text = (key: string) => (typeof value[key] === "string" ? (value[key] as string).trim() : "");
  const country = text("country");
  return [
    text("name"),
    text("line1"),
    text("line2"),
    [text("city"), text("region")].filter(Boolean).join(", "),
    text("postalCode"),
    COUNTRY_NAMES[country.toUpperCase()] ?? country,
  ].filter(Boolean);
}

function shortDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

/**
 * The "Delivery" line. There is no store delivery estimate yet, so this states
 * only what is known: digital, delivered, on its way, or tracking to follow.
 */
export function deliveryExpectation(result: PublicOrderResult, state: ConfirmationState): string {
  const physical = result.items.some((item) => item.fulfillmentType !== "DIGITAL");
  if (!physical) return state === "paid" ? "Download links are sent to your email" : "Download links are emailed once payment is confirmed";
  if (state === "pending") return "Prepared once your payment is confirmed";
  if (state === "failed" || state === "cancelled" || state === "refunded") return "Not being sent";
  const shipments = result.shipments ?? [];
  const delivered = shipments.map((shipment) => shipment.deliveredAt).filter(Boolean).sort().at(-1);
  if (result.order.status === "DELIVERED" || (shipments.length > 0 && shipments.every((shipment) => shipment.deliveredAt))) return `Delivered${shortDate(delivered) ? ` ${shortDate(delivered)}` : ""}`;
  const shipped = shipments.map((shipment) => shipment.shippedAt).filter(Boolean).sort().at(-1);
  if (shipments.length > 0) return `On its way${shortDate(shipped) ? `, sent ${shortDate(shipped)}` : ""}`;
  return "We’ll email tracking details when it’s sent";
}
