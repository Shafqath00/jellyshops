import express from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import type { StripeAccountService } from "./service.js";

const onboardingBodySchema = z.object({
  returnUrl: z.string().url("returnUrl must be an absolute URL"),
  refreshUrl: z.string().url("refreshUrl must be an absolute URL"),
}).strict();

export function createStripeConnectRouter(
  service: StripeAccountService,
  authProvider: AuthProvider,
): express.Router {
  const router = express.Router({ mergeParams: true });

  router.use(requireMerchant(authProvider));

  /**
   * GET /api/stores/:storeId/stripe-connect/status
   * Requires payments:view.
   * Returns a redacted StripeAccountStatusDto — no Stripe secrets.
   */
  router.get(
    "/status",
    requireStorePermission("payments:view"),
    async (request, response, next) => {
      try {
        const storeId = request.storeContext!.storeId;
        const status = await service.getStatus(storeId);
        response.json(status);
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/stores/:storeId/stripe-connect/onboarding-link
   * Requires payments:manage.
   * Body: { returnUrl, refreshUrl } — must be absolute URLs, validated server-side.
   * Returns: { url } — single-use Stripe-hosted Account Link URL. Not persisted.
   */
  router.post(
    "/onboarding-link",
    requireStorePermission("payments:manage"),
    async (request, response, next) => {
      try {
        const storeId = request.storeContext!.storeId;
        const body = onboardingBodySchema.parse(request.body);

        // Store metadata (displayName, country) would come from the TenantRepository.
        // As there is no concrete TenantRepository implementation available in Task 3,
        // we use safe placeholder values that allow account creation while keeping
        // the boundary explicit. The store-editor already shows name in the UI.
        // Task 10 wires real store metadata when the merchant panel is built.
        const displayName = String(request.body?.displayName ?? "").trim() || "Jelly Shop Store";
        const country = String(request.body?.country ?? "").trim() || "US";

        const link = await service.createOnboardingLink({
          storeId,
          displayName,
          country,
          returnUrl: body.returnUrl,
          refreshUrl: body.refreshUrl,
        });

        response.status(201).json(link);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
