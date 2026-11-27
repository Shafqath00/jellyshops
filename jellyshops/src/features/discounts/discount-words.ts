import { BadgePercent, Gift, ShoppingBag, Tag, Truck, Zap, type LucideIcon } from "lucide-react";
import { summariseDiscount, type DiscountMethod, type DiscountStatus, type DiscountType, type SummaryNames } from "@jelly/storefront-schema";
import type { StatusTone } from "@/components/admin";
import type { MerchantDiscount } from "./api";

/** What each type is, in the words the type picker, list and form use. */
export const DISCOUNT_TYPE_INFO: Record<DiscountType, { label: string; icon: LucideIcon; explain: string; example: string }> = {
  product_amount: {
    label: "Amount off products", icon: Tag,
    explain: "Take money off chosen products or collections. Everything else in the bag stays full price.",
    example: "20% off everything in Summer Collection",
  },
  order_amount: {
    label: "Amount off order", icon: ShoppingBag,
    explain: "Take money off the whole order, often once the customer spends a certain amount.",
    example: "£10 off orders over £50",
  },
  buy_x_get_y: {
    label: "Buy X get Y", icon: Gift,
    explain: "When the customer buys certain items, they get other items free or cheaper.",
    example: "Buy 2 candles, get 1 free",
  },
  free_shipping: {
    label: "Free shipping", icon: Truck,
    explain: "Delivery costs nothing, for everyone or once the order reaches an amount.",
    example: "Free delivery on orders over £30",
  },
};

export const DISCOUNT_METHOD_INFO: Record<DiscountMethod, { label: string; icon: LucideIcon; explain: string }> = {
  code: { label: "Discount code", icon: BadgePercent, explain: "Customers type a code at checkout. Good for emails, social posts and loyal customers." },
  automatic: { label: "Automatic", icon: Zap, explain: "Applied by itself in the bag and at checkout to everyone who qualifies. No code needed." },
};

export const DISCOUNT_STATUS_INFO: Record<DiscountStatus, { label: string; tone: StatusTone; explain: string }> = {
  active: { label: "Active", tone: "success", explain: "Customers can use it now." },
  scheduled: { label: "Scheduled", tone: "info", explain: "It starts later." },
  expired: { label: "Expired", tone: "neutral", explain: "Its end date has passed." },
  used_up: { label: "Used up", tone: "warning", explain: "It reached its usage limit." },
  disabled: { label: "Switched off", tone: "neutral", explain: "You switched it off. Switch it on to use it again." },
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

export function usesText(discount: Pick<MerchantDiscount, "uses" | "usageLimit">): string {
  return discount.usageLimit ? `${discount.uses} of ${discount.usageLimit}` : String(discount.uses);
}

export const moneyFormatter = (currency: string) => (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
