import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config.js";
import { createStripeGateway } from "./client.js";

function setup() {
  const config = loadConfig({ NODE_ENV: "test",
    STRIPE_SECRET_KEY: `rk_test_${randomBytes(24).toString("hex")}`,
    STRIPE_ACCOUNTS_V2_VERSION: "2026-08-26.dahlia",
    STRIPE_CARD_PAYMENT_METHOD_CONFIGURATION_ID: "pmc_cards",
    STRIPE_ACCOUNTS_V2_WEBHOOK_SECRET: randomBytes(24).toString("hex"),
    STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET: randomBytes(24).toString("hex"),
    SCHEDULER_SECRET: randomBytes(32).toString("hex"),
  });
  const requests: { url: string; headers: Headers; body: string }[] = [];
  const fetchMock = async (url: string, init: RequestInit) => {
    requests.push({ url, headers: new Headers(init.headers), body: String(init.body ?? "") });
    return new Response(JSON.stringify({ id: "result_from_transport" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  };
  const gateway = createStripeGateway(config, (key, options) => new Stripe(key, {
    ...options, httpClient: Stripe.createFetchHttpClient(fetchMock),
  }));
  return { config, gateway, requests };
}
const context = { connectedAccountId: "acct_merchant", idempotencyKey: "persisted-attempt-key" };
afterEach(() => vi.unstubAllGlobals());

describe("Stripe server gateway", () => {
  it("creates only the frozen Accounts v2 model on the pinned API", async () => {
    const { gateway, requests } = setup();
    await gateway.createAccountV2({ storeId: "store-1", contactEmail: "merchant@example.test",
      displayName: "Shop", country: "US" }, "persisted-account-key");
    expect(requests[0].url).toContain("/v2/core/accounts");
    expect(requests[0].headers.get("stripe-version")).toBe("2026-08-26.dahlia");
    expect(requests[0].headers.get("idempotency-key")).toBe("persisted-account-key");
    expect(JSON.parse(requests[0].body)).toEqual({
      contact_email: "merchant@example.test", display_name: "Shop", identity: { country: "US" },
      dashboard: "full", defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
      configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
      metadata: { jelly_store_id: "store-1" },
    });
  });

  it("uses v2 account links and includes readiness and requirements when retrieving state", async () => {
    const { gateway, requests } = setup();
    await gateway.createAccountLink({ connectedAccountId: "acct_merchant",
      returnUrl: "https://shop.example.test/return", refreshUrl: "https://shop.example.test/refresh" }, "link-key");
    expect(requests[0].url).toContain("/v2/core/account_links");
    expect(JSON.parse(requests[0].body)).toEqual({ account: "acct_merchant", use_case: {
      type: "account_onboarding", account_onboarding: { configurations: ["merchant"],
        return_url: "https://shop.example.test/return", refresh_url: "https://shop.example.test/refresh" },
    } });
    await gateway.retrieveAccountV2("acct_merchant");
    expect(requests[1].url).toContain("/v2/core/accounts/acct_merchant");
    const include = [...new URL(requests[1].url).searchParams.entries()]
      .filter(([name]) => /^include\[\d+\]$/.test(name)).map(([, value]) => value);
    expect(include).toEqual(expect.arrayContaining(["configuration.merchant", "requirements", "future_requirements"]));
  });

  it("sends direct charges in merchant context with persisted idempotency, metadata, and card configuration", async () => {
    const { gateway, requests } = setup();
    await gateway.createDirectPaymentIntent({ amount: 1299, currency: "usd", orderId: "order-1",
      checkoutAttemptId: "attempt-1" }, context);
    expect(requests[0].url).toContain("/v1/payment_intents");
    expect(requests[0].headers.get("stripe-account")).toBe("acct_merchant");
    expect(requests[0].headers.get("idempotency-key")).toBe("persisted-attempt-key");
    expect(Object.fromEntries(new URLSearchParams(requests[0].body))).toEqual({
      amount: "1299", currency: "usd", payment_method_configuration: "pmc_cards",
      "metadata[jelly_order_id]": "order-1", "metadata[jelly_checkout_attempt_id]": "attempt-1",
    });
  });

  it("preserves connected-account context and separate durable keys for cancel and full refund", async () => {
    const { gateway, requests } = setup();
    await gateway.cancelPaymentIntent("pi_order", { ...context, idempotencyKey: "cancel-key" });
    await gateway.createFullRefund({ paymentIntentId: "pi_order", orderId: "order-1", refundId: "refund-1" },
      { ...context, idempotencyKey: "refund-key" });
    expect(requests[0].url).toContain("/v1/payment_intents/pi_order/cancel");
    expect(requests[0].headers.get("idempotency-key")).toBe("cancel-key");
    expect(requests[1].url).toContain("/v1/refunds");
    expect(requests[1].headers.get("idempotency-key")).toBe("refund-key");
    for (const request of requests) expect(request.headers.get("stripe-account")).toBe("acct_merchant");
    expect(Object.fromEntries(new URLSearchParams(requests[1].body))).toEqual({
      payment_intent: "pi_order", "metadata[jelly_order_id]": "order-1", "metadata[jelly_refund_id]": "refund-1",
    });
  });

  it("fails closed without connected-account context or a durable key", async () => {
    const { gateway, requests } = setup();
    for (const invalidContext of [{ ...context, connectedAccountId: "" }, { ...context, idempotencyKey: "" }]) {
      expect(() => gateway.createDirectPaymentIntent({ amount: 1299, currency: "usd", orderId: "order-1", checkoutAttemptId: "attempt-1" }, invalidContext)).toThrow();
      expect(() => gateway.cancelPaymentIntent("pi_order", invalidContext)).toThrow();
      expect(() => gateway.createFullRefund({ paymentIntentId: "pi_order", orderId: "order-1", refundId: "refund-1" }, invalidContext)).toThrow();
    }
    expect(requests).toHaveLength(0);
  });

  it("verifies raw thin and snapshot payloads with separate destination secrets", () => {
    const { gateway, config } = setup();
    const thin = JSON.stringify({ id: "evt_thin", object: "v2.core.event", type: "v2.core.account.updated", created: "2026-09-16T00:00:00Z",
      livemode: false, related_object: { id: "acct_merchant", type: "v2.core.account", url: "/v2/core/accounts/acct_merchant" } });
    const snapshot = JSON.stringify({ id: "evt_snapshot", object: "event", type: "payment_intent.succeeded",
      account: "acct_merchant", data: { object: { id: "pi_order" } } });
    const thinHeader = Stripe.webhooks.generateTestHeaderString({ payload: thin, secret: config.stripe!.accountsV2WebhookSecret });
    const paymentHeader = Stripe.webhooks.generateTestHeaderString({ payload: snapshot, secret: config.stripe!.connectPaymentsWebhookSecret });
    expect(gateway.constructEvent("accounts-v2", Buffer.from(thin), thinHeader).id).toBe("evt_thin");
    expect(gateway.constructEvent("connect-payments", Buffer.from(snapshot), paymentHeader).account).toBe("acct_merchant");
    expect(() => gateway.constructEvent("connect-payments", Buffer.from(thin), thinHeader)).toThrow();
    expect(() => gateway.constructEvent("accounts-v2", Buffer.from(snapshot), paymentHeader)).toThrow();
    expect(() => gateway.constructEvent("accounts-v2", Buffer.from(`${thin} `), thinHeader)).toThrow();
  });

  it("does not expose the SDK or credentials on the gateway and refuses browser construction", () => {
    const { gateway, config } = setup();
    expect(JSON.stringify(gateway)).toBe("{}");
    expect(() => createStripeGateway(loadConfig({ NODE_ENV: "test" }))).toThrow("configured");
    vi.stubGlobal("window", {});
    expect(() => createStripeGateway(config)).toThrow("server");
  });
});
