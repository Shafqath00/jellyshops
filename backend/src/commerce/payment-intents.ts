import Stripe from "stripe";
import { ApiError } from "../http/errors.js";
import type { StripeGateway } from "../stripe/client.js";
import type { CheckoutAttemptRow, CommerceRepository, CommerceTransaction, OrderRow, PaymentRow } from "./repository.js";

export type PaymentIntentGateway = Pick<StripeGateway, "createDirectPaymentIntent" | "retrievePaymentIntent">;

export interface PreparedPayment {
  orderId: string;
  publicToken: string;
  clientSecret: string;
  connectedAccountId: string;
}

interface PaymentIntentDeps {
  repository: CommerceRepository;
  stripeGateway: PaymentIntentGateway;
}

function retryError() {
  // Do not include Stripe messages, credentials, or response bodies in public errors.
  return new ApiError(503, "PAYMENT_PREPARATION_RETRY", "Payment preparation is incomplete. Retry this checkout attempt.");
}

function unavailable() {
  return new ApiError(409, "CHECKOUT_ATTEMPT_UNAVAILABLE", "This checkout attempt is no longer available.");
}

function isDefinitiveCreationError(error: unknown): boolean {
  // Network failures, 5xx, rate limits and idempotency conflicts are indeterminate.
  // An embedded intent also means there may already be an external payment object.
  return error instanceof Stripe.errors.StripeInvalidRequestError && error.statusCode === 400
    && !error.payment_intent && !(error.raw && typeof error.raw === "object" && "payment_intent" in error.raw)
    && error.code !== "idempotency_key_in_use";
}

async function attachPaymentIntent(tx: CommerceTransaction, attempt: CheckoutAttemptRow, payment: PaymentRow, intent: Stripe.PaymentIntent) {
  const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id ?? null;
  const attached = await tx.query(
    `UPDATE "CheckoutAttempt" SET "paymentIntentId" = $2, "status" = 'READY'
     WHERE "id" = $1 AND "status" IN ('PAYMENT_INTENT_CREATING', 'READY')
       AND ("paymentIntentId" IS NULL OR "paymentIntentId" = $2) RETURNING "id"`,
    [attempt.id, intent.id],
  );
  const linked = await tx.query(
    `UPDATE "Payment" SET "paymentIntentId" = $2, "chargeId" = COALESCE($3, "chargeId")
     WHERE "id" = $1 AND ("paymentIntentId" IS NULL OR "paymentIntentId" = $2) RETURNING "id"`,
    [payment.id, intent.id, chargeId],
  );
  if (attached.rows.length !== 1 || linked.rows.length !== 1) throw new Error("Payment attachment invariant violated");
}

/** All calls use the existing attempt. This service never creates orders or reserves inventory. */
export class PaymentIntentService {
  constructor(private readonly deps: PaymentIntentDeps) {}

  async preparePayment(attemptId: string, storeId: string): Promise<PreparedPayment> {
    if (!attemptId?.trim() || !storeId?.trim()) {
      throw new ApiError(422, "CHECKOUT_INPUT_INVALID", "An attempt and store are required.");
    }
    const outcome = await this.deps.repository.transaction(async (tx): Promise<{ value: PreparedPayment } | { error: ApiError }> => {
      // Hold the attempt and order row locks through remote creation and local attachment.
      // Concurrent preparation sees the attached ID after commit; a crash rolls back local
      // writes and the next request repeats Stripe creation with the durable key.
      const attempt = (await tx.query<CheckoutAttemptRow>(
        `SELECT * FROM "CheckoutAttempt" WHERE "id" = $1 AND "storeId" = $2 FOR UPDATE`, [attemptId, storeId],
      )).rows[0];
      if (!attempt) throw new ApiError(404, "CHECKOUT_ATTEMPT_NOT_FOUND", "Checkout attempt not found.");
      if (!["PAYMENT_INTENT_CREATING", "READY"].includes(attempt.status) || attempt.expiresAt.getTime() <= Date.now()) throw unavailable();
      const order = (await tx.query<OrderRow>(
        `SELECT * FROM "Order" WHERE "id" = $1 AND "storeId" = $2 FOR UPDATE`, [attempt.orderId, storeId],
      )).rows[0];
      if (!order || order.status !== "PENDING_PAYMENT") throw unavailable();
      const payment = (await tx.query<PaymentRow>(
        `SELECT * FROM "Payment" WHERE "orderId" = $1 AND "storeId" = $2 FOR UPDATE`, [attempt.orderId, storeId],
      )).rows[0];
      if (!payment || payment.status !== "PENDING" || payment.amountMinor !== order.totalMinor || payment.currency !== order.currency
        || payment.paymentIntentId !== attempt.paymentIntentId) throw unavailable();

      let intent: Stripe.PaymentIntent;
      try {
        intent = attempt.paymentIntentId
          ? await this.deps.stripeGateway.retrievePaymentIntent(attempt.paymentIntentId, payment.stripeAccountId)
          : await this.deps.stripeGateway.createDirectPaymentIntent({
            amount: payment.amountMinor, currency: payment.currency.toLowerCase(),
            orderId: order.id, checkoutAttemptId: attempt.id,
          }, { connectedAccountId: payment.stripeAccountId, idempotencyKey: attempt.stripeIdempotencyKey });
      } catch (error) {
        if (!attempt.paymentIntentId && isDefinitiveCreationError(error)) {
          const cancelled = await tx.query(
            `UPDATE "Order" SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP
             WHERE "id" = $1 AND "status" = 'PENDING_PAYMENT' RETURNING "id"`, [order.id],
          );
          if (cancelled.rows.length === 1) {
            await tx.query(`UPDATE "CheckoutAttempt" SET "status" = 'CANCELLED' WHERE "id" = $1 AND "status" = 'PAYMENT_INTENT_CREATING'`, [attempt.id]);
            await tx.query(`UPDATE "Payment" SET "status" = 'CANCELLED' WHERE "id" = $1 AND "status" = 'PENDING'`, [payment.id]);
            await tx.releaseAttempt(attempt.id);
          }
          // Throw only after the transaction commits, so cancellation and release survive.
          return { error: new ApiError(422, "PAYMENT_CREATION_REJECTED", "Payment could not be created. Start a new checkout attempt.") };
        }
        return { error: retryError() };
      }

      if (!intent.id || (attempt.paymentIntentId && intent.id !== attempt.paymentIntentId)
        || intent.amount !== payment.amountMinor || intent.currency !== payment.currency.toLowerCase()
        || intent.metadata.jelly_order_id !== order.id || intent.metadata.jelly_checkout_attempt_id !== attempt.id) {
        return { error: retryError() };
      }
      // Kept outside the Stripe-error catch: local persistence failure must roll back,
      // never trigger cancellation of a possibly-created Stripe intent.
      await attachPaymentIntent(tx, attempt, payment, intent);
      if (attempt.expiresAt.getTime() <= Date.now()) return { error: unavailable() };
      if (!["requires_payment_method", "requires_confirmation"].includes(intent.status) || !intent.client_secret) {
        // Preserve the references for webhook reconciliation; the browser cannot mark paid.
        return { error: new ApiError(409, "PAYMENT_NOT_CONFIRMABLE", "Payment is awaiting reconciliation or cannot be confirmed.") };
      }
      return { value: { orderId: order.id, publicToken: order.publicToken, clientSecret: intent.client_secret, connectedAccountId: payment.stripeAccountId } };
    });
    if ("error" in outcome) throw outcome.error;
    // The database adapter has committed before exposing the client secret.
    return outcome.value;
  }
}
