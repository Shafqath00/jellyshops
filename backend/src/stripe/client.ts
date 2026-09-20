import Stripe from "stripe";

import type { AppConfig, StripeServerConfig } from "../config.js";

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

export interface ConnectedAccountRequest {
  connectedAccountId: string;

  /**
   * Must already be persisted before the external Stripe operation starts.
   */
  idempotencyKey: string;
}

export interface CreateAccountInput {
  storeId: string;

  /**
   * Only provide this when it comes from a trusted server-owned source.
   */
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


/* -------------------------------------------------------------------------- */
/* Gateway interface                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Server-only Stripe interface used by application services.
 *
 * Application code should depend on this interface instead of importing
 * the Stripe SDK directly.
 */
export interface StripeGateway {
  createAccountV2(
    input: CreateAccountInput,
    idempotencyKey: string,
  ): Promise<Stripe.V2.Core.Account>;

  createAccountLink(
    input: CreateAccountLinkInput,
    idempotencyKey: string,
  ): Promise<Stripe.V2.Core.AccountLink>;

  retrieveAccountV2(
    connectedAccountId: string,
  ): Promise<Stripe.V2.Core.Account>;

  createDirectPaymentIntent(
    input: CreateDirectPaymentIntentInput,
    context: ConnectedAccountRequest,
  ): Promise<Stripe.PaymentIntent>;

  retrievePaymentIntent(
    paymentIntentId: string,
    connectedAccountId: string,
  ): Promise<Stripe.PaymentIntent>;

  cancelPaymentIntent(
    paymentIntentId: string,
    context: ConnectedAccountRequest,
  ): Promise<Stripe.PaymentIntent>;

  createFullRefund(
    input: CreateFullRefundInput,
    context: ConnectedAccountRequest,
  ): Promise<Stripe.Refund>;

  constructEvent(
    destination: "accounts-v2",
    payload: Buffer,
    signature: string,
  ): Stripe.V2.Core.EventNotification;

  constructEvent(
    destination: "connect-payments",
    payload: Buffer,
    signature: string,
  ): Stripe.Event;
}


/* -------------------------------------------------------------------------- */
/* Internal types                                                             */
/* -------------------------------------------------------------------------- */

type StripeClientFactory = (
  secretKey: string,
  options: Stripe.StripeConfig,
) => Stripe;

type StripeDestination =
  | "accounts-v2"
  | "connect-payments";


/* -------------------------------------------------------------------------- */
/* Validation helpers                                                         */
/* -------------------------------------------------------------------------- */

function requireValue(
  value: string,
  name: string,
): string {
  if (!value?.trim() || value !== value.trim()) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function requireAccountId(
  value: string,
): string {
  if (!/^acct_[A-Za-z0-9]+$/.test(value)) {
    throw new Error(
      "A connected-account ID is required",
    );
  }

  return value;
}

function requireIdempotencyKey(
  value: string,
): string {
  requireValue(
    value,
    "A persisted idempotency key",
  );

  if (value.length > 255) {
    throw new Error(
      "Idempotency key must not exceed 255 characters",
    );
  }

  return value;
}

function requireAmount(
  amount: number,
): number {
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Amount must be positive integer minor units",
    );
  }

  return amount;
}

function requireCurrency(
  currency: string,
): string {
  if (!/^[a-z]{3}$/.test(currency)) {
    throw new Error(
      "Currency must be a lowercase three-letter code",
    );
  }

  return currency;
}

function connectedRequestOptions(
  context: ConnectedAccountRequest,
): Stripe.RequestOptions {
  return {
    stripeAccount:
      requireAccountId(
        context.connectedAccountId,
      ),

    idempotencyKey:
      requireIdempotencyKey(
        context.idempotencyKey,
      ),
  };
}


/* -------------------------------------------------------------------------- */
/* Stripe client                                                              */
/* -------------------------------------------------------------------------- */

function defaultStripeClientFactory(
  secretKey: string,
  options: Stripe.StripeConfig,
): Stripe {
  return new Stripe(
    secretKey,
    options,
  );
}


/* -------------------------------------------------------------------------- */
/* Gateway                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Creates the reusable server-side Stripe gateway.
 *
 * Constructing the gateway does not make any Stripe API requests.
 */
