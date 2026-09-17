import express from "express";

import type { SqlExecutor } from "../../commerce/repository.js";
import type { StripeGateway } from "../client.js";

import { processConnectPaymentEvent } from "./processor.js";
import { WebhookReceiptRepository } from "./receipt-repository.js";

export function createConnectPaymentsWebhookRouter(
  gateway: StripeGateway,
  sql: SqlExecutor,
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

        if (!receipt.duplicate) {
          await processConnectPaymentEvent(
            sql,
            {
              id: receipt.row.id,
              type: event.type,
              stripeAccountId,
              payload,
            },
          );
        }

        return response.status(200).json({
          received: true,
          duplicate: receipt.duplicate,
        });
      } catch {
        return response.status(400).json({
          error: {
            code: "STRIPE_WEBHOOK_INVALID",
          },
        });
      }
    },
  );

  return router;
}