import type { RequestHandler } from "express";
import { ApiError } from "../http/errors.js";
import { BILLING_CONFIG } from "./limits-config.js";
import { DEFAULT_PLAN, PLANS, type PlanId } from "./plans.js";
import type { PlanResolver } from "./plan-limits.js";

/**
 * A shop's billing state (table "StoreBilling", migration 20261123000000_store_billing.sql;
 * docs/plans/2026-11-23-phase-4-billing-and-limits.md).
 *
 * Rules:
 * - No row (or no table yet): the default plan, never paused. Shops keep working before the migration runs.
 * - `exempt`: never limited, never charged, never paused (every shop that existed when billing arrived).
 * - A trial that has ended without a subscription, a subscription that was cancelled and has run out, and `paused`
 *   all count as paused; `past_due` is not paused yet (Stripe is still retrying the payment).
 * - Pausing only takes effect when BILLING_ENFORCED is on (step 4d, once shops can pay). Until then the state is
 *   recorded and shown, but no shop is closed.
 * - Paused closes the storefront and checkout. The admin stays open, so the merchant can keep working and pay.
 */
export type BillingStatus = "trialing" | "active" | "past_due" | "paused" | "canceled" | "exempt";

export const TRIAL_DAYS = BILLING_CONFIG.trialDays;

export interface StoreBillingRecord {
  storeId: string;
  plan: string;
  status: BillingStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** Set once the shop has started paying through Stripe Billing (step 4d). */
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

export type PauseReason = "trial-ended" | "payment-stopped" | "canceled";

export interface BillingState {
  /** The stored status, or "none" when the shop has no billing row. */
  status: BillingStatus | "none";
  plan: PlanId;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** Whether the shop has a Stripe subscription it can manage (change card, cancel, invoices). */
  hasSubscription: boolean;
  /** Why the shop would be paused; null when it is in good standing. */
  pauseReason: PauseReason | null;
  /** Whether the shop is closed right now (pauseReason set and BILLING_ENFORCED on). */
  paused: boolean;
}

interface Sql {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

const knownPlan = (plan: string | undefined): PlanId => (plan && plan in PLANS ? plan as PlanId : DEFAULT_PLAN);

/** Why a shop with this record is out of good standing at `now`, or null. Pure, so the rules are easy to test. */
export function pauseReason(record: StoreBillingRecord | null, now: Date): PauseReason | null {
  if (!record) return null;
  switch (record.status) {
    case "exempt":
    case "active":
    case "past_due":
      return null;
    case "trialing":
      return record.trialEndsAt && record.trialEndsAt.getTime() <= now.getTime() ? "trial-ended" : null;
    case "canceled":
      return record.currentPeriodEnd && record.currentPeriodEnd.getTime() > now.getTime() ? null : "canceled";
    case "paused":
      return "payment-stopped";
  }
}

export function billingState(record: StoreBillingRecord | null, now: Date, enforced: boolean): BillingState {
  const reason = pauseReason(record, now);
  return {
    status: record?.status ?? "none",
    plan: knownPlan(record?.plan),
    trialEndsAt: record?.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: record?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: record?.cancelAtPeriodEnd ?? false,
    hasSubscription: Boolean(record?.stripeSubscriptionId),
    pauseReason: reason,
    paused: enforced && reason !== null,
  };
}

/** Postgres "undefined table": the migration has not run yet. */
const missingTable = (error: unknown) => (error as { code?: string })?.code === "42P01";

/**
 * Starts the free trial for a new shop, inside the transaction that creates it. Checks the table exists first: a
 * failed statement would abort the whole store creation.
 */
export async function startTrial(sql: Sql, storeId: string, now: Date = new Date()): Promise<void> {
  const exists = await sql.query(`SELECT to_regclass('public."StoreBilling"')::text AS "table"`);
  if (!(exists.rows[0] as { table?: string | null } | undefined)?.table) return;
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  await sql.query(
    `INSERT INTO "StoreBilling" ("storeId", "plan", "status", "trialEndsAt") VALUES ($1, $2, 'trialing', $3) ON CONFLICT ("storeId") DO NOTHING`,
    [storeId, DEFAULT_PLAN, trialEndsAt],
  );
}

interface Row {
  storeId: string;
  plan: string;
  status: BillingStatus;
  trialEndsAt: Date | string | null;
  currentPeriodEnd: Date | string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

const asDate = (value: Date | string | null) => (value === null ? null : value instanceof Date ? value : new Date(value));

export class StoreBillingService {
  private tableMissing = false;

  constructor(
    private readonly sql: Sql,
    private readonly options: { enforced: boolean; now?: () => Date },
  ) {}

  private now() { return this.options.now?.() ?? new Date(); }

  async record(storeId: string): Promise<StoreBillingRecord | null> {
    if (this.tableMissing) return null;
    try {
      const result = await this.sql.query(
        `SELECT "storeId", "plan", "status", "trialEndsAt", "currentPeriodEnd", "cancelAtPeriodEnd", "stripeCustomerId", "stripeSubscriptionId" FROM "StoreBilling" WHERE "storeId" = $1`,
        [storeId],
      );
      const row = result.rows[0] as Row | undefined;
      return row ? { ...row, trialEndsAt: asDate(row.trialEndsAt), currentPeriodEnd: asDate(row.currentPeriodEnd) } : null;
    } catch (error) {
      // Before the migration: every shop is on the default plan. Remembered so we stop asking.
      if (missingTable(error)) { this.tableMissing = true; return null; }
      throw error;
    }
  }

  async state(storeId: string): Promise<BillingState> {
    return billingState(await this.record(storeId), this.now(), this.options.enforced);
  }

  /** Whether the shop's storefront and checkout are closed right now. */
  async isPaused(storeId: string): Promise<boolean> {
    if (!this.options.enforced) return false;
    return (await this.state(storeId)).paused;
  }

  /**
   * The plan used for limits: exempt shops are never limited; shops in their trial get the trial limits until they
   * subscribe (a shop that has added a card and subscribed keeps its trial days but gets the paid limits).
   */
  readonly planFor: PlanResolver = async (storeId) => {
    const record = await this.record(storeId);
    if (record?.status === "exempt") return "exempt";
    if (record?.status === "trialing" && !record.stripeSubscriptionId) return "trial";
    return knownPlan(record?.plan);
  };
}

/**
 * Refuses new orders in a paused shop (mounted in front of the public checkout). Reading a checkout or an order is
 * still allowed; only writes are refused.
 */
export function pausedShopCheckoutGuard(billing: Pick<StoreBillingService, "isPaused">): RequestHandler {
  return (request, _response, next) => {
    if (request.method === "GET" || request.method === "HEAD") { next(); return; }
    billing.isPaused(String(request.params.storeId))
      .then((paused) => next(paused ? new ApiError(403, "SHOP_PAUSED", "This shop isn't taking orders right now.") : undefined))
      // A failing billing lookup never closes a shop.
      .catch(() => next());
  };
}
