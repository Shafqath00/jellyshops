import type { SqlExecutor } from "../../commerce/repository.js";

type EventPayload = Record<string, any>;

function objectOf(value: unknown): EventPayload { return value && typeof value === "object" ? value as EventPayload : {}; }
function stripeObject(payload: EventPayload): EventPayload { return objectOf(payload.data?.object); }

export async function processConnectPaymentEvent(sql: SqlExecutor, event: { id: string; type: string; stripeAccountId: string | null; payload: EventPayload }): Promise<void> {
  const accountId = event.stripeAccountId;
  if (!accountId) return;
  const object = stripeObject(event.payload);
  const paymentIntentId = typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id;
  const intentId = typeof object.id === "string" && object.id.startsWith("pi_") ? object.id : paymentIntentId;
  await sql.query(`UPDATE "StripeWebhookEvent" SET "processedAt" = CURRENT_TIMESTAMP WHERE "id" = $1 AND "processedAt" IS NULL`, [event.id]);

  if (["payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled"].includes(event.type) && intentId) {
    const payments = await sql.query<any>(`SELECT * FROM "Payment" WHERE "stripeAccountId" = $1 AND "paymentIntentId" = $2 FOR UPDATE`, [accountId, intentId]);
    const payment = payments.rows[0];
    if (!payment) return;
    if (event.type === "payment_intent.succeeded") {
      await sql.query(`UPDATE "Payment" SET "status" = 'PAID' WHERE "id" = $1 AND "status" IN ('PENDING','PROCESSING')`, [payment.id]);
      await sql.query(`UPDATE "Order" SET "status" = 'PAID', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1 AND "storeId" = $2 AND "status" = 'PENDING_PAYMENT'`, [payment.orderId, payment.storeId]);
      const attempt = await sql.query<any>(`SELECT "id" FROM "CheckoutAttempt" WHERE "orderId" = $1 AND "storeId" = $2`, [payment.orderId, payment.storeId]);
      if (attempt.rows[0]) {
        await sql.query(`UPDATE "CheckoutAttempt" SET "status" = 'SUCCEEDED' WHERE "id" = $1 AND "status" IN ('PAYMENT_INTENT_CREATING','READY','PROCESSING')`, [attempt.rows[0].id]);
        await sql.query(`UPDATE "InventoryReservation" SET "status" = 'SOLD' WHERE "attemptId" = $1 AND "status" = 'HELD'`, [attempt.rows[0].id]);
      }
    } else if (event.type === "payment_intent.canceled") {
      const cancelled = await sql.query(`UPDATE "Order" SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1 AND "storeId" = $2 AND "status" = 'PENDING_PAYMENT' RETURNING "id"`, [payment.orderId, payment.storeId]);
      await sql.query(`UPDATE "Payment" SET "status" = 'CANCELLED' WHERE "id" = $1 AND "status" = 'PENDING'`, [payment.id]);
      const attempt = await sql.query<any>(`SELECT "id" FROM "CheckoutAttempt" WHERE "orderId" = $1 AND "storeId" = $2`, [payment.orderId, payment.storeId]);
      if (cancelled.rows.length && attempt.rows[0]) {
        await sql.query(`UPDATE "CheckoutAttempt" SET "status" = 'CANCELLED' WHERE "id" = $1 AND "status" <> 'SUCCEEDED'`, [attempt.rows[0].id]);
        await sql.query(`UPDATE "InventoryReservation" SET "status" = 'RELEASED' WHERE "attemptId" = $1 AND "status" = 'HELD'`, [attempt.rows[0].id]);
      }
    } else {
      await sql.query(`UPDATE "Payment" SET "status" = 'FAILED' WHERE "id" = $1 AND "status" = 'PENDING'`, [payment.id]);
    }
    return;
  }

  if (event.type.startsWith("charge.dispute.") && object.id) {
    const chargeId = typeof object.charge === "string" ? object.charge : object.charge?.id;
    const payment = (await sql.query<any>(`SELECT "id", "storeId" FROM "Payment" WHERE "stripeAccountId" = $1 AND "chargeId" = $2`, [accountId, chargeId])).rows[0];
    if (payment) await sql.query(`INSERT INTO "PaymentDispute" ("storeId", "paymentId", "stripeDisputeId", "status") VALUES ($1,$2,$3,$4) ON CONFLICT ("stripeDisputeId") DO UPDATE SET "status" = EXCLUDED."status"`, [payment.storeId, payment.id, object.id, object.status ?? "under_review"]);
  }

  if (event.type.startsWith("refund.") || event.type === "charge.refunded") {
    const refundId = event.type === "charge.refunded" ? null : object.id;
    const pi = typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id;
    const charge = typeof object.id === "string" && object.id.startsWith("ch_") ? object.id : null;
    const payment = (await sql.query<any>(`SELECT * FROM "Payment" WHERE "stripeAccountId" = $1 AND ("paymentIntentId" = $2 OR "chargeId" = $3)`, [accountId, pi, charge])).rows[0];
    if (payment && refundId) await sql.query(`INSERT INTO "Refund" ("id", "storeId", "orderId", "paymentId", "stripeRefundId", "amountMinor", "status") VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT ("stripeRefundId") DO UPDATE SET "status" = EXCLUDED."status"`, [`refund-${refundId}`, payment.storeId, payment.orderId, payment.id, refundId, object.amount ?? payment.amountMinor, event.type === "refund.succeeded" ? "SUCCEEDED" : event.type === "refund.failed" ? "FAILED" : "PENDING"]);
    if (event.type === "charge.refunded" && payment) {
      await sql.query(`UPDATE "Payment" SET "status" = 'REFUNDED' WHERE "id" = $1`, [payment.id]);
      await sql.query(`UPDATE "Order" SET "status" = 'REFUNDED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1 AND "status" IN ('PAID','PROCESSING','SHIPPED','DELIVERED')`, [payment.orderId]);
    }
  }
}
