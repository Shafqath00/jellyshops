export interface CheckoutLineInput {
  variantId: string;
  quantity: number;
  configurationSelections?: Array<{ optionId: string; valueId: string; optionName?: string; valueLabel?: string; priceAdjustmentMinor?: number }>;
  /** Text the shopper typed for this line (engraving, gift message), checked against the product's personalisation fields. */
  personalisation?: Array<{ fieldId: string; value: string }>;
}

export interface BeginCheckoutInput {
  /** Server-verified identity only; public HTTP input never accepts this field. */
  customerId?: string;
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
