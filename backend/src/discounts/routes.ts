import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import { DISCOUNT_KINDS } from "./rules.js";
import type { DiscountService } from "./service.js";

const discountSchema = z.object({
  code: z.string().max(60),
  kind: z.enum(DISCOUNT_KINDS as [string, ...string[]]),
  value: z.number().int().min(0).max(100_000_000).optional(),
  minimumSubtotalMinor: z.number().int().min(1).max(100_000_000).nullable().optional(),
  usageLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
  oncePerCustomer: z.boolean().optional(),
  startsAt: z.string().max(40).nullable().optional(),
  endsAt: z.string().max(40).nullable().optional(),
  active: z.boolean().optional(),
}).strict();

function parse(body: unknown) {
  const parsed = discountSchema.safeParse(body ?? {});
  if (!parsed.success) throw new ApiError(422, "DISCOUNT_INPUT_INVALID", "Check the discount details and try again.");
  return parsed.data as z.infer<typeof discountSchema> & { kind: (typeof DISCOUNT_KINDS)[number] };
}

/** Merchants, under `/api/stores/:storeId/discounts`: list, create, `PUT /:id`, `DELETE /:id`. */
export function createDiscountRouter(service: DiscountService, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.get("/", requireMerchant(authProvider), requireStorePermission("orders:view"), async (request, response, next) => {
    try { response.json({ discounts: await service.list(request.storeContext!.storeId) }); } catch (error) { next(error); }
  });
  router.post("/", requireMerchant(authProvider), requireStorePermission("orders:manage"), async (request, response, next) => {
    try { response.status(201).json({ discount: await service.create(request.storeContext!.storeId, parse(request.body)) }); } catch (error) { next(error); }
  });
  router.put<{ storeId: string; id: string }>("/:id", requireMerchant(authProvider), requireStorePermission("orders:manage"), async (request, response, next) => {
    try { response.json({ discount: await service.update(request.storeContext!.storeId, String(request.params.id), parse(request.body)) }); } catch (error) { next(error); }
  });
  router.delete<{ storeId: string; id: string }>("/:id", requireMerchant(authProvider), requireStorePermission("orders:manage"), async (request, response, next) => {
    try { await service.remove(request.storeContext!.storeId, String(request.params.id)); response.status(204).end(); } catch (error) { next(error); }
  });
  return router;
}
