/**
 * Jellyshop plans and what each one allows. The numbers live in `limits-config.ts`
 * (docs/plans/2026-11-25-billing-trial-limits.md); this file gives them names and types.
 *
 * `trial` is not something a store chooses: a store whose billing status is `trialing` is limited by it, and moves
 * to `standard` once it pays.
 */
import { PLAN_CONFIG, type PlanLimits, type UploadRules } from "./limits-config.js";

export type { PlanLimits, UploadRules } from "./limits-config.js";

export type PlanId = keyof typeof PLAN_CONFIG;

export type LimitKind = keyof PlanLimits;

export interface Plan {
  id: PlanId;
  name: string;
  limits: PlanLimits;
  uploads: UploadRules;
}

export const PLANS: Record<PlanId, Plan> = {
  trial: { id: "trial", ...PLAN_CONFIG.trial },
  standard: { id: "standard", ...PLAN_CONFIG.standard },
};

/** The plan a store pays for (its billing row's `plan`). */
export const DEFAULT_PLAN: PlanId = "standard";
