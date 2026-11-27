/**
 * Every billing number in one place (docs/plans/2026-11-25-billing-trial-limits.md). Change a value here, update its
 * test, and the server enforces it everywhere: uploads, products, rate limits, trial length, prices shown.
 *
 * Prices must match the Stripe prices set in STRIPE_BILLING_PRICE_ID / STRIPE_BILLING_ANNUAL_PRICE_ID, and the
 * frontend copy in jellyshops/src/features/billing/billing-summary.ts (PLAN_PRICES).
 */

const MB = 1024 ** 2;
const GB = 1024 ** 3;

export const BILLING_CONFIG = {
  /** Free trial from the moment a store is created. */
  trialDays: 14,
  /** Days a shop stays open after a failed payment before it closes (step 2). */
  graceDays: 7,
  /** Days a closed shop's data is kept before it is listed for (manual) deletion (step 5). */
  retentionDays: 90,
  /** The owner is warned this many days before the deletion date, and no shop is due for deletion sooner (step 5). */
  retentionWarningDays: 14,
  /** Trial days on which the owner is reminded; the expiry day itself is always reminded too (step 2). */
  reminderDays: [10, 13],
  prices: { currency: "GBP", monthMinor: 1500, yearMinor: 15000 },
} as const;

/** Totals a store may hold (counted from the database). */
export interface PlanLimits {
  /** Products that are not archived (drafts count). */
  products: number;
  /** Bytes of stored photos (the processed originals). */
  photoBytes: number;
  /** Uploaded files (Media rows). */
  files: number;
  /** People with access to the store, the owner included (checked once inviting staff exists). */
  staff: number;
  /** Own domains (checked once custom domains exist). */
  customDomains: number;
  /** Information pages that are not archived (drafts count). */
  pages: number;
  /** Blog posts that are not archived (drafts count). */
  articles: number;
  /** Discounts, whatever their state (deleting one makes room). */
  discounts: number;
}

/** Rules for each upload request (not totals). */
export interface UploadRules {
  /** Largest single file accepted, in bytes. */
  fileBytes: number;
  /** Uploads per minute for one store, across all its people. */
  uploadsPerMinute: number;
}

export interface PlanConfig {
  name: string;
  limits: PlanLimits;
  uploads: UploadRules;
}

export const PLAN_CONFIG = {
  /** A store in its free trial: enough to build and try a shop, not enough to use it as free hosting. */
  trial: {
    name: "Free trial",
    limits: { products: 50, photoBytes: 500 * MB, files: 200, staff: 3, customDomains: 1, pages: 20, articles: 50, discounts: 20 },
    uploads: { fileBytes: 5 * MB, uploadsPerMinute: 10 },
  },
  standard: {
    name: "Jellyshop",
    limits: { products: 5_000, photoBytes: 10 * GB, files: 5_000, staff: 3, customDomains: 1, pages: 500, articles: 5_000, discounts: 1_000 },
    uploads: { fileBytes: 10 * MB, uploadsPerMinute: 30 },
  },
} as const satisfies Record<string, PlanConfig>;

/** Extra room for the multipart wrapping around a file when comparing Content-Length with the file limit. */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/**
 * Changes (POST/PUT/PATCH/DELETE) to one shop's data, counted after sign-in, so a stranger can never use up a shop's
 * allowance. Per person across all their shops, and per shop across all its staff. High enough for bulk edit, which
 * saves one product at a time. Counted in memory per server instance (up to 5), like the other limiters.
 */
export const WRITE_LIMITS = {
  windowMs: 60_000,
  perUser: 300,
  perStore: 600,
} as const;
