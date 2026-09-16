import Stripe from "stripe";
import type { AppConfig } from "../config.js";

export interface ConnectedAccountRequest {
  connectedAccountId: string;
  /** Must be persisted by the caller before initiating the external operation. */
  idempotencyKey: string;
}

export interface CreateAccountInput {
  storeId: string;
  /** Optional — only include when a trustworthy server-owned email is available. */
  contactEmail?: string;
  displayName: string;
  country: string;
}

export interface CreateAccountLinkInput {
  connectedAccountId: string;
  returnUrl: string;
  refreshUrl: string;
}

export interface CreateDirectPaymentIntentInput {
  amount: number;
  currency: string;
  orderId: string;
  checkoutAttemptId: string;
}

export interface CreateFullRefundInput {
  paymentIntentId: string;
  orderId: string;
  refundId: string;
}

/** Inject this server interface into services; the Stripe SDK never reaches the browser. */
export interface StripeGateway {
  createAccountV2(input: CreateAccountInput, idempotencyKey: string): Promise<Stripe.V2.Core.Account>;
  createAccountLink(input: CreateAccountLinkInput, idempotencyKey: string): Promise<Stripe.V2.Core.AccountLink>;
  retrieveAccountV2(connectedAccountId: string): Promise<Stripe.V2.Core.Account>;
  createDirectPaymentIntent(input: CreateDirectPaymentIntentInput, context: ConnectedAccountRequest): Promise<Stripe.PaymentIntent>;
  retrievePaymentIntent(paymentIntentId: string, connectedAccountId: string): Promise<Stripe.PaymentIntent>;
  cancelPaymentIntent(paymentIntentId: string, context: ConnectedAccountRequest): Promise<Stripe.PaymentIntent>;
  createFullRefund(input: CreateFullRefundInput, context: ConnectedAccountRequest): Promise<Stripe.Refund>;
  constructEvent(destination: "accounts-v2", payload: Buffer, signature: string): Stripe.V2.Core.EventNotification;
  constructEvent(destination: "connect-payments", payload: Buffer, signature: string): Stripe.Event;
}

type StripeClientFactory = (secretKey: string, options: Stripe.StripeConfig) => Stripe;

function requireId(value: string, name: string): string {
  if (!value?.trim() || value !== value.trim()) throw new Error(`${name} is required`);
  return value;
}

function accountId(value: string): string {
  if (!/^acct_[A-Za-z0-9]+$/.test(value)) throw new Error("A connected-account ID is required");
  return value;
}

function requestKey(value: string): string {
  requireId(value, "A persisted idempotency key");
  if (value.length > 255) throw new Error("Idempotency key must not exceed 255 characters");
  return value;
}

function connectedOptions(context: ConnectedAccountRequest): Stripe.RequestOptions {
  return { stripeAccount: accountId(context.connectedAccountId), idempotencyKey: requestKey(context.idempotencyKey) };
}

/** Builds a reusable server client. Construction makes no Stripe requests. */
export function createStripeGateway(
  config: Pick<AppConfig, "stripe">,
  clientFactory: StripeClientFactory = (key, options) => new Stripe(key, options),
): StripeGateway {
  if ("window" in globalThis) throw new Error("Stripe gateway is server-only");
  const settings = config.stripe;
  if (!settings) throw new Error("Stripe must be configured before creating the server gateway");
  const stripe = clientFactory(settings.secretKey, {
    apiVersion: settings.apiVersion, typescript: true, maxNetworkRetries: 2,
    timeout: 30_000, telemetry: false, emitEventBodies: false,
  });

  function constructEvent(destination: "accounts-v2", payload: Buffer, signature: string): Stripe.V2.Core.EventNotification;
  function constructEvent(destination: "connect-payments", payload: Buffer, signature: string): Stripe.Event;
  function constructEvent(destination: "accounts-v2" | "connect-payments", payload: Buffer, signature: string) {
    if (!Buffer.isBuffer(payload)) throw new Error("Stripe signature verification requires the raw request body");
    if (destination === "accounts-v2") {
      return stripe.parseEventNotification(payload, signature, settings!.accountsV2WebhookSecret);
    }
    if (destination === "connect-payments") {
      return stripe.webhooks.constructEvent(payload, signature, settings!.connectPaymentsWebhookSecret);
    }
    throw new Error("Unknown Stripe event destination");
  }

  return {
    createAccountV2(input, idempotencyKey) {
      return stripe.v2.core.accounts.create({
        ...(input.contactEmail ? { contact_email: input.contactEmail } : {}),
        display_name: input.displayName, identity: { country: input.country },
        dashboard: "full",
        defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
        configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
        metadata: { jelly_store_id: requireId(input.storeId, "Store ID") },
      }, { idempotencyKey: requestKey(idempotencyKey) });
    },
    createAccountLink(input, idempotencyKey) {
      return stripe.v2.core.accountLinks.create({ account: accountId(input.connectedAccountId), use_case: {
        type: "account_onboarding", account_onboarding: { configurations: ["merchant"],
          return_url: input.returnUrl, refresh_url: input.refreshUrl },
      } }, { idempotencyKey: requestKey(idempotencyKey) });
    },
    retrieveAccountV2(connectedAccountId) {
      return stripe.v2.core.accounts.retrieve(accountId(connectedAccountId), {
        include: ["configuration.merchant", "defaults", "identity", "requirements", "future_requirements"],
      });
    },
    createDirectPaymentIntent(input, context) {
      const options = connectedOptions(context);
      if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new Error("Amount must be positive integer minor units");
      if (!/^[a-z]{3}$/.test(input.currency)) throw new Error("Currency must be a lowercase three-letter code");
      return stripe.paymentIntents.create({ amount: input.amount, currency: input.currency,
        payment_method_configuration: settings.cardPaymentMethodConfigurationId,
        metadata: { jelly_order_id: requireId(input.orderId, "Order ID"),
          jelly_checkout_attempt_id: requireId(input.checkoutAttemptId, "Checkout attempt ID") },
      }, options);
    },
    retrievePaymentIntent(paymentIntentId, connectedAccountId) {
      return stripe.paymentIntents.retrieve(requireId(paymentIntentId, "PaymentIntent ID"), {}, {
        stripeAccount: accountId(connectedAccountId),
      });
    },
    cancelPaymentIntent(paymentIntentId, context) {
      return stripe.paymentIntents.cancel(requireId(paymentIntentId, "PaymentIntent ID"), {}, connectedOptions(context));
    },
    createFullRefund(input, context) {
      return stripe.refunds.create({ payment_intent: requireId(input.paymentIntentId, "PaymentIntent ID"),
        metadata: { jelly_order_id: requireId(input.orderId, "Order ID"), jelly_refund_id: requireId(input.refundId, "Refund ID") },
      }, connectedOptions(context));
    },
    constructEvent,
  };
}
