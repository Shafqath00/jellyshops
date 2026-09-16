import type { StripeGateway } from "../stripe/client.js";
import type { CommerceRepository } from "./repository.js";

export class ReservationSweeper {
  constructor(private readonly repository: CommerceRepository, private readonly stripe: StripeGateway) {}
  async sweep(now = new Date()): Promise<number> {
    const candidates = await this.repository.transaction(async (tx) => (await tx.query<any>(`SELECT ca.*, o."status" AS "orderStatus", p."paymentIntentId", p."stripeAccountId" FROM "CheckoutAttempt" ca JOIN "Order" o ON o."id" = ca."orderId" AND o."storeId" = ca."storeId" LEFT JOIN "Payment" p ON p."orderId" = ca."orderId" AND p."storeId" = ca."storeId" WHERE ca."expiresAt" <= $1 AND ca."status" IN ('PAYMENT_INTENT_CREATING','READY') AND o."status" = 'PENDING_PAYMENT' FOR UPDATE`, [now])).rows);
    let released = 0;
    for (const row of candidates) {
      if (row.paymentIntentId) {
        try { await this.stripe.cancelPaymentIntent(row.paymentIntentId, { connectedAccountId: row.stripeAccountId, idempotencyKey: `sweep-${row.id}` }); }
        catch (error) { if (!(error instanceof Error && /already succeeded|unexpected_state/i.test(error.message))) continue; }
      }
      const changed = await this.repository.transaction(async (tx) => (await tx.query(`UPDATE "Order" SET "status"='CANCELLED', "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "storeId"=$2 AND "status"='PENDING_PAYMENT' RETURNING "id"`, [row.orderId, row.storeId])).rows.length);
      if (changed) { await this.repository.releaseAttempt(row.id); released += 1; }
    }
    return released;
  }
}
