export interface CheckoutLineInput {
  variantId: string;
  quantity: number;
  configurationSelections?: Array<{ optionId: string; valueId: string; optionName?: string; valueLabel?: string; priceAdjustmentMinor?: number }>;
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

export interface PublicOrderView {
  order: Record<string, unknown>;
  items: Record<string, unknown>[];
  payment: Record<string, unknown> | null;
}