export function createStripeGateway(
  config: Pick<AppConfig, "stripe">,
  clientFactory: StripeClientFactory =
    defaultStripeClientFactory,
): StripeGateway {
  if ("window" in globalThis) {
    throw new Error(
      "Stripe gateway is server-only",
    );
  }

  if (!config.stripe) {
    throw new Error(
      "Stripe must be configured before creating the server gateway",
    );
  }

  // Narrowed non-optional reference used inside closures below.
  const settings: StripeServerConfig = config.stripe;

  const stripe = clientFactory(
    settings.secretKey,
    {
      apiVersion:
        settings.apiVersion,

      typescript: true,

      maxNetworkRetries: 2,

      timeout: 30_000,

      telemetry: false,

      emitEventBodies: false,
    },
  );


  /* ------------------------------------------------------------------------ */
  /* Webhook verification                                                     */
  /* ------------------------------------------------------------------------ */

  function constructEvent(
    destination: "accounts-v2",
    payload: Buffer,
    signature: string,
  ): Stripe.V2.Core.EventNotification;

  function constructEvent(
    destination: "connect-payments",
    payload: Buffer,
    signature: string,
  ): Stripe.Event;

  function constructEvent(
    destination: StripeDestination,
    payload: Buffer,
    signature: string,
  ) {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "Stripe signature verification requires the raw request body",
      );
    }

    if (destination === "accounts-v2") {
      return stripe.parseEventNotification(
        payload,
        signature,
        settings.accountsV2WebhookSecret,
      );
    }

    if (destination === "connect-payments") {
      return stripe.webhooks.constructEvent(
        payload,
        signature,
        settings.connectPaymentsWebhookSecret,
      );
    }

    throw new Error(
      "Unknown Stripe event destination",
    );
  }


  /* ------------------------------------------------------------------------ */
  /* Returned gateway                                                         */
  /* ------------------------------------------------------------------------ */

  return {
    createAccountV2(
      input,
      idempotencyKey,
    ) {
      return stripe.v2.core.accounts.create(
        {
          ...(input.contactEmail
            ? {
                contact_email:
                  input.contactEmail,
              }
            : {}),

          display_name:
            input.displayName,

          identity: {
            country:
              input.country,
          },

          dashboard: "full",

          defaults: {
            responsibilities: {
              fees_collector: "stripe",
              losses_collector: "stripe",
            },
          },

          configuration: {
            merchant: {
              capabilities: {
                card_payments: {
                  requested: true,
                },
              },
            },
          },

          metadata: {
            jelly_store_id:
              requireValue(
                input.storeId,
                "Store ID",
              ),
          },
        },
        {
          idempotencyKey:
            requireIdempotencyKey(
              idempotencyKey,
            ),
        },
      );
    },


    createAccountLink(
      input,
      idempotencyKey,
    ) {
      return stripe.v2.core.accountLinks.create(
        {
          account:
            requireAccountId(
              input.connectedAccountId,
            ),

          use_case: {
            type:
              "account_onboarding",

            account_onboarding: {
              configurations: [
                "merchant",
              ],

              return_url:
                input.returnUrl,

              refresh_url:
                input.refreshUrl,
            },
          },
        },
        {
          idempotencyKey:
            requireIdempotencyKey(
              idempotencyKey,
            ),
        },
      );
    },


    retrieveAccountV2(
      connectedAccountId,
    ) {
      return stripe.v2.core.accounts.retrieve(
        requireAccountId(
          connectedAccountId,
        ),
        {
          include: [
            "configuration.merchant",
            "defaults",
            "identity",
            "requirements",
            "future_requirements",
          ],
        },
      );
    },


    createDirectPaymentIntent(
      input,
      context,
    ) {
      const options =
        connectedRequestOptions(
          context,
        );

      return stripe.paymentIntents.create(
        {
          amount:
            requireAmount(
              input.amount,
            ),

          currency:
            requireCurrency(
              input.currency,
            ),

          ...(settings.cardPaymentMethodConfigurationId
            ? { payment_method_configuration: settings.cardPaymentMethodConfigurationId }
            : {}),

          metadata: {
            jelly_order_id:
              requireValue(
                input.orderId,
                "Order ID",
              ),

            jelly_checkout_attempt_id:
              requireValue(
                input.checkoutAttemptId,
                "Checkout attempt ID",
              ),
          },
        },
        options,
      );
    },


    retrievePaymentIntent(
      paymentIntentId,
      connectedAccountId,
    ) {
      return stripe.paymentIntents.retrieve(
        requireValue(
          paymentIntentId,
          "PaymentIntent ID",
        ),
        {},
        {
          stripeAccount:
            requireAccountId(
              connectedAccountId,
            ),
        },
      );
    },


    cancelPaymentIntent(
      paymentIntentId,
      context,
    ) {
      return stripe.paymentIntents.cancel(
        requireValue(
          paymentIntentId,
          "PaymentIntent ID",
        ),
        {},
        connectedRequestOptions(
          context,
        ),
      );
    },


    createFullRefund(
      input,
      context,
    ) {
      return stripe.refunds.create(
        {
          payment_intent:
            requireValue(
              input.paymentIntentId,
              "PaymentIntent ID",
            ),

          metadata: {
            jelly_order_id:
              requireValue(
                input.orderId,
                "Order ID",
              ),

            jelly_refund_id:
              requireValue(
                input.refundId,
                "Refund ID",
              ),
          },
        },
        connectedRequestOptions(
          context,
        ),
      );
    },


    constructEvent,
  };
}
