export interface CommerceAttemptInput {
  cartKey: string;
  currency: string;
  items: Array<{ variantId: string; quantity: number }>;
  customerSnapshot: Record<string, unknown>;
  deliverySnapshot?: Record<string, unknown>;
}

export interface CommerceAttemptResult { attemptId: string; orderId: string; publicToken: string }
export interface PreparedPayment { orderId: string; publicToken: string; clientSecret: string; connectedAccountId: string }
export interface PublicOrderResult { order: Record<string, unknown>; items: Record<string, unknown>[]; payment: Record<string, unknown> | null }

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
}

export interface MerchantOrderItem {
  variantId: string;
  titleSnapshot: string;
  skuSnapshot: string | null;
  imageSnapshot: string | null;
  unitPriceMinor: number;
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
  order: MerchantOrder;
  items: MerchantOrderItem[];
  payment: MerchantPayment | null;
  refunds: MerchantRefund[];
  disputes: MerchantPaymentDispute[];
}
