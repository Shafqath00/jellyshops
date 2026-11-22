import express from "express";

import type { CommerceDatabase, SqlExecutor } from "../../commerce/repository.js";
import type { StripeGateway } from "../client.js";

import { processConnectPaymentEvent, type PaymentSettlementHooks } from "./processor.js";
import { WebhookReceiptRepository } from "./receipt-repository.js";

export function createConnectPaymentsWebhookRouter(
  gateway: StripeGateway,
  sql: SqlExecutor,
  options: {
    database?: CommerceDatabase;
    hooks?: PaymentSettlementHooks;
    /** Called once a payment settled, failed or was cancelled, because the stock a store shows may have changed. */
    onStoreChanged?: (storeId: string) => Promise<void>;
  } = {},
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
            // Firebase parses JSON before Express; its rawBody retains the signed bytes.
            (request as typeof request & { rawBody?: Buffer }).rawBody ?? request.body as Buffer,
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

        await refreshStoreAfterPayment(sql, event.type, stripeAccountId, payload, options.onStoreChanged);

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

const STOCK_EVENTS = new Set(["payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled"]);

/** Stock is sold or released when a payment settles, so the store's cached pages are refreshed. Never throws. */
async function refreshStoreAfterPayment(
  sql: SqlExecutor,
  type: string,
  stripeAccountId: string | null,
  payload: Record<string, unknown>,
  onStoreChanged?: (storeId: string) => Promise<void>,
): Promise<void> {
  if (!onStoreChanged || !stripeAccountId || !STOCK_EVENTS.has(type)) return;
  const object = (payload.data as { object?: { id?: unknown } } | undefined)?.object;
  const intentId = typeof object?.id === "string" ? object.id : null;
  if (!intentId) return;
  try {
    const row = (await sql.query<{ storeId: string }>('SELECT "storeId" FROM "Payment" WHERE "stripeAccountId" = $1 AND "paymentIntentId" = $2 LIMIT 1', [stripeAccountId, intentId])).rows[0];
    if (row) await onStoreChanged(row.storeId);
  } catch { /* the storefront refreshes on its time limit instead */ }
}
