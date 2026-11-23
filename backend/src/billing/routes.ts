import { Router } from "express";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import type { PlanLimitChecker } from "./plan-limits.js";
import { PLANS, type LimitKind } from "./plans.js";
import type { StoreBillingService } from "./store-billing.js";

/** What the Billing page and the admin banners show. Staff and domain limits come once those features exist. */
const SHOWN_LIMITS: LimitKind[] = ["products", "photoBytes"];

/**
 * `GET /api/stores/:storeId/billing`: the shop's plan, trial or renewal, whether it is paused, and its usage against
 * the plan limits. Read only; paying and changing plans arrive with Stripe Billing (step 4d). Owners and anyone who
 * manages settings may read it.
 */
export function createBillingRouter(
  billing: Pick<StoreBillingService, "state">,
  limits: Pick<PlanLimitChecker, "usage">,
  authProvider: AuthProvider,
  options: { enforced: boolean },
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
        usage: usage.map(({ kind, used, limit }) => ({ kind, used, limit })),
      });
    } catch (error) { next(error); }
  });
  return router;
}
