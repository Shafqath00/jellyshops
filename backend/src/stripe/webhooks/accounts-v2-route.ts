import express from "express";
import type Stripe from "stripe";

import type { SqlExecutor } from "../../commerce/repository.js";
import type { StripeAccountService } from "../accounts/service.js";
import type { StripeGateway } from "../client.js";

import { WebhookReceiptRepository } from "./receipt-repository.js";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function getAccountId(event: unknown): string | null {
  const value = asRecord(event);
  const relatedObject = asRecord(value.related_object);

  const id =
    relatedObject.id ??
    value.account;

  return typeof id === "string" &&
    id.startsWith("acct_")
    ? id
    : null;
}

function invalidSignature(response: express.Response) {
  return response.status(400).json({
    error: {
      code: "STRIPE_SIGNATURE_INVALID",
    },
  });
}

function invalidEvent(response: express.Response) {
  return response.status(400).json({
    error: {
      code: "STRIPE_EVENT_INVALID",
    },
  });
}

export function createAccountsV2WebhookRouter(
  gateway: StripeGateway,
  accountService: StripeAccountService,
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
          return invalidSignature(response);
        }

        const event =
          gateway.constructEvent(
            "accounts-v2",
            request.body as Buffer,
            signature,
          ) as Stripe.V2.Core.EventNotification;

        const payload = asRecord(event);

        const eventId =
          typeof payload.id === "string"
            ? payload.id
            : "";

        const eventType =
          typeof payload.type === "string"
            ? payload.type
            : "";

        if (!eventId || !eventType) {
          return invalidEvent(response);
        }

        const connectedAccountId =
          getAccountId(event);

        const receipt =
          await receipts.record({
            id: `wh-${eventId}`,
            stripeEventId: eventId,
            type: eventType,
            payload,
            endpointFamily: "accounts-v2",
            stripeAccountId:
              connectedAccountId,
          });

        if (receipt.duplicate) {
          return response.status(200).json({
            received: true,
            duplicate: true,
          });
        }

        if (connectedAccountId) {
          if (
            eventType ===
            "v2.core.account.closed"
          ) {
            const service =
              accountService as StripeAccountService & {
                markClosed?: (
                  accountId: string,
                ) => Promise<unknown>;
              };

            await service.markClosed?.(
              connectedAccountId,
            );
          } else {
            await accountService.syncAccount(
              connectedAccountId,
            );
          }
        }

        return response.status(200).json({
          received: true,
          duplicate: false,
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