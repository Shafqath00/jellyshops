import express from "express";
import Stripe from "stripe";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createBillingWebhookRouter } from "./billing-webhook-route.js";
import type { StoreBillingRecord } from "./store-billing.js";
import { checkReturnUrl, StripeBillingService, statusForSubscription, subscriptionChange, type BillingStripeClient } from "./stripe-billing.js";

const now = new Date("2026-12-01T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (date: Date) => Math.floor(date.getTime() / 1000);
const ORIGINS = ["http://localhost:3210", "https://*.jellyshop.io"];
const realStripe = new Stripe("sk_test_dummy");
const SECRET = "whsec_test_billing";

const subscription = (over: Partial<Stripe.Subscription> = {}): Stripe.Subscription => ({
  id: "sub_1", status: "active", metadata: { jelly_store_id: "store-a" }, customer: "cus_1", cancel_at_period_end: false,
  trial_end: null, ended_at: null, items: { data: [{ current_period_end: at(new Date(now.getTime() + 30 * DAY)) }] },
  ...over,
} as unknown as Stripe.Subscription);

function setup(record: Partial<StoreBillingRecord> | null = { status: "trialing", trialEndsAt: new Date(now.getTime() + 10 * DAY) }, live = subscription()) {
  const stripe = {
    checkout: { sessions: { create: vi.fn(async () => ({ url: "https://checkout.stripe.com/c/pay/cs_1" })) } },
    billingPortal: { sessions: { create: vi.fn(async () => ({ url: "https://billing.stripe.com/p/session/1" })) } },
    subscriptions: { retrieve: vi.fn(async () => live) },
    webhooks: realStripe.webhooks,
  } satisfies BillingStripeClient;
  const query = vi.fn(async () => ({ rows: [] }));
  const full = record ? { storeId: "store-a", plan: "standard", trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, ...record } as StoreBillingRecord : null;
  const service = new StripeBillingService(stripe, { query }, { record: async () => full }, { priceId: "price_123", webhookSecret: SECRET, allowedOrigins: ORIGINS, now: () => now });
  return { stripe, query, service };
}

describe("Stripe subscription states", () => {
  it("map to the shop's billing status; ones that haven't started change nothing", () => {
    expect(statusForSubscription("trialing")).toBe("trialing");
    expect(statusForSubscription("active")).toBe("active");
    expect(statusForSubscription("past_due")).toBe("past_due");
    expect(statusForSubscription("unpaid")).toBe("paused");
    expect(statusForSubscription("canceled")).toBe("canceled");
    expect(statusForSubscription("incomplete")).toBeNull();
    expect(statusForSubscription("incomplete_expired")).toBeNull();
  });

  it("read the shop from metadata, the period end from the items, and when a cancelled plan ended", () => {
    expect(subscriptionChange(subscription())).toMatchObject({ storeId: "store-a", status: "active", currentPeriodEnd: new Date(now.getTime() + 30 * DAY), stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", trialEndsAt: null });
    expect(subscriptionChange(subscription({ status: "trialing", trial_end: at(new Date(now.getTime() + 5 * DAY)) }))?.trialEndsAt).toEqual(new Date(now.getTime() + 5 * DAY));
    expect(subscriptionChange(subscription({ status: "canceled", ended_at: at(now) }))?.currentPeriodEnd).toEqual(now);
    expect(subscriptionChange(subscription({ metadata: {} }))).toBeNull();
  });
});

describe("coming back from Stripe", () => {
  it("only goes to our own admin pages", () => {
    expect(checkReturnUrl("http://localhost:3210/admin/s/shop/settings/billing?x=1#top", ORIGINS)).toBe("http://localhost:3210/admin/s/shop/settings/billing");
    expect(checkReturnUrl("https://admin.jellyshop.io/s/shop/settings/billing", ORIGINS)).toBe("https://admin.jellyshop.io/s/shop/settings/billing");
    for (const bad of ["https://evil.example/admin", "http://localhost:3210/checkout", "http://user:pw@localhost:3210/admin", "javascript:alert(1)", 42, "not a url"]) {
      expect(() => checkReturnUrl(bad, ORIGINS), String(bad)).toThrow("This page can't start a payment.");
    }
  });
});

describe("starting to pay", () => {
  it("opens Checkout for the plan's price, carries the shop on the subscription and keeps the trial", async () => {
    const { service, stripe } = setup();
    expect(await service.startCheckout("store-a", { returnUrl: "http://localhost:3210/admin/s/shop/settings/billing", email: "owner@example.test" })).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_1" });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription", line_items: [{ price: "price_123", quantity: 1 }], client_reference_id: "store-a", customer_email: "owner@example.test",
      subscription_data: { metadata: { jelly_store_id: "store-a" }, trial_end: at(new Date(now.getTime() + 10 * DAY)) },
      success_url: "http://localhost:3210/admin/s/shop/settings/billing?billing=done", cancel_url: "http://localhost:3210/admin/s/shop/settings/billing",
    }));
  });

  it("charges at once when under two days of trial are left, and reuses the shop's Stripe customer", async () => {
    const { service, stripe } = setup({ status: "trialing", trialEndsAt: new Date(now.getTime() + DAY), stripeCustomerId: "cus_9" });
    await service.startCheckout("store-a", { returnUrl: "http://localhost:3210/admin", email: "owner@example.test" });
    const params = stripe.checkout.sessions.create.mock.calls[0]![0] as Stripe.Checkout.SessionCreateParams;
    expect(params.subscription_data).toEqual({ metadata: { jelly_store_id: "store-a" } });
    expect(params.customer).toBe("cus_9");
    expect(params.customer_email).toBeUndefined();
  });

  it("refuses an exempt shop and one that already has a plan", async () => {
    await expect(setup({ status: "exempt" }).service.startCheckout("store-a", { returnUrl: "http://localhost:3210/admin" })).rejects.toMatchObject({ code: "BILLING_EXEMPT" });
    await expect(setup({ status: "active", stripeSubscriptionId: "sub_1" }).service.startCheckout("store-a", { returnUrl: "http://localhost:3210/admin" })).rejects.toMatchObject({ code: "BILLING_ALREADY_SUBSCRIBED" });
    // A cancelled plan may be started again.
    await expect(setup({ status: "canceled", stripeSubscriptionId: "sub_1" }).service.startCheckout("store-a", { returnUrl: "http://localhost:3210/admin" })).resolves.toBeTruthy();
  });

  it("opens the portal only for a shop with a Stripe customer", async () => {
    const { service, stripe } = setup({ status: "active", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });
    expect(await service.openPortal("store-a", { returnUrl: "http://localhost:3210/admin" })).toEqual({ url: "https://billing.stripe.com/p/session/1" });
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({ customer: "cus_1", return_url: "http://localhost:3210/admin" });
    await expect(setup().service.openPortal("store-a", { returnUrl: "http://localhost:3210/admin" })).rejects.toMatchObject({ code: "BILLING_NO_CUSTOMER" });
  });
});

