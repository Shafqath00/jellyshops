import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import { ApiError } from "../http/errors.js";
import type { CommerceDatabase } from "./repository.js";
import type { MerchantOrderService } from "./merchant-orders.js";
import { createNotificationService, CaptureNotificationTransport } from "./notifications.js";
import { smtpNotificationTransport } from "./notification-transport.js";
import { createDigitalService, localPrivateDigitalStorage, supabasePrivateDigitalStorage } from "./digital.js";
import type { PaymentSettlementHooks } from "../stripe/webhooks/processor.js";

/** Optional communications configuration must never make ordinary checkout unavailable. */
export function createOrderRuntime(database: CommerceDatabase, orders: MerchantOrderService, config: AppConfig, env: NodeJS.ProcessEnv = process.env) {
  const production = config.nodeEnv === "production";
  const tokenSecret = env.DIGITAL_TOKEN_SECRET || (!production ? "development-only-digital-token-secret-change-before-production" : "");
  const publicBaseUrl = env.STOREFRONT_PUBLIC_URL || (!production ? "http://127.0.0.1:3200" : "");
  const apiBaseUrl = env.ORDER_PUBLIC_API_URL || (!production ? `http://127.0.0.1:${config.port}` : "");
  const smtpConfigured = Boolean(env.ORDER_SMTP_HOST);
  if (smtpConfigured && (!tokenSecret || !publicBaseUrl || !apiBaseUrl)) throw new Error("Order notifications require DIGITAL_TOKEN_SECRET, STOREFRONT_PUBLIC_URL and ORDER_PUBLIC_API_URL");
  const transport = smtpConfigured ? smtpNotificationTransport({
    host: env.ORDER_SMTP_HOST!, port: Number(env.ORDER_SMTP_PORT || 587), secure: env.ORDER_SMTP_SECURE === "true",
    user: env.ORDER_SMTP_USER || "", password: env.ORDER_SMTP_PASSWORD || "", from: env.ORDER_EMAIL_FROM || "",
    verifiedDomain: env.ORDER_EMAIL_DOMAIN_VERIFIED === "true",
  }) : !production ? new CaptureNotificationTransport() : undefined;
  const notifications = transport && tokenSecret && publicBaseUrl && apiBaseUrl
    ? createNotificationService(database, transport, { tokenSecret, publicBaseUrl, apiBaseUrl }) : undefined;
  const storage = config.supabaseUrl && config.supabaseSecretKey && env.SUPABASE_DIGITAL_BUCKET
    ? supabasePrivateDigitalStorage(createClient(config.supabaseUrl, config.supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } }), env.SUPABASE_DIGITAL_BUCKET)
    : !production ? localPrivateDigitalStorage(env.DIGITAL_STORAGE_DIRECTORY || path.join(config.dataDirectory, "private-digital")) : undefined;
  const digital = storage ? createDigitalService(database, storage) : undefined;
  const hooks: PaymentSettlementHooks = {
    async settleChargeRefund(id, tx, account) {
      // Managed refunds settle through refund.updated. charge.refunded also fires
      // for partial refunds and must not run the legacy whole-order/restock path.
      const managed = await tx.query(`SELECT t.id FROM "OrderTransaction" t JOIN "Payment" p ON p."storeId"=t."storeId" AND p."orderId"=t."orderId" WHERE t.kind='REFUND' AND t."paymentIntentId"=$1 AND p."stripeAccountId"=$2 LIMIT 1`, [id, account]);
      return managed.rows.length > 0;
    },
    async settlePaymentIntent(id, status, tx, account, object) {
      const metadata = object?.metadata as Record<string, string> | undefined;
      if (metadata?.jelly_checkout_attempt_id) await tx.query(`UPDATE "OrderTransaction" t SET "paymentIntentId"=$1 FROM "Payment" p WHERE t."revisionId"=$3 AND t.kind='PAYMENT' AND t."paymentIntentId" IS NULL AND p."storeId"=t."storeId" AND p."orderId"=t."orderId" AND p."stripeAccountId"=$2 AND t."orderId"=$4`, [id, account, metadata.jelly_checkout_attempt_id, metadata.jelly_order_id]);
      const allowed = await tx.query(`SELECT t.id FROM "OrderTransaction" t JOIN "Payment" p ON p."storeId"=t."storeId" AND p."orderId"=t."orderId" WHERE t."paymentIntentId"=$1 AND p."stripeAccountId"=$2`, [id, account]);
      return allowed.rows.length ? orders.management.settlePaymentIntent(id, status, tx) : false;
    },
    async settleRefund(id, status, tx, account, object) {
      const metadata = object?.metadata as Record<string, string> | undefined;
      if (metadata?.jelly_refund_id) await tx.query(`UPDATE "OrderTransaction" t SET "stripeRefundId"=$1 FROM "Payment" p WHERE t.id=$3 AND t.kind='REFUND' AND t."stripeRefundId" IS NULL AND p."storeId"=t."storeId" AND p."orderId"=t."orderId" AND p."stripeAccountId"=$2 AND t."orderId"=$4`, [id, account, metadata.jelly_refund_id, metadata.jelly_order_id]);
      const allowed = await tx.query(`SELECT t.id FROM "OrderTransaction" t JOIN "Payment" p ON p."storeId"=t."storeId" AND p."orderId"=t."orderId" WHERE t."stripeRefundId"=$1 AND p."stripeAccountId"=$2`, [id, account]);
      return allowed.rows.length ? orders.management.settleRefund(id, status, tx) : false;
    },
  };
  async function runWorkers() {
    const operations = await orders.management.runOperations(2);
    const email = notifications ? await notifications.runWorker(3) : { configured: false };
    const health = await database.transaction(async tx => ({
      pendingWebhooks: Number((await tx.query(`SELECT count(*)::int AS count FROM "StripeWebhookEvent" WHERE "processedAt" IS NULL`)).rows[0]?.count || 0),
      pendingSettlements: Number((await tx.query(`SELECT count(*)::int AS count FROM "OrderRevision" WHERE status='PENDING'`)).rows[0]?.count || 0),
      failedNotifications: Number((await tx.query(`SELECT count(*)::int AS count FROM "OrderNotification" WHERE status IN ('FAILED','UNCERTAIN')`)).rows[0]?.count || 0),
    }));
    return { operations, email, health };
  }
  return { notifications, digital, hooks, runWorkers };
}
export type OrderRuntime = ReturnType<typeof createOrderRuntime>;

export function createOrderWorkerRouter(run: () => Promise<unknown>, secret: string) {
  const router = express.Router();
  router.post("/", async (req, res, next) => {
    try {
      const actual = Buffer.from(req.header("x-scheduler-secret") || "");
      const expected = Buffer.from(secret);
      if (!expected.length || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ApiError(401, "SCHEDULER_UNAUTHORIZED", "Scheduler authorization failed.");
      res.json(await run());
    } catch (error) { next(error); }
  });
  return router;
}
