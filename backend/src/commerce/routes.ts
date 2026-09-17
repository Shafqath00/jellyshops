import express from "express";
import { z } from "zod";

import { ApiError } from "../http/errors.js";
import type { CheckoutService } from "./service.js";

const checkoutLineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const beginCheckoutSchema = z.object({
  cartKey: z.string().min(1),
  currency: z.string().length(3),
  items: z.array(checkoutLineSchema).min(1),
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

        const result = await service.begin({
          storeId,
          ...parsed.data,
        });

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