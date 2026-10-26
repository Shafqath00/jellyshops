export interface CommerceAttemptInput {
  cartKey: string;
  currency: string;
  items: Array<{ variantId: string; quantity: number; configurationSelections?: Array<{ optionId: string; valueId: string; optionName?: string; valueLabel?: string; priceAdjustmentMinor?: number }> }>;
  customerSnapshot: Record<string, unknown>;
  deliverySnapshot?: Record<string, unknown>;
}

export interface CommerceAttemptResult { attemptId: string; orderId: string; publicToken: string }
export interface PreparedPayment { orderId: string; publicToken: string; clientSecret: string; connectedAccountId: string }
export interface PublicShipment {
  id: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: Array<{ title: string; quantity: number }>;
  shippedAt: string;
  deliveredAt: string | null;
  /** A problem still open on this parcel, shown to the shopper with a next step. */
  exception: "DELAYED" | "DELIVERY_FAILED" | null;
}

export interface PublicTimelineEntry { label: string; at: string }

export interface PublicProgressStep {
  key: "PLACED" | "PROCESSING" | "SHIPPED" | "DELIVERED";
  label: string;
  state: "done" | "current" | "upcoming";
  at: string | null;
}

export interface PublicOrderResult {
  order: Record<string, unknown>;
  items: Record<string, unknown>[];
  payment: Record<string, unknown> | null;
  shipments?: PublicShipment[];
  timeline?: PublicTimelineEntry[];
  progress?: PublicProgressStep[];
}

export interface StripeMerchantStatus {
  connected: boolean;
  checkoutReady: boolean;
  cardPaymentsStatus?: string;
  payoutsStatus?: string;
  requirements?: Record<string, unknown>;
  closed: boolean;
  /** Full Dashboard URL is supplied by the server; the browser never derives Stripe account links. */
  dashboardUrl?: string;
}

export interface StripeOnboardingLink {
  url: string;
}

export type MerchantOrderStatus = "PENDING_PAYMENT" | "PAID" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
export type MerchantPaymentStatus = "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
export type RefundStatus = "PENDING" | "REQUIRES_ACTION" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface MerchantOrder {
  revision?: number;
  taxMinor?: number | null;
  discountMinor?: number | null;
  balanceDueMinor?: number;
  deliverySnapshot?: Record<string, unknown>;
  billingAddress?: Record<string, unknown> | null;
  customerNote?: string | null;
  isTest?: boolean;
  paymentStatus?: string | null;
  fulfilmentStatus?: string;
  id: string;
  number: string;
  storeId: string;
  status: MerchantOrderStatus;
  customerSnapshot: Record<string, unknown>;
  totalMinor: number;
  currency: string;
  createdAt: string;
  subtotalMinor: number;
  shippingMinor: number;
  fulfilmentStartedAt: string | null;
}

export interface MerchantOrderListItem extends MerchantOrder {
  paymentStatus: MerchantPaymentStatus | null;
  items?: MerchantOrderItem[];
  itemCount?: number;
}

export interface MerchantOrderItem {
  id?: string;
  configurationKey?: string;
  productTitleSnapshot?: string;
  variantTitleSnapshot?: string;
  fulfilmentType?: "PHYSICAL" | "DIGITAL";
  fulfillmentType?: "PHYSICAL" | "DIGITAL";
  fulfilledQuantity?: number;
  discountMinor?: number | null;
  variantId: string;
  titleSnapshot: string;
  skuSnapshot: string | null;
  imageSnapshot: string | null;
  unitPriceMinor: number;
  configurationSnapshot?: Array<{ optionId: string; valueId: string; optionName: string; valueLabel: string; priceAdjustmentMinor: number }>;
  quantity: number;
}

export interface MerchantPayment {
  id: string;
  status: MerchantPaymentStatus;
  amountMinor: number;
  currency: string;
  paymentIntentId: string | null;
  chargeId: string | null;
}

export interface MerchantRefund {
  id: string;
  status: RefundStatus;
  amountMinor: number;
  stripeRefundId: string | null;
}

export interface MerchantPaymentDispute {
  stripeDisputeId: string;
  status: string;
}

export interface MerchantOrderDetail {
  timeZone?: string;
  order: MerchantOrder;
  items: MerchantOrderItem[];
  payment: MerchantPayment | null;
  refunds: MerchantRefund[];
  disputes: MerchantPaymentDispute[];
  events?: OrderActivity[];
  notes?: OrderNote[];
  fulfilments?: OrderFulfilment[];
  returns?: OrderReturn[];
  revisions?: Array<{ id: string; status: string; revision?: number; number?: number; amountMinor?: number; deltaMinor?: number; settlementMinor?: number; balancePaymentUrl?: string }>;
  notifications?: Array<{ id: string; type: string; status: string; createdAt?: string; error?: string; lastError?: string }>;
  transactions?: Array<{ id: string; kind: string; status: string; amountMinor: number; paymentIntentId?: string }>;
  operations?: Array<{ id: string; kind: string; status: string; attempts: number; lastError?: string }>;
  capabilities?: Record<string, boolean>;
}

export interface OrderActivity { id: string; type: string; createdAt: string; message?: string; payload?: Record<string, unknown> }
export interface OrderNote { id: string; body: string; createdAt: string; authorName?: string }
export interface OrderFulfilment { id: string; status: string; trackingNumber?: string | null; trackingUrl?: string | null; carrier?: string | null; items?: Array<{ orderItemId?: string; variantId?: string; quantity: number }> }
export interface OrderReturn { id: string; status: string; reason?: string; items?: Array<{ orderItemId?: string; variantId?: string; quantity: number }> }
export interface OrderListQuery { query?: string; status?: string; paymentStatus?: string; sort?: string; direction?: string; page?: number; pageSize?: number }
export interface OrderListResult { orders: MerchantOrderListItem[]; total: number; page: number; pageSize: number; summary: Record<string, number>; featureEnabled?: boolean; timeZone?: string }
export interface OrderEditInput { revision: number; items: Array<{ variantId: string; configurationKey?: string; quantity: number }>; shippingMinor?: number }
export interface OrderEditPreview { beforeTotalMinor?: number; afterTotalMinor?: number; totalMinor?: number; deltaMinor?: number; settlementMinor?: number; differenceMinor?: number; balancePaymentUrl?: string; message?: string; [key: string]: unknown }
