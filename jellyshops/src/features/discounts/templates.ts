import type { DiscountInput, DiscountType } from "@jelly/storefront-schema";

/** Ready-made starting points. Each fills the form; the merchant reviews and saves. Money is in minor units. */
export interface DiscountTemplate {
  id: string;
  title: string;
  description: string;
  type: DiscountType;
  input: DiscountInput;
}

export const DISCOUNT_TEMPLATES: DiscountTemplate[] = [
  {
    id: "first-order-10",
    title: "10% off a first order",
    description: "A welcome code for new customers, once each.",
    type: "order_amount",
    input: { method: "code", code: "WELCOME10", title: "10% off your first order", type: "order_amount", valueType: "percent", value: 10, eligibility: { scope: "first_order" }, oncePerCustomer: true },
  },
  {
    id: "free-shipping-50",
    title: "Free shipping over £50",
    description: "Applied by itself once the order reaches £50.",
    type: "free_shipping",
    input: { method: "automatic", title: "Free delivery over £50", type: "free_shipping", minimum: { type: "amount", amountMinor: 5000 }, combinesWith: { product: true, order: true, shipping: false } },
  },
  {
    id: "bogo",
    title: "Buy 1 get 1 free",
    description: "The cheaper item is free. Choose which products it covers.",
    type: "buy_x_get_y",
    input: {
      method: "code", code: "BOGO", title: "Buy 1 get 1 free", type: "buy_x_get_y",
      buyXGetY: { buys: { type: "quantity", quantity: 1 }, buysItems: { scope: "all", productIds: [], collectionIds: [] }, getsQuantity: 1, getsItems: { scope: "all", productIds: [], collectionIds: [] }, getsValue: { type: "free" }, maxUsesPerOrder: 1 },
    },
  },
  {
    id: "spend-save",
    title: "£5 off orders over £30",
    description: "A simple code for a newsletter or social post.",
    type: "order_amount",
    input: { method: "code", code: "SAVE5", title: "£5 off orders over £30", type: "order_amount", valueType: "fixed", value: 500, minimum: { type: "amount", amountMinor: 3000 } },
  },
];

export function findTemplate(id: string | null | undefined): DiscountTemplate | undefined {
  return DISCOUNT_TEMPLATES.find((template) => template.id === id);
}
