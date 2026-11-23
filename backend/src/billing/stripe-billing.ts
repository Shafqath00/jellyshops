import type Stripe from "stripe";
import { corsOriginMatchers } from "../app/cors-origins.js";
import { ApiError } from "../http/errors.js";
import { DEFAULT_PLAN } from "./plans.js";
import type { BillingStatus, StoreBillingService } from "./store-billing.js";

/**
 * Shops paying for Jellyshop with Stripe Billing (docs/plans/2026-11-23-phase-4-billing-and-limits.md, step 4d).
 *
 * - Paying starts in Stripe Checkout (subscription mode) and card changes, invoices and cancelling happen in Stripe's
 *   customer portal: no card form of ours.
 * - The shop is found by `jelly_store_id` in the subscription's metadata, which only this server sets.
 * - Webhooks never trust the event's copy: every handler reads the subscription from Stripe again and saves its
 *   current state, so repeated, late or out-of-order deliveries all end in the same place (no event table needed).
 */

/** The few Stripe calls billing makes (the real client fits; tests pass a stand-in). */
export interface BillingStripeClient {
  checkout: { sessions: { create(params: Stripe.Checkout.SessionCreateParams): Promise<{ url: string | null }> } };
  billingPortal: { sessions: { create(params: Stripe.BillingPortal.SessionCreateParams): Promise<{ url: string }> } };
  subscriptions: { retrieve(id: string): Promise<Stripe.Subscription> };
  webhooks: { constructEvent(payload: Buffer | string, signature: string, secret: string): Stripe.Event };
}

interface Sql {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

export const STORE_ID_METADATA = "jelly_store_id";
/** Stripe refuses a Checkout trial that ends less than 48 hours away; with less left the shop pays at once. */
const MIN_TRIAL_LEFT_MS = 49 * 60 * 60 * 1000;

/** Our status for a Stripe subscription status; null when it should not change anything (not started yet). */
export function statusForSubscription(status: Stripe.Subscription.Status): BillingStatus | null {
  switch (status) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due": return "past_due";
    // Stripe gave up retrying, or the merchant paused collection: the shop closes (once enforced).
    case "unpaid":
    case "paused": return "paused";
    case "canceled": return "canceled";
    // Not started yet (first payment pending or abandoned), or a status this code doesn't know.
    default: return null;
  }
}

const seconds = (value: number | null | undefined) => (typeof value === "number" ? new Date(value * 1000) : null);
const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : value?.id ?? null);

/** When the paid-for period ends: on the subscription items in current API versions, on the subscription in older. */
function periodEnd(subscription: Stripe.Subscription): Date | null {
  const fromItem = subscription.items?.data?.[0] as { current_period_end?: number } | undefined;
  const legacy = (subscription as unknown as { current_period_end?: number }).current_period_end;
  return seconds(fromItem?.current_period_end ?? legacy);
}

export interface SubscriptionChange {
  storeId: string;
  status: BillingStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
}

/** What a Stripe subscription means for the shop it belongs to; null for one that is not ours or not started. */
export function subscriptionChange(subscription: Stripe.Subscription): SubscriptionChange | null {
  const storeId = subscription.metadata?.[STORE_ID_METADATA];
  const status = statusForSubscription(subscription.status);
  if (!storeId || !status) return null;
  return {
    storeId,
    status,
    trialEndsAt: status === "trialing" ? seconds(subscription.trial_end) : null,
    // A cancelled subscription has ended: keep when. One set to cancel ends on its cancel date (current API versions and
    // Stripe's portal set `cancel_at`; older ones set `cancel_at_period_end`), so the shop stays open until then.
    currentPeriodEnd: status === "canceled"
      ? seconds(subscription.ended_at) ?? periodEnd(subscription)
      : seconds(subscription.cancel_at) ?? periodEnd(subscription),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end) || typeof subscription.cancel_at === "number",
    stripeCustomerId: idOf(subscription.customer),
    stripeSubscriptionId: subscription.id,
  };
}

/**
 * Saves a subscription's state on its shop. Never touches an exempt shop, and an old subscription's late event never
 * replaces a newer one (only a live subscription may take over from another).
 */
export async function saveSubscriptionChange(sql: Sql, change: SubscriptionChange): Promise<void> {
  await sql.query(
    `INSERT INTO "StoreBilling" ("storeId", "plan", "status", "trialEndsAt", "currentPeriodEnd", "cancelAtPeriodEnd", "stripeCustomerId", "stripeSubscriptionId", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT ("storeId") DO UPDATE SET
       "status" = EXCLUDED."status", "trialEndsAt" = EXCLUDED."trialEndsAt", "currentPeriodEnd" = EXCLUDED."currentPeriodEnd",
       "cancelAtPeriodEnd" = EXCLUDED."cancelAtPeriodEnd", "stripeCustomerId" = COALESCE(EXCLUDED."stripeCustomerId", "StoreBilling"."stripeCustomerId"),
       "stripeSubscriptionId" = EXCLUDED."stripeSubscriptionId", "updatedAt" = NOW()
     WHERE "StoreBilling"."status" <> 'exempt'
       AND ("StoreBilling"."stripeSubscriptionId" IS NULL OR "StoreBilling"."stripeSubscriptionId" = EXCLUDED."stripeSubscriptionId"
            OR EXCLUDED."status" IN ('active', 'trialing', 'past_due'))`,
    [change.storeId, DEFAULT_PLAN, change.status, change.trialEndsAt, change.currentPeriodEnd, change.cancelAtPeriodEnd, change.stripeCustomerId, change.stripeSubscriptionId],
  );
}

