import Stripe from "stripe";

import { ApiError } from "../http/errors.js";
import type { StripeGateway } from "../stripe/client.js";

import type {
  CheckoutAttemptRow,
  CommerceRepository,
  CommerceTransaction,
  OrderRow,
  PaymentRow,
} from "./repository.js";

export type PaymentIntentGateway = Pick<
  StripeGateway,
  "createDirectPaymentIntent" | "retrievePaymentIntent"
>;

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

interface CheckoutState {
  attempt: CheckoutAttemptRow;
  order: OrderRow;
  payment: PaymentRow;
}

const usableAttemptStatuses = new Set([
  "PAYMENT_INTENT_CREATING",
  "READY",
]);

const confirmableIntentStatuses = new Set([
  "requires_payment_method",
  "requires_confirmation",
]);

function retryError() {
  return new ApiError(
    503,
    "PAYMENT_PREPARATION_RETRY",
    "Payment preparation is incomplete. Retry this checkout attempt.",
  );
}

function unavailableError() {
  return new ApiError(
    409,
    "CHECKOUT_ATTEMPT_UNAVAILABLE",
    "This checkout attempt is no longer available.",
  );
}

function isExpired(attempt: CheckoutAttemptRow) {
  return attempt.expiresAt.getTime() <= Date.now();
}

function isDefinitiveCreationError(error: unknown): boolean {
  if (!(error instanceof Stripe.errors.StripeInvalidRequestError)) {
    return false;
  }

  if (error.statusCode !== 400) {
    return false;
  }

  if (error.code === "idempotency_key_in_use") {
    return false;
  }

  if (error.payment_intent) {
    return false;
  }

  if (
    error.raw &&
    typeof error.raw === "object" &&
    "payment_intent" in error.raw
  ) {
    return false;
  }

  return true;
}

async function loadCheckoutState(
  tx: CommerceTransaction,
  attemptId: string,
  storeId: string,
): Promise<CheckoutState> {
  const attemptResult = await tx.query<CheckoutAttemptRow>(
    `
      SELECT *
      FROM "CheckoutAttempt"
      WHERE "id" = $1
        AND "storeId" = $2
      FOR UPDATE
    `,
    [attemptId, storeId],
  );

  const attempt = attemptResult.rows[0];

  if (!attempt) {
    throw new ApiError(
      404,
      "CHECKOUT_ATTEMPT_NOT_FOUND",
      "Checkout attempt not found.",
    );
  }

  if (
    !usableAttemptStatuses.has(attempt.status) ||
    isExpired(attempt)
  ) {
    throw unavailableError();
  }

  const orderResult = await tx.query<OrderRow>(
    `
      SELECT *
      FROM "Order"
      WHERE "id" = $1
        AND "storeId" = $2
      FOR UPDATE
    `,
    [attempt.orderId, storeId],
  );

  const order = orderResult.rows[0];

  if (!order || order.status !== "PENDING_PAYMENT") {
    throw unavailableError();
  }

  const paymentResult = await tx.query<PaymentRow>(
    `
      SELECT *
      FROM "Payment"
      WHERE "orderId" = $1
        AND "storeId" = $2
      FOR UPDATE
    `,
    [attempt.orderId, storeId],
  );

  const payment = paymentResult.rows[0];

  if (!payment) {
    throw unavailableError();
  }

  const paymentIsValid =
    payment.status === "PENDING" &&
    payment.amountMinor === order.totalMinor &&
    payment.currency === order.currency &&
    payment.paymentIntentId === attempt.paymentIntentId;

  if (!paymentIsValid) {
    throw unavailableError();
  }

  return {
    attempt,
    order,
    payment,
  };
}

async function getPaymentIntent(
  gateway: PaymentIntentGateway,
  state: CheckoutState,
): Promise<Stripe.PaymentIntent> {
  const { attempt, order, payment } = state;

  if (attempt.paymentIntentId) {
    return gateway.retrievePaymentIntent(
      attempt.paymentIntentId,
      payment.stripeAccountId,
    );
  }

  return gateway.createDirectPaymentIntent(
    {
      amount: payment.amountMinor,
      currency: payment.currency.toLowerCase(),
      orderId: order.id,
      checkoutAttemptId: attempt.id,
    },
    {
      connectedAccountId: payment.stripeAccountId,
      idempotencyKey: attempt.stripeIdempotencyKey,
    },
  );
}

async function cancelLocalCheckout(
  tx: CommerceTransaction,
  state: CheckoutState,
) {
  const { attempt, order, payment } = state;

  const cancelledOrder = await tx.query(
    `
      UPDATE "Order"
      SET
        "status" = 'CANCELLED',
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
        AND "status" = 'PENDING_PAYMENT'
      RETURNING "id"
    `,
    [order.id],
  );

  // Another process may already have changed the order.
  if (cancelledOrder.rows.length !== 1) {
    return;
  }

  await tx.query(
    `
      UPDATE "CheckoutAttempt"
      SET "status" = 'CANCELLED'
      WHERE "id" = $1
        AND "status" = 'PAYMENT_INTENT_CREATING'
    `,
    [attempt.id],
  );

  await tx.query(
    `
      UPDATE "Payment"
      SET "status" = 'CANCELLED'
      WHERE "id" = $1
        AND "status" = 'PENDING'
    `,
    [payment.id],
  );

  await tx.releaseAttempt(attempt.id);
}