describe("billing events", () => {
  const event = (type: string, object: Record<string, unknown>) => ({ id: "evt_1", type, data: { object } }) as unknown as Stripe.Event;

  it("save Stripe's current subscription, not the event's copy", async () => {
    const { service, stripe, query } = setup(null, subscription({ status: "past_due" }));
    expect(await service.handleEvent(event("customer.subscription.updated", { id: "sub_1", status: "active" }))).toBe("saved");
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
    expect(query).toHaveBeenCalledWith(expect.stringContaining(`INSERT INTO "StoreBilling"`), ["store-a", "standard", "past_due", null, expect.any(Date), false, "cus_1", "sub_1"]);
  });

  it("follow a completed checkout to its subscription, and ignore everything else", async () => {
    const { service, stripe } = setup(null);
    expect(await service.handleEvent(event("checkout.session.completed", { mode: "subscription", subscription: "sub_1" }))).toBe("saved");
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
    expect(await service.handleEvent(event("checkout.session.completed", { mode: "payment" }))).toBe("ignored");
    expect(await service.handleEvent(event("invoice.paid", {}))).toBe("ignored");
  });

  it("ignore a subscription that isn't ours or a shop that was deleted", async () => {
    expect(await setup(null, subscription({ metadata: {} })).service.handleEvent(event("customer.subscription.updated", { id: "sub_1" }))).toBe("ignored");
    const gone = setup(null);
    gone.query.mockRejectedValueOnce(Object.assign(new Error("fk"), { code: "23503" }));
    expect(await gone.service.handleEvent(event("customer.subscription.updated", { id: "sub_1" }))).toBe("ignored");
  });
});

describe("POST /webhooks/stripe/billing", () => {
  const app = (service: ReturnType<typeof setup>["service"]) => express().use("/webhooks/stripe/billing", createBillingWebhookRouter(service));
  const payload = JSON.stringify({ id: "evt_1", object: "event", type: "customer.subscription.updated", data: { object: { id: "sub_1", metadata: { jelly_store_id: "store-a" } } } });

  it("accepts an event signed with the billing secret", async () => {
    const { service, query } = setup(null);
    const signature = realStripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const response = await request(app(service)).post("/webhooks/stripe/billing").set("content-type", "application/json").set("stripe-signature", signature).send(payload);
    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalled();
  });

  it("refuses unsigned and wrongly signed requests without touching anything", async () => {
    const { service, query } = setup(null);
    expect((await request(app(service)).post("/webhooks/stripe/billing").set("content-type", "application/json").send(payload)).status).toBe(400);
    const forged = realStripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_someone_else" });
    expect((await request(app(service)).post("/webhooks/stripe/billing").set("content-type", "application/json").set("stripe-signature", forged).send(payload)).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it("answers 500 when saving fails, so Stripe tries again", async () => {
    const { service, query } = setup(null);
    query.mockRejectedValueOnce(new Error("database down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const signature = realStripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    expect((await request(app(service)).post("/webhooks/stripe/billing").set("content-type", "application/json").set("stripe-signature", signature).send(payload)).status).toBe(500);
  });
});
