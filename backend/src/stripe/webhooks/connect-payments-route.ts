import express from "express";

import type { CommerceDatabase, SqlExecutor } from "../../commerce/repository.js";
import type { StripeGateway } from "../client.js";

import { processConnectPaymentEvent, type PaymentSettlementHooks } from "./processor.js";
import { WebhookReceiptRepository } from "./receipt-repository.js";

export function createConnectPaymentsWebhookRouter(
  gateway: StripeGateway,
  sql: SqlExecutor,
  options: { database?: CommerceDatabase; hooks?: PaymentSettlementHooks } = {},
): express.Router {
  const router = express.Router();
  const receipts =
    new WebhookReceiptRepository(sql);

  router.post(
    "/",
    express.raw({
      type: "application/json",
    }),
    async (request, response) => {
      try {
        const signature =
          request.header("stripe-signature");

        if (!signature) {
          return response.status(400).json({
            error: {
              code:
                "STRIPE_SIGNATURE_INVALID",
            },
          });
        }

        const event =
          gateway.constructEvent(
            "connect-payments",
            request.body as Buffer,
            signature,
          );

        if (!event.id || !event.type) {
          return response.status(400).json({
            error: {
              code: "STRIPE_EVENT_INVALID",
            },
          });
        }

        const stripeAccountId =
          event.account ?? null;

        const payload =
          event as unknown as Record<
            string,
            unknown
          >;

        const receipt =
          await receipts.record({
            id: `wh-${event.id}`,
            stripeEventId: event.id,
            type: event.type,
            payload,
            endpointFamily:
              "connect-payments",
            stripeAccountId,
          });

        const process = async (transaction: SqlExecutor) => {
          // Serialize simultaneous deliveries on the receipt, on one connection.
          const current = options.database
            ? (await transaction.query<{ processedAt: Date | null }>(
                'SELECT "processedAt" FROM "StripeWebhookEvent" WHERE "id" = $1 FOR UPDATE', [receipt.row.id],
              )).rows[0]
            : receipt.row;
          if (current?.processedAt) return;
          await processConnectPaymentEvent(transaction, {
              id: receipt.row.id,
              type: event.type,
              stripeAccountId,
              payload,
            }, options.hooks);
        };
        if (!receipt.row.processedAt) {
          if (options.database) await options.database.transaction(process);
          else await process(sql);
        }

        return response.status(200).json({
          received: true,
          duplicate: receipt.duplicate,
        });
      } catch (error) {
        const signatureError = error instanceof Error && /signature|payload|timestamp/i.test(error.message);
        return response.status(signatureError ? 400 : 500).json({
          error: {
            code: signatureError ? "STRIPE_WEBHOOK_INVALID" : "STRIPE_WEBHOOK_PROCESSING_FAILED",
          },
        });
      }
    },
  );

  return router;
}
