import type { StripeGateway } from "../stripe/client.js";
import type { CommerceRepository } from "./repository.js";

interface ExpiredCheckout {
  id: string;
  orderId: string;
  storeId: string;
  paymentIntentId: string | null;
  stripeAccountId: string | null;
}

function paymentAlreadySucceeded(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /already succeeded|unexpected_state/i.test(
    error.message,
  );
}

export class ReservationSweeper {
  constructor(
    private readonly repository: CommerceRepository,
    private readonly stripe: StripeGateway,
  ) {}

  async sweep(now = new Date()): Promise<number> {
    const candidates =
      await this.findExpiredCheckouts(now);

    let released = 0;

    for (const checkout of candidates) {
      const safeToRelease =
        await this.cancelPaymentIfNeeded(checkout);

      if (!safeToRelease) {
        continue;
      }

      const cancelled =
        await this.cancelPendingOrder(checkout);

      if (!cancelled) {
        continue;
      }

      await this.repository.releaseAttempt(
        checkout.id,
      );

      released += 1;
    }

    return released;
  }

  private async findExpiredCheckouts(
    now: Date,
  ): Promise<ExpiredCheckout[]> {
    return this.repository.transaction(
      async (tx) => {
        const result =
          await tx.query<ExpiredCheckout>(
            `
              SELECT
                ca."id",
                ca."orderId",
                ca."storeId",
                p."paymentIntentId",
                p."stripeAccountId"
              FROM "CheckoutAttempt" ca
              JOIN "Order" o
                ON o."id" = ca."orderId"
                AND o."storeId" = ca."storeId"
              LEFT JOIN "Payment" p
                ON p."orderId" = ca."orderId"
                AND p."storeId" = ca."storeId"
              WHERE ca."expiresAt" <= $1
                AND ca."status" IN (
                  'PAYMENT_INTENT_CREATING',
                  'READY'
                )
                AND o."status" = 'PENDING_PAYMENT'
            `,
            [now],
          );

        return result.rows;
      },
    );
  }

  private async cancelPaymentIfNeeded(
    checkout: ExpiredCheckout,
  ): Promise<boolean> {
    if (!checkout.paymentIntentId) {
      return true;
    }

    if (!checkout.stripeAccountId) {
      return false;
    }

    try {
      await this.stripe.cancelPaymentIntent(
        checkout.paymentIntentId,
        {
          connectedAccountId:
            checkout.stripeAccountId,
          idempotencyKey:
            `sweep-${checkout.id}`,
        },
      );

      return true;
    } catch (error) {
      // If Stripe reports the payment already succeeded,
      // local state must be left untouched for webhook reconciliation.
      if (paymentAlreadySucceeded(error)) {
        return false;
      }

      // Ambiguous failures are retried by a later sweep.
      return false;
    }
  }

  private async cancelPendingOrder(
    checkout: ExpiredCheckout,
  ): Promise<boolean> {
    return this.repository.transaction(
      async (tx) => {
        const result = await tx.query(
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
          [
            checkout.orderId,
            checkout.storeId,
          ],
        );

        return result.rows.length === 1;
      },
    );
  }
}