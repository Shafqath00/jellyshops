import express from "express";
import { z } from "zod";

import { ApiError } from "../http/errors.js";
import type { CheckoutService } from "./service.js";

const checkoutLineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(999),
  configurationSelections: z.array(z.object({
    optionId: z.string().min(1), valueId: z.string().min(1),
  })).max(20).optional(),
});

const beginCheckoutSchema = z.object({
  cartKey: z.string().min(1).max(128),
  currency: z.string().length(3),
  items: z.array(checkoutLineSchema).min(1).max(50),
  customerSnapshot: z.record(z.string(), z.unknown()),
  deliverySnapshot: z.record(z.string(), z.unknown()).optional(),
});

const preparePaymentSchema = z.object({
  attemptId: z.string().trim().min(1),
});

function getStoreId(request: express.Request): string {
  return String(request.params.storeId);
}

function getPublicToken(request: express.Request): string {
  return String(request.params.publicToken);
}

export function createCommerceRouter(
  service: CheckoutService,
  resolveCustomer?: (request: express.Request) => Promise<string | undefined>,
): express.Router {
  const router = express.Router({ mergeParams: true });

  router.post(
    "/attempts",
    async (request, response, next) => {
      try {
        const storeId = getStoreId(request);
        const parsed = beginCheckoutSchema.safeParse(request.body);

        if (!parsed.success) {
          throw new ApiError(
            422,
            "CHECKOUT_INPUT_INVALID",
            "Invalid checkout input.",
          );
        }

        await service.assertCheckoutAccess(storeId, request.ip ?? "unknown", parsed.data.cartKey);
        const customerId = await resolveCustomer?.(request);
        const input = {
          storeId,
          ...parsed.data,
        };
        const result = customerId ? await service.begin(input, customerId) : await service.begin(input);

        response
          .status(201)
          .json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/payment-intent",
    async (request, response, next) => {
      response.setHeader("Cache-Control", "no-store");

      try {
        const storeId = getStoreId(request);
        const parsed = preparePaymentSchema.safeParse(request.body);

        if (!parsed.success) {
          throw new ApiError(
            422,
            "CHECKOUT_INPUT_INVALID",
            "A checkout attempt is required.",
          );
        }

        await service.assertCheckoutAccess(storeId, request.ip ?? "unknown", parsed.data.attemptId, true);
        const result = await service.preparePayment(
          parsed.data.attemptId,
          storeId,
        );

        response.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

export function createPublicOrderRouter(
  service: CheckoutService,
): express.Router {
  const router = express.Router({ mergeParams: true });

  router.get(
    "/:publicToken",
    async (request, response, next) => {
      response.setHeader("Cache-Control", "no-store");

      try {
        const storeId = getStoreId(request);
        const publicToken = getPublicToken(request);
        const ip = request.ip ?? "unknown";

        await service.assertPublicOrderAccess(
          storeId,
          ip,
        );

        const order = await service.getPublicOrder(
          storeId,
          publicToken,
        );

        response.json(order);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
