import express from "express";
import { z } from "zod";

import {
  requireMerchant,
  requireStorePermission,
} from "../../auth/middleware.js";
import type { AuthProvider } from "../../auth/types.js";
import type { StripeAccountService } from "./service.js";

/* -------------------------------------------------------------------------- */
/*                              Request Schemas                               */
/* -------------------------------------------------------------------------- */

/**
 * Request body accepted when creating a Stripe onboarding link.
 *
 * Both URLs must be absolute because Stripe redirects the merchant back to
 * these locations during and after the onboarding flow.
 *
 * `.strict()` intentionally rejects unexpected request fields.
 */
const onboardingBodySchema = z
  .object({
    returnUrl: z.string().url("returnUrl must be an absolute URL"),
    refreshUrl: z.string().url("refreshUrl must be an absolute URL"),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/*                              Default Metadata                              */
/* -------------------------------------------------------------------------- */

/**
 * Temporary fallback metadata used when creating a Stripe connected account.
 *
 * These values should eventually come from the store/tenant repository rather
 * than from the onboarding request.
 */
const DEFAULT_STORE_DISPLAY_NAME = "Jelly Shop Store";
const DEFAULT_STORE_COUNTRY = "US";

/* -------------------------------------------------------------------------- */
/*                               Route Factory                                */
/* -------------------------------------------------------------------------- */

/**
 * Creates the authenticated Stripe Connect routes for a store.
 *
 * All routes mounted on this router require a valid merchant session.
 * Individual endpoints additionally enforce the appropriate payments
 * permission.
 *
 * Expected mount point:
 *
 * `/api/stores/:storeId/stripe-connect`
 */
export function createStripeConnectRouter(
  service: StripeAccountService,
  authProvider: AuthProvider,
): express.Router {
  const router = express.Router({
    mergeParams: true,
  });

  /* ------------------------------------------------------------------------ */
  /*                            Merchant Authentication                       */
  /* ------------------------------------------------------------------------ */

  /**
   * Every Stripe Connect endpoint requires an authenticated merchant.
   *
   * `mergeParams: true` allows the router to access `:storeId` from the
   * parent route.
   */
  router.use(requireMerchant(authProvider));

  /* ------------------------------------------------------------------------ */
  /*                                  Status                                  */
  /* ------------------------------------------------------------------------ */

  /**
   * GET /api/stores/:storeId/stripe-connect/status
   *
   * Permission:
   * - payments:view
   *
   * Returns:
   * - Redacted Stripe account status.
   * - No Stripe secret keys or other sensitive credentials.
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

  /* ------------------------------------------------------------------------ */
  /*                            Stripe Onboarding                             */
  /* ------------------------------------------------------------------------ */

  /**
   * POST /api/stores/:storeId/stripe-connect/onboarding-link
   *
   * Permission:
   * - payments:manage
   *
   * Request body:
   * {
   *   returnUrl: string;
   *   refreshUrl: string;
   * }
   *
   * Both URLs must be absolute and are validated server-side.
   *
   * Returns:
   * {
   *   url: string;
   * }
   *
   * The returned Stripe Account Link is single-use and should not be
   * persisted by the application.
   */
  router.post(
    "/onboarding-link",
    requireStorePermission("payments:manage"),
    async (request, response, next) => {
      try {
        const storeId = request.storeContext!.storeId;
        const body = onboardingBodySchema.parse(request.body);

        /*
         * Store metadata such as display name and country should ultimately
         * come from TenantRepository or another trusted server-side store
         * source.
         *
         * Until that integration exists, fallback values are used so account
         * creation remains functional while keeping the boundary explicit.
         *
         * Note:
         * Because `onboardingBodySchema` is strict, displayName and country
         * cannot currently be supplied in the request body without causing
         * validation to fail.
         */
        const displayName =
          String(request.body?.displayName ?? "").trim() ||
          DEFAULT_STORE_DISPLAY_NAME;

        const country =
          String(request.body?.country ?? "").trim() ||
          DEFAULT_STORE_COUNTRY;

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