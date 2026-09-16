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
  currency: z.string().min(3).max(3),
  items: z.array(checkoutLineSchema).min(1),
  customerSnapshot: z.record(z.string(), z.unknown()),
  deliverySnapshot: z.record(z.string(), z.unknown()).optional(),
});

export function createCommerceRouter(service: CheckoutService): express.Router {
  const router = express.Router({ mergeParams: true });

  router.post("/payment-intent", async (request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    try {
      const storeId = (request.params as Record<string, string>).storeId;
      const parsed = z.object({ attemptId: z.string().trim().min(1) }).safeParse(request.body);
      if (!parsed.success) throw new ApiError(422, "CHECKOUT_INPUT_INVALID", "A checkout attempt is required.");
      response.json(await service.preparePayment(parsed.data.attemptId, storeId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/attempts", async (request, response, next) => {
    try {
      const storeId = (request.params as Record<string, string>).storeId;
      const parsed = beginCheckoutSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ApiError(422, "CHECKOUT_INPUT_INVALID", "Invalid checkout input");
      }
      const input = parsed.data;
      const result = await service.begin({ storeId, ...input });
      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createPublicOrderRouter(service: CheckoutService): express.Router {
  const router = express.Router({ mergeParams: true });
  router.get("/:publicToken", async (request, response, next) => {
    try {
      const storeId = (request.params as Record<string, string>).storeId;
      const token = (request.params as Record<string, string>).publicToken;
      const result = await service.getPublicOrder(storeId, token);
      response.setHeader("Cache-Control", "no-store");
      response.json(result);
    } catch (error) { next(error); }
  });
  return router;
}
