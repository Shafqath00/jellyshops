import type { SqlExecutor } from "../../commerce/repository.js";

export type EventPayload =
  Record<string, unknown>;

export interface ConnectPaymentEvent {
  id: string;
  type: string;
  stripeAccountId: string | null;
  payload: EventPayload;
}

export interface PaymentSettlementHooks {
  settlePaymentIntent(id: string, status: string, sql: SqlExecutor, stripeAccountId: string, object?: EventPayload): Promise<boolean>;
  settleRefund(id: string, status: string, sql: SqlExecutor, stripeAccountId: string, object?: EventPayload): Promise<boolean>;
  settleChargeRefund?(paymentIntentId: string, sql: SqlExecutor, stripeAccountId: string): Promise<boolean>;
}
