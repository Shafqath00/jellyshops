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
