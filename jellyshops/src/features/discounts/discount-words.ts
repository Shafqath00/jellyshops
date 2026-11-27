import { BadgePercent, Gift, ShoppingBag, Tag, Truck, Zap, type LucideIcon } from "lucide-react";
import { describeDiscountValue, summariseDiscount, type DiscountMethod, type DiscountStatus, type DiscountType, type SummaryNames } from "@jelly/storefront-schema";
import type { StatusTone } from "@/components/admin";
import type { MerchantDiscount } from "./api";

/** What each type is, in the words the type picker, list and form use. */
export const DISCOUNT_TYPE_INFO: Record<DiscountType, { label: string; icon: LucideIcon; explain: string; example: string }> = {
  product_amount: {
    label: "Amount off products", icon: Tag,
    explain: "Money off some or all of your products.",
    example: "20% off everything in Summer Collection",
  },
  order_amount: {
    label: "Amount off order", icon: ShoppingBag,
    explain: "Money off the whole order.",
    example: "£10 off orders over £50",
  },
  buy_x_get_y: {
    label: "Buy X get Y", icon: Gift,
    explain: "Buy some items, get others free or cheaper.",
    example: "Buy 2 candles, get 1 free",
  },
  free_shipping: {
    label: "Free shipping", icon: Truck,
    explain: "Delivery costs nothing.",
    example: "Free delivery on orders over £30",
  },
};

export const DISCOUNT_METHOD_INFO: Record<DiscountMethod, { label: string; icon: LucideIcon; explain: string }> = {
  code: { label: "Discount code", icon: BadgePercent, explain: "Customers type a code at checkout." },
  automatic: { label: "Automatic", icon: Zap, explain: "Applied by itself to everyone who qualifies." },
};

export const DISCOUNT_STATUS_INFO: Record<DiscountStatus, { label: string; tone: StatusTone; explain: string }> = {
  active: { label: "Active", tone: "success", explain: "Customers can use it now." },
  scheduled: { label: "Scheduled", tone: "info", explain: "It starts later." },
  expired: { label: "Expired", tone: "neutral", explain: "Its end date has passed." },
  // Shown as Expired, with "Used up" as a note: the four badges are Active, Scheduled, Expired and Disabled.
  used_up: { label: "Expired", tone: "neutral", explain: "It reached its usage limit." },
  disabled: { label: "Disabled", tone: "neutral", explain: "You disabled it. Enable it to use it again." },
};

/** "1 Dec – 31 Dec 2026", "From 1 Dec 2026", "Until 31 Dec 2026", "Always". End dates are exclusive (midnight), so the last day shown is the day before. */
export function discountDates(discount: Pick<MerchantDiscount, "startsAt" | "endsAt">, timeZone: string): string {
  const day = (iso: string, year = true) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone }).format(new Date(iso));
  const lastDay = discount.endsAt ? new Date(new Date(discount.endsAt).getTime() - 1).toISOString() : null;
  if (discount.startsAt && lastDay) {
    const sameYear = day(discount.startsAt).slice(-4) === day(lastDay).slice(-4);
    return `${day(discount.startsAt, !sameYear)} – ${day(lastDay)}`;
  }
  if (discount.startsAt) return `From ${day(discount.startsAt)}`;
  if (lastDay) return `Until ${day(lastDay)}`;
  return "No end date";
}

/** The whole discount in one sentence (see `summariseDiscount`). */
export function discountSentence(discount: MerchantDiscount, options: { timeZone: string; formatMoney: (minor: number) => string; names?: SummaryNames }): string {
  return summariseDiscount({
    ...discount,
    // An older backend build answers without these; fall back to "everything / no minimum" instead of crashing the list.
    appliesTo: discount.appliesTo ?? { scope: "all", productIds: [], collectionIds: [] },
    minimum: discount.minimum ?? { type: "none" },
    startsAt: discount.startsAt ? new Date(discount.startsAt) : null,
    endsAt: discount.endsAt ? new Date(discount.endsAt) : null,
  }, options);
}

/** One short line for the list: "20% off Summer Collection · over £50", "Buy 1 item, get 1 more free". */
export function shortDescription(discount: MerchantDiscount, options: { formatMoney: (minor: number) => string; names?: SummaryNames }): string {
  const value = describeDiscountValue({ ...discount, appliesTo: discount.appliesTo ?? { scope: "all", productIds: [], collectionIds: [] } }, options);
  const minimum = discount.minimum ?? { type: "none" };
  const extra = minimum.type === "amount" ? `over ${options.formatMoney(minimum.amountMinor)}`
    : minimum.type === "quantity" ? `${minimum.quantity}+ items` : "";
  const who = discount.eligibility?.scope === "first_order" ? "first orders" : discount.eligibility?.scope === "tags" ? "customer groups" : discount.eligibility?.scope === "customers" ? "chosen customers" : "";
  return [value.replace(/ the whole order$/, " the order"), extra, who].filter(Boolean).join(" · ");
}

export function usesText(discount: Pick<MerchantDiscount, "uses" | "usageLimit">): string {
  return discount.usageLimit ? `${discount.uses} of ${discount.usageLimit}` : String(discount.uses);
}

export const moneyFormatter = (currency: string) => (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
