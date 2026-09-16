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
