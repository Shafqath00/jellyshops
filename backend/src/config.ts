import path from "node:path";
import "dotenv/config";
import { z } from "zod";

// Kept in step with the exact Stripe SDK pin. No preview or account-default version.
export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

/** Backend-only credentials. Never serialize AppConfig into an API response. */
export interface StripeServerConfig {
  secretKey: string;
  apiVersion: typeof STRIPE_API_VERSION;
  cardPaymentMethodConfigurationId: string;
  accountsV2WebhookSecret: string;
  connectPaymentsWebhookSecret: string;
  schedulerSecret: string;
}

function loadStripeConfig(environment: NodeJS.ProcessEnv, production: boolean): StripeServerConfig | undefined {
  const names = ["STRIPE_SECRET_KEY", "STRIPE_ACCOUNTS_V2_VERSION", "STRIPE_CARD_PAYMENT_METHOD_CONFIGURATION_ID",
    "STRIPE_ACCOUNTS_V2_WEBHOOK_SECRET", "STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET", "SCHEDULER_SECRET"] as const;
  if (!production && !names.some((name) => environment[name]?.trim())) return undefined;
  for (const name of names) {
    if (!environment[name]?.trim()) throw new Error(`${name} is required when Stripe is configured or in production`);
  }
  const secretKey = environment.STRIPE_SECRET_KEY!.trim();
  if (!/^[sr]k_(test|live)_[A-Za-z0-9]+$/.test(secretKey)) throw new Error("STRIPE_SECRET_KEY must be a server API key");
  if (environment.STRIPE_ACCOUNTS_V2_VERSION !== STRIPE_API_VERSION) {
    throw new Error(`STRIPE_ACCOUNTS_V2_VERSION must match the supported SDK version (${STRIPE_API_VERSION})`);
  }
  const cardPaymentMethodConfigurationId = environment.STRIPE_CARD_PAYMENT_METHOD_CONFIGURATION_ID!.trim();
  if (!/^pmc_[A-Za-z0-9]+$/.test(cardPaymentMethodConfigurationId)) {
    throw new Error("STRIPE_CARD_PAYMENT_METHOD_CONFIGURATION_ID must identify a card-only payment method configuration");
  }
  const accountsV2WebhookSecret = environment.STRIPE_ACCOUNTS_V2_WEBHOOK_SECRET!.trim();
  const connectPaymentsWebhookSecret = environment.STRIPE_CONNECT_PAYMENTS_WEBHOOK_SECRET!.trim();
  if (accountsV2WebhookSecret === connectPaymentsWebhookSecret) throw new Error("Stripe webhook signing secrets must be distinct");
  return { secretKey, apiVersion: STRIPE_API_VERSION, cardPaymentMethodConfigurationId,
    accountsV2WebhookSecret, connectPaymentsWebhookSecret, schedulerSecret: environment.SCHEDULER_SECRET!.trim() };
}

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  AUTH_PROVIDER: z.enum(["development", "firebase"]).default("development"),
  MEDIA_PROVIDER: z.enum(["local-files", "gcs"]).default("local-files"),
  DATA_DIRECTORY: z.string().default(path.resolve(".data")),
  UPLOAD_DIRECTORY: z.string().default(path.resolve("uploads")),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  DEMO_STORE_ID: z.string().min(1).default("store-demo"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  GCS_BUCKET: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),
});

export interface AppConfig {
  port: number;
  nodeEnv: "development" | "test" | "production";
  corsOrigins: string[];
  trustProxy: boolean;
  authProvider: "development" | "firebase";
  mediaProvider: "local-files" | "gcs";
  dataDirectory: string;
  uploadDirectory: string;
  maxUploadBytes: number;
  demoStoreId: string;
  stripe?: StripeServerConfig;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.parse(environment);

  if (parsed.NODE_ENV === "production" && parsed.AUTH_PROVIDER === "development") {
    throw new Error("AUTH_PROVIDER=development is not allowed in production");
  }
  if (parsed.AUTH_PROVIDER === "firebase" && !parsed.FIREBASE_PROJECT_ID) {
    throw new Error("FIREBASE_PROJECT_ID is required when AUTH_PROVIDER=firebase");
  }
  if (parsed.MEDIA_PROVIDER === "gcs" && (!parsed.GCS_BUCKET || !parsed.GCS_PROJECT_ID)) {
    throw new Error("GCS_BUCKET and GCS_PROJECT_ID are required when MEDIA_PROVIDER=gcs");
  }

  return {
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    corsOrigins: parsed.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    trustProxy: parsed.TRUST_PROXY === "true",
    authProvider: parsed.AUTH_PROVIDER,
    mediaProvider: parsed.MEDIA_PROVIDER,
    dataDirectory: path.resolve(parsed.DATA_DIRECTORY),
    uploadDirectory: path.resolve(parsed.UPLOAD_DIRECTORY),
    maxUploadBytes: parsed.MAX_UPLOAD_BYTES,
    demoStoreId: parsed.DEMO_STORE_ID,
    stripe: loadStripeConfig(environment, parsed.NODE_ENV === "production"),
  };
}
