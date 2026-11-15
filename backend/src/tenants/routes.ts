import { Router } from "express";
import { z } from "zod";
import { requireMerchant } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import type { TenantRepository } from "./repository.js";
import { MARKET_CURRENCIES } from "./settings.js";
import type { OnboardingService } from "../onboarding/service.js";
import { storeSlugSchema } from "./store-slug.js";

export { RESERVED_STORE_SLUGS } from "./store-slug.js";

const createStoreSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: storeSlugSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  country: z.string().regex(/^[A-Z]{2}$/),
}).strict().refine((input) => MARKET_CURRENCIES[input.country] === input.currency, { message: "Choose India/INR, United Kingdom/GBP, or United States/USD.", path: ["currency"] });

function merchantId(value: string | undefined): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(500, "PRINCIPAL_INVALID", "The authenticated merchant identity is invalid");
  }
  return value;
}

export function createMerchantRouter(
  authProvider: AuthProvider,
  tenants: TenantRepository,
  onboarding?: Pick<OnboardingService, "assertStoreCreationConsent">,
): Router {
  const router = Router();
  const merchant = requireMerchant(authProvider);

  router.get("/me", merchant, async (request, response) => {
    const id = merchantId(request.merchant?.userId);
    response.json({ merchantId: id, stores: await tenants.listStores(id) });
  });

  router.get("/stores", merchant, async (request, response) => {
    const id = merchantId(request.merchant?.userId);
    response.json({ stores: await tenants.listStores(id) });
  });

  router.post("/stores", merchant, async (request, response) => {
    const id = merchantId(request.merchant?.userId);
    const input = createStoreSchema.parse(request.body);
    if (onboarding) {
      const ownsStore = (await tenants.listStores(id)).some(store => store.role === "OWNER");
      if (!ownsStore && request.merchant?.emailVerified === false) {
        throw new ApiError(403, "EMAIL_UNVERIFIED", "Confirm your email before creating a store.");
      }
      await onboarding.assertStoreCreationConsent(id, ownsStore);
    }
    response.status(201).json({ store: await tenants.createStore(id, input) });
  });

  return router;
}
