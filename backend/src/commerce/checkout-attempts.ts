import { ApiError } from "../http/errors.js";

import type { PaymentIntentGateway } from "./payment-intents.js";
import type {
  CheckoutAttemptRow,
  CommerceTransaction,
  OrderRow,
} from "./repository.js";
import type { CheckoutAttemptResult } from "./types.js";

export interface AttemptDeps {
  stripeGateway?: PaymentIntentGateway;
}

function checkoutUnavailable() {
  return new ApiError(
    409,
    "CHECKOUT_ATTEMPT_UNAVAILABLE",
    "This checkout attempt is no longer available.",
  );
}

function isAlreadySucceededCancellation(
  error: unknown,
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const candidate = error as Error & {
    code?: string;
  };

  if (
    candidate.code ===
    "payment_intent_unexpected_state"
  ) {
    return true;
  }

  return /already succeeded|cannot be canceled|cannot be cancelled/i.test(
    candidate.message,
  );
}

export async function findExistingAttempt(
  tx: CommerceTransaction,
  storeId: string,
  cartKey: string,
) {
  const result =
    await tx.query<CheckoutAttemptRow>(
      `
        SELECT *
        FROM "CheckoutAttempt"
        WHERE "storeId" = $1
          AND "cartKey" = $2
          AND "status" IN (
            'PAYMENT_INTENT_CREATING',
            'READY'
          )
        ORDER BY "createdAt" DESC
        LIMIT 1
      `,
      [storeId, cartKey],
    );

  return result.rows[0] ?? null;
}

export async function tryReuseAttempt(
  tx: CommerceTransaction,
  attempt: CheckoutAttemptRow,
  cartHash: string,
): Promise<CheckoutAttemptResult | null> {
  const reusable =
    attempt.cartHash === cartHash &&
    attempt.expiresAt.getTime() >
      Date.now();

  if (!reusable) {
    return null;
  }

  const result = await tx.query<OrderRow>(
    `
      SELECT "publicToken"
      FROM "Order"
      WHERE "id" = $1
    `,
    [attempt.orderId],
  );

  return {
    attemptId: attempt.id,
    orderId: attempt.orderId,
    publicToken:
      result.rows[0]?.publicToken ?? "",
  };
}

export async function cancelExistingAttempt(
  deps: AttemptDeps,
  tx: CommerceTransaction,
  attempt: CheckoutAttemptRow,
  storeId: string,
): Promise<void> {
  if (attempt.paymentIntentId) {
    await cancelStripeIntent(deps, 
      tx,
      attempt,
      storeId,
    );
  }

  const cancelled = await tx.query(
    `
      UPDATE "Order"
      SET
        "status" = 'CANCELLED',
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
        AND "storeId" = $2
        AND "status" = 'PENDING_PAYMENT'
      RETURNING "id"
    `,
    [attempt.orderId, storeId],
  );

  if (cancelled.rows.length !== 1) {
    return;
  }

  await tx.query(
    `
      UPDATE "CheckoutAttempt"
      SET "status" = 'CANCELLED'
      WHERE "id" = $1
        AND "status" IN (
          'PAYMENT_INTENT_CREATING',
          'READY'
        )
    `,
    [attempt.id],
  );

  await tx.query(
    `
      UPDATE "Payment"
      SET "status" = 'CANCELLED'
      WHERE "orderId" = $1
        AND "storeId" = $2
        AND "status" = 'PENDING'
    `,
    [attempt.orderId, storeId],
  );

  await tx.releaseAttempt(attempt.id);
}

export async function cancelStripeIntent(
  deps: AttemptDeps,
  tx: CommerceTransaction,
  attempt: CheckoutAttemptRow,
  storeId: string,
): Promise<void> {
  const cancel =
    deps.stripeGateway
      ?.cancelPaymentIntent;

  if (!cancel || !attempt.paymentIntentId) {
    return;
  }

  const result = await tx.query<{
    stripeAccountId: string;
  }>(
    `
      SELECT "stripeAccountId"
      FROM "Payment"
      WHERE "orderId" = $1
        AND "storeId" = $2
      FOR UPDATE
    `,
    [attempt.orderId, storeId],
  );

  const payment = result.rows[0];

  if (!payment) {
    throw checkoutUnavailable();
  }

  try {
    await cancel(
      attempt.paymentIntentId,
      {
        connectedAccountId:
          payment.stripeAccountId,
        idempotencyKey:
          `${attempt.stripeIdempotencyKey}-cancel`,
      },
    );
  } catch (error) {
    if (
      !isAlreadySucceededCancellation(
        error,
      )
    ) {
      throw error;
    }
  }
}
