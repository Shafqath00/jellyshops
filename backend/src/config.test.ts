import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { randomBytes } from "node:crypto";

const stripeEnvironment = {
  STRIPE_SECRET_KEY: `rk_test_${randomBytes(24).toString("hex")}`,
  STRIPE_ACCOUNTS_V2_VERSION: "2026-08-26.dahlia",
  STRIPE_CARD_PAYMENT_METHOD_CONFIGURATION_ID: "pmc_cards",
  STRIPE_ACCOUNTS_V2_WEBHOOK_SECRET: randomBytes(24).toString("hex"),
  STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET: randomBytes(24).toString("hex"),
  SCHEDULER_SECRET: randomBytes(32).toString("hex"),
};
const productionEnvironment = {
  NODE_ENV: "production", AUTH_PROVIDER: "firebase", FIREBASE_PROJECT_ID: "test-project",
  ...stripeEnvironment,
};

describe("loadConfig", () => {
  it("does not expose a selectable SQL repository provider", () => {
    const config = loadConfig({ NODE_ENV: "test" });

    expect(config).not.toHaveProperty("repositoryProvider");
  });

  it.each(Object.keys(stripeEnvironment))("requires %s in production", (name) => {
    expect(() => loadConfig({ ...productionEnvironment, [name]: undefined })).toThrow(name);
    expect(() => loadConfig({ ...productionEnvironment, [name]: "  " })).toThrow(name);
  });

  it("leaves commerce disabled for unconfigured local tests", () => {
    expect(loadConfig({ NODE_ENV: "test" }).stripe).toBeUndefined();
  });

  it("requires a complete Stripe configuration when enabled locally", () => {
    expect(() => loadConfig({ NODE_ENV: "test", STRIPE_SECRET_KEY: stripeEnvironment.STRIPE_SECRET_KEY }))
      .toThrow("STRIPE_ACCOUNTS_V2_VERSION");
  });

  it("loads the server configuration and pins the supported API version", () => {
    expect(loadConfig(productionEnvironment).stripe).toEqual({
      secretKey: stripeEnvironment.STRIPE_SECRET_KEY,
      apiVersion: "2026-08-26.dahlia", cardPaymentMethodConfigurationId: "pmc_cards",
      accountsV2WebhookSecret: stripeEnvironment.STRIPE_ACCOUNTS_V2_WEBHOOK_SECRET,
      connectPaymentsWebhookSecret: stripeEnvironment.STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET,
      schedulerSecret: stripeEnvironment.SCHEDULER_SECRET,
    });
    expect(() => loadConfig({ ...productionEnvironment, STRIPE_ACCOUNTS_V2_VERSION: "2024-06-20" }))
      .toThrow("STRIPE_ACCOUNTS_V2_VERSION");
  });

  it("rejects client keys and invalid payment configuration without disclosing values", () => {
    const invalidKey = `pk_test_${randomBytes(24).toString("hex")}`;
    try { loadConfig({ ...productionEnvironment, STRIPE_SECRET_KEY: invalidKey }); }
    catch (error) { expect(String(error)).not.toContain(invalidKey); }
    expect(() => loadConfig({ ...productionEnvironment, STRIPE_SECRET_KEY: invalidKey })).toThrow("STRIPE_SECRET_KEY");
    expect(() => loadConfig({ ...productionEnvironment, STRIPE_CARD_PAYMENT_METHOD_CONFIGURATION_ID: "invalid" }))
      .toThrow("STRIPE_CARD_PAYMENT_METHOD_CONFIGURATION_ID");
  });

  it("requires distinct signing secrets for the two event destinations", () => {
    expect(() => loadConfig({ ...productionEnvironment,
      STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET: stripeEnvironment.STRIPE_ACCOUNTS_V2_WEBHOOK_SECRET,
    })).toThrow("distinct");
  });
});
