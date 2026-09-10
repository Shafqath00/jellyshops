import { Router } from "express";
import { z } from "zod";
import { requireMerchant } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import type { TenantRepository } from "./repository.js";

const createStoreSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(63),
  currency: z.string().regex(/^[A-Z]{3}$/),
  country: z.string().regex(/^[A-Z]{2}$/),
}).strict();

function merchantId(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== value) {
    throw new ApiError(500, "PRINCIPAL_INVALID", "The authenticated merchant identity is invalid");
  }
  return parsed;
}

export function createMerchantRouter(authProvider: AuthProvider, tenants: TenantRepository): Router {
  const router = Router();
  const merchant = requireMerchant(authProvider);

  router.get("/me", merchant, async (request, response) => {
    const id = merchantId(request.merchant?.merchantId);
    response.json({ merchantId: request.merchant?.merchantId, stores: await tenants.listStores(id) });
  });

  router.get("/stores", merchant, async (request, response) => {
    const id = merchantId(request.merchant?.merchantId);
    response.json({ stores: await tenants.listStores(id) });
  });

  router.post("/stores", merchant, async (request, response) => {
    const id = merchantId(request.merchant?.merchantId);
    const input = createStoreSchema.parse(request.body);
    response.status(201).json({ store: await tenants.createStore(id, input) });
  });

  return router;
}
