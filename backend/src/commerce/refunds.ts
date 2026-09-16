import { randomUUID } from "node:crypto";
import { ApiError } from "../http/errors.js";
import type { StripeGateway } from "../stripe/client.js";
import type { CommerceRepository } from "./repository.js";

export class RefundService {
  constructor(private readonly repository: CommerceRepository, private readonly stripe: StripeGateway) {}
  async fullRefund(storeId: string, orderId: string) {
    return this.repository.transaction(async (tx) => {
      const order = (await tx.query<any>(`SELECT * FROM "Order" WHERE "storeId" = $1 AND "id" = $2 FOR UPDATE`, [storeId, orderId])).rows[0];
      const payment = (await tx.query<any>(`SELECT * FROM "Payment" WHERE "storeId" = $1 AND "orderId" = $2 FOR UPDATE`, [storeId, orderId])).rows[0];
      if (!order || !payment || payment.status !== "PAID" || !["PAID", "CONFIRMED"].includes(order.status)) throw new ApiError(409, "ORDER_NOT_REFUNDABLE", "Order is not eligible for a full refund.");
      const existing = (await tx.query<any>(`SELECT * FROM "Refund" WHERE "storeId" = $1 AND "orderId" = $2 ORDER BY "id" LIMIT 1`, [storeId, orderId])).rows[0];
      if (existing) return existing;
      const id = `refund-${randomUUID()}`;
      const key = `refund-${id}`;
      const inserted = (await tx.query<any>(`INSERT INTO "Refund" ("id","storeId","orderId","paymentId","amountMinor","status","stripeIdempotencyKey") VALUES ($1,$2,$3,$4,$5,'PENDING',$6) RETURNING *`, [id, storeId, orderId, payment.id, payment.amountMinor, key])).rows[0];
      const refund = await this.stripe.createFullRefund({ paymentIntentId: payment.paymentIntentId, orderId, refundId: id }, { connectedAccountId: payment.stripeAccountId, idempotencyKey: key });
      await tx.query(`UPDATE "Refund" SET "stripeRefundId" = $2 WHERE "id" = $1`, [id, refund.id]);
      return inserted;
    });
  }
}
