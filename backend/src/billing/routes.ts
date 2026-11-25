import { Router } from "express";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import type { PlanLimitChecker } from "./plan-limits.js";
import { PLANS, type LimitKind } from "./plans.js";
import type { StoreBillingService } from "./store-billing.js";
import type { StripeBillingService } from "./stripe-billing.js";

/** What the Billing page and the admin banners show. Staff and domain limits come once those features exist. */
const SHOWN_LIMITS: LimitKind[] = ["products", "photoBytes", "files"];

/**
 * `GET /api/stores/:storeId/billing`: the shop's plan, trial or renewal, whether it is paused, and its usage against
 * the plan limits. Read only; paying and changing plans arrive with Stripe Billing (step 4d). Owners and anyone who
 * manages settings may read it.
 */
export function createBillingRouter(
  billing: Pick<StoreBillingService, "state">,
  limits: Pick<PlanLimitChecker, "usage">,
  authProvider: AuthProvider,
  options: { enforced: boolean; stripe?: Pick<StripeBillingService, "startCheckout" | "openPortal" | "annualAvailable"> },
): Router {
  const router = Router({ mergeParams: true });
  router.get("/billing", requireMerchant(authProvider), requireStorePermission("settings:manage"), async (request, response, next) => {
    try {
      const storeId = request.storeContext!.storeId;
      const [state, ...usage] = await Promise.all([billing.state(storeId), ...SHOWN_LIMITS.map((kind) => limits.usage(storeId, kind))]);
      response.set("Cache-Control", "no-store").json({
        ...state,
        planName: PLANS[state.plan].name,
        exempt: state.status === "exempt",
        enforced: options.enforced,
        // Whether paying is set up on this server (Stripe Billing, step 4d).
        checkoutAvailable: Boolean(options.stripe),
        // Whether a yearly price can be chosen as well as monthly.
        annualAvailable: Boolean(options.stripe?.annualAvailable),
        usage: usage.map(({ kind, used, limit }) => ({ kind, used, limit })),
      });
    } catch (error) { next(error); }
  });
  // Start paying (Stripe Checkout) and manage billing (Stripe's portal). Owners and settings managers only.
  router.post("/billing/checkout", requireMerchant(authProvider), requireStorePermission("settings:manage"), async (request, response, next) => {
    try {
      if (!options.stripe) throw new ApiError(503, "BILLING_UNAVAILABLE", "Paying for a plan isn't available yet.");
      const body = (request.body ?? {}) as { returnUrl?: unknown; interval?: unknown };
      response.set("Cache-Control", "no-store").json(await options.stripe.startCheckout(request.storeContext!.storeId, { returnUrl: body.returnUrl, email: request.merchant?.email, interval: body.interval }));
    } catch (error) { next(error); }
  });
  router.post("/billing/portal", requireMerchant(authProvider), requireStorePermission("settings:manage"), async (request, response, next) => {
    try {
      if (!options.stripe) throw new ApiError(503, "BILLING_UNAVAILABLE", "Managing billing isn't available yet.");
      const body = (request.body ?? {}) as { returnUrl?: unknown };
      response.set("Cache-Control", "no-store").json(await options.stripe.openPortal(request.storeContext!.storeId, { returnUrl: body.returnUrl }));
    } catch (error) { next(error); }
  });
  return router;
}
