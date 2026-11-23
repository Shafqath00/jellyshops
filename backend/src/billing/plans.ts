/**
 * Jellyshop plans and what each one allows (docs/plans/2026-11-23-phase-4-billing-and-limits.md).
 *
 * Plans live in code, not a table: changing a limit is a reviewed change with a test. Until stores carry their own
 * plan (step 4b, table `StoreBilling`), every store is on the default plan below.
 */
export type PlanId = "standard";

export interface PlanLimits {
  /** Products that are not archived (drafts count). */
  products: number;
  /** Bytes of stored photos (the processed originals; the smaller copies are covered by the price). */
  photoBytes: number;
  /** People with access to the store, the owner included (checked once inviting staff exists). */
  staff: number;
  /** Own domains such as www.myshop.co.uk (checked once custom domains exist). */
  customDomains: number;
}

export type LimitKind = keyof PlanLimits;

export interface Plan {
  id: PlanId;
  name: string;
  limits: PlanLimits;
}

const GB = 1024 ** 3;

export const PLANS: Record<PlanId, Plan> = {
  standard: {
    id: "standard",
    name: "Jellyshop",
    limits: { products: 5_000, photoBytes: 10 * GB, staff: 3, customDomains: 1 },
  },
};

export const DEFAULT_PLAN: PlanId = "standard";
