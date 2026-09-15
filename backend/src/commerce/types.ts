export interface CheckoutLineInput {
  variantId: string;
  quantity: number;
}

export interface BeginCheckoutInput {
  storeId: string;
  cartKey: string;
  currency: string;
  items: CheckoutLineInput[];
  customerSnapshot: Record<string, unknown>;
  deliverySnapshot?: Record<string, unknown>;
}

export interface CheckoutAttemptResult {
  attemptId: string;
  orderId: string;
  publicToken: string;
}