/**
 * Only addresses of our own admin may be used to come back from Stripe (the allowed CORS origins, admin paths), so
 * the checkout can't be used to send a merchant somewhere else.
 */
export function checkReturnUrl(value: unknown, allowedOrigins: string[]): string {
  if (typeof value !== "string" || value.length > 500) throw new ApiError(400, "BILLING_RETURN_INVALID", "This page can't start a payment.");
  let url: URL;
  try { url = new URL(value); } catch { throw new ApiError(400, "BILLING_RETURN_INVALID", "This page can't start a payment."); }
  const allowed = corsOriginMatchers(allowedOrigins.filter((origin) => origin !== "*"))
    .some((matcher) => (typeof matcher === "string" ? matcher === url.origin : matcher.test(url.origin)));
  const adminPath = url.pathname === "/admin" || url.pathname.startsWith("/admin/") || url.pathname.startsWith("/s/");
  if (!allowed || !adminPath || url.username || url.password) throw new ApiError(400, "BILLING_RETURN_INVALID", "This page can't start a payment.");
  url.search = "";
  url.hash = "";
  return url.toString();
}

export class StripeBillingService {
  constructor(
    private readonly stripe: BillingStripeClient,
    private readonly sql: Sql,
    private readonly billing: Pick<StoreBillingService, "record">,
    private readonly options: { priceId: string; webhookSecret: string; allowedOrigins: string[]; now?: () => Date },
  ) {}

  private now() { return this.options.now?.() ?? new Date(); }

  /** A Stripe Checkout page where the shop starts paying; its free trial carries over while 2+ days are left. */
  async startCheckout(storeId: string, input: { returnUrl: unknown; email?: string }): Promise<{ url: string }> {
    const returnUrl = checkReturnUrl(input.returnUrl, this.options.allowedOrigins);
    const record = await this.billing.record(storeId);
    if (record?.status === "exempt") throw new ApiError(409, "BILLING_EXEMPT", "This shop isn't charged, so there's nothing to pay.");
    if (record?.stripeSubscriptionId && record.status !== "canceled") {
      throw new ApiError(409, "BILLING_ALREADY_SUBSCRIBED", "This shop already has a plan. Use Manage billing to change it.");
    }
    const trialEnd = record?.status === "trialing" && record.trialEndsAt && record.trialEndsAt.getTime() - this.now().getTime() > MIN_TRIAL_LEFT_MS
      ? Math.floor(record.trialEndsAt.getTime() / 1000) : undefined;
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: this.options.priceId, quantity: 1 }],
      client_reference_id: storeId,
      metadata: { [STORE_ID_METADATA]: storeId },
      subscription_data: { metadata: { [STORE_ID_METADATA]: storeId }, ...(trialEnd ? { trial_end: trialEnd } : {}) },
      ...(record?.stripeCustomerId ? { customer: record.stripeCustomerId } : input.email ? { customer_email: input.email } : {}),
      success_url: `${returnUrl}?billing=done`,
      cancel_url: returnUrl,
    });
    if (!session.url) throw new ApiError(502, "BILLING_UNAVAILABLE", "Payments are not available right now. Try again in a moment.");
    return { url: session.url };
  }

  /** Stripe's customer portal: change card, see invoices, cancel. */
  async openPortal(storeId: string, input: { returnUrl: unknown }): Promise<{ url: string }> {
    const returnUrl = checkReturnUrl(input.returnUrl, this.options.allowedOrigins);
    const record = await this.billing.record(storeId);
    if (!record?.stripeCustomerId) throw new ApiError(409, "BILLING_NO_CUSTOMER", "Choose a plan first; then you can manage billing here.");
    const session = await this.stripe.billingPortal.sessions.create({ customer: record.stripeCustomerId, return_url: returnUrl });
    return { url: session.url };
  }

  /** Checks the signature and turns the request into a Stripe event (throws on anything not signed by Stripe). */
  constructEvent(payload: Buffer | string, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, this.options.webhookSecret);
  }

  /** Applies one billing event. Returns what happened, for the log and tests. */
  async handleEvent(event: Stripe.Event): Promise<"saved" | "ignored"> {
    let subscriptionId: string | null = null;
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") return "ignored";
        subscriptionId = idOf(session.subscription);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        subscriptionId = (event.data.object as Stripe.Subscription).id;
        break;
      default:
        return "ignored";
    }
    if (!subscriptionId) return "ignored";
    // Always Stripe's current state, never the event's (possibly old) copy.
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const change = subscriptionChange(subscription);
    if (!change) return "ignored";
    try {
      await saveSubscriptionChange(this.sql, change);
    } catch (error) {
      // The shop was deleted since: nothing to update.
      if ((error as { code?: string })?.code === "23503") return "ignored";
      throw error;
    }
    return "saved";
  }
}
