import type { SqlExecutor } from "../../commerce/repository.js";

import { processDisputeEvent } from "./dispute-events.js";
import { expandableId, markProcessed, stringValue, stripeObject } from "./event-helpers.js";
import type { ConnectPaymentEvent, PaymentSettlementHooks } from "./event-types.js";
import { processPaymentIntentEvent } from "./payment-intent-events.js";
import { processRefundEvent } from "./refund-events.js";

export type { ConnectPaymentEvent, PaymentSettlementHooks } from "./event-types.js";

export async function processConnectPaymentEvent(
  sql: SqlExecutor,
  event: ConnectPaymentEvent,
  hooks?: PaymentSettlementHooks,
): Promise<void> {
  if (!event.stripeAccountId) {
    await markProcessed(sql, event.id);
    return;
  }

  const object =
    stripeObject(event.payload);

  if (event.type === "charge.refunded" && hooks?.settleChargeRefund) {
    const intent = expandableId(object.payment_intent);
    if (intent && await hooks.settleChargeRefund(intent, sql, event.stripeAccountId)) {
      await markProcessed(sql, event.id);
      return;
    }
  }

  const remoteId = stringValue(object.id);
  if (hooks && remoteId) {
    const paymentStatus = event.type === "payment_intent.succeeded" ? "succeeded" : event.type === "payment_intent.canceled" ? "canceled" : null;
    const handled = paymentStatus
      ? await hooks.settlePaymentIntent(remoteId, paymentStatus, sql, event.stripeAccountId, object)
      : event.type.startsWith("refund.")
        ? await hooks.settleRefund(remoteId, String(object.status ?? (event.type === "refund.failed" ? "failed" : "pending")), sql, event.stripeAccountId, object)
        : false;
    if (handled) { await markProcessed(sql, event.id); return; }
  }

  const handledPaymentIntent =
    await processPaymentIntentEvent(
      sql,
      event,
      object,
    );

  if (handledPaymentIntent) {
    await markProcessed(sql, event.id);
    return;
  }

  await processDisputeEvent(
    sql,
    event,
    object,
  );

  await processRefundEvent(
    sql,
    event,
    object,
  );
  await markProcessed(sql, event.id);
}