function validateIntent(
  intent: Stripe.PaymentIntent,
  state: CheckoutState,
): boolean {
  const { attempt, order, payment } = state;

  if (!intent.id) {
    return false;
  }

  if (
    attempt.paymentIntentId &&
    intent.id !== attempt.paymentIntentId
  ) {
    return false;
  }

  if (intent.amount !== payment.amountMinor) {
    return false;
  }

  if (intent.currency !== payment.currency.toLowerCase()) {
    return false;
  }

  if (intent.metadata.jelly_order_id !== order.id) {
    return false;
  }

  if (
    intent.metadata.jelly_checkout_attempt_id !== attempt.id
  ) {
    return false;
  }

  return true;
}

async function attachPaymentIntent(
  tx: CommerceTransaction,
  attempt: CheckoutAttemptRow,
  payment: PaymentRow,
  intent: Stripe.PaymentIntent,
) {
  const chargeId =
    typeof intent.latest_charge === "string"
      ? intent.latest_charge
      : intent.latest_charge?.id ?? null;

  const attemptResult = await tx.query(
    `
      UPDATE "CheckoutAttempt"
      SET
        "paymentIntentId" = $2,
        "status" = 'READY'
      WHERE "id" = $1
        AND "status" IN ('PAYMENT_INTENT_CREATING', 'READY')
        AND (
          "paymentIntentId" IS NULL
          OR "paymentIntentId" = $2
        )
      RETURNING "id"
    `,
    [attempt.id, intent.id],
  );

  const paymentResult = await tx.query(
    `
      UPDATE "Payment"
      SET
        "paymentIntentId" = $2,
        "chargeId" = COALESCE($3, "chargeId")
      WHERE "id" = $1
        AND (
          "paymentIntentId" IS NULL
          OR "paymentIntentId" = $2
        )
      RETURNING "id"
    `,
    [payment.id, intent.id, chargeId],
  );

  if (
    attemptResult.rows.length !== 1 ||
    paymentResult.rows.length !== 1
  ) {
    throw new Error("Payment attachment invariant violated");
  }
}

/**
 * Prepares an existing checkout attempt for Stripe confirmation.
 *
 * This service never creates orders and never reserves inventory.
 */
export class PaymentIntentService {
  constructor(private readonly deps: PaymentIntentDeps) {}

  async preparePayment(
    attemptId: string,
    storeId: string,
  ): Promise<PreparedPayment> {
    if (!attemptId?.trim() || !storeId?.trim()) {
      throw new ApiError(
        422,
        "CHECKOUT_INPUT_INVALID",
        "An attempt and store are required.",
      );
    }

    const outcome = await this.deps.repository.transaction(
      async (
        tx,
      ): Promise<
        { value: PreparedPayment } | { error: ApiError }
      > => {
        const state = await loadCheckoutState(
          tx,
          attemptId,
          storeId,
        );

        let intent: Stripe.PaymentIntent;

        try {
          intent = await getPaymentIntent(
            this.deps.stripeGateway,
            state,
          );
        } catch (error) {
          const isNewIntent =
            !state.attempt.paymentIntentId;

          if (
            isNewIntent &&
            isDefinitiveCreationError(error)
          ) {
            await cancelLocalCheckout(tx, state);

            return {
              error: new ApiError(
                422,
                "PAYMENT_CREATION_REJECTED",
                "Payment could not be created. Start a new checkout attempt.",
              ),
            };
          }

          return {
            error: retryError(),
          };
        }

        if (!validateIntent(intent, state)) {
          return {
            error: retryError(),
          };
        }

        /*
         * Keep this outside the Stripe catch.
         *
         * A database failure here must roll back locally without
         * pretending Stripe creation failed.
         */
        await attachPaymentIntent(
          tx,
          state.attempt,
          state.payment,
          intent,
        );

        if (isExpired(state.attempt)) {
          return {
            error: unavailableError(),
          };
        }

        if (
          !confirmableIntentStatuses.has(intent.status) ||
          !intent.client_secret
        ) {
          return {
            error: new ApiError(
              409,
              "PAYMENT_NOT_CONFIRMABLE",
              "Payment is awaiting reconciliation or cannot be confirmed.",
            ),
          };
        }

        return {
          value: {
            orderId: state.order.id,
            publicToken: state.order.publicToken,
            clientSecret: intent.client_secret,
            connectedAccountId:
              state.payment.stripeAccountId,
          },
        };
      },
    );

    // The transaction has committed before the secret reaches the browser.
    if ("error" in outcome) {
      throw outcome.error;
    }

    return outcome.value;
  }
}