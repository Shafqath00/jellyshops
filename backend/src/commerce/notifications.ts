import { createHash, createHmac, randomUUID } from "node:crypto";
import type { CommerceDatabase, SqlExecutor } from "./repository.js";
import { ApiError } from "../http/errors.js";

export const notificationTypes = ["PLACED", "PAYMENT_CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUND_PROCESSED", "DIGITAL_READY"] as const;
export type NotificationType = typeof notificationTypes[number];
const titles: Record<NotificationType, string> = { PLACED: "Order placed", PAYMENT_CONFIRMED: "Payment confirmed", PROCESSING: "Your order is being prepared", SHIPPED: "Your order has shipped", DELIVERED: "Your order was delivered", CANCELLED: "Order cancelled", REFUND_PROCESSED: "Refund processed", DIGITAL_READY: "Your downloads are ready" };
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function digitalToken(id: string, secret: string): string {
  if (secret.length < 32) throw new Error("DIGITAL_TOKEN_SECRET must contain at least 32 characters");
  return createHmac("sha256", secret).update(id).digest("base64url");
}
export const hashDigitalToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function notificationRetry(attempts: number, uncertain: boolean) {
  return { status: uncertain ? "UNCERTAIN" : attempts >= 8 ? "FAILED" : "QUEUED", delaySeconds: uncertain || attempts >= 8 ? 0 : Math.min(3600, 30 * 2 ** attempts) };
}
export interface NotificationContent { brandName: string; customerName?: string; number: string; totalMinor: number; currency: string; orderUrl: string; accentColor?: string; logoUrl?: string | null; contactEmail?: string; refundAmountMinor?: number; items?: { title: string; quantity: number; unitPriceMinor: number }[]; downloads?: { filename: string; url: string }[]; tracking?: { carrier?: string; number?: string; url?: string }[] }
export function renderOrderNotification(type: NotificationType, data: NotificationContent) {
  const title = titles[type];
  const total = new Intl.NumberFormat("en", { style: "currency", currency: data.currency }).format(data.totalMinor / 100);
  const refund = data.refundAmountMinor === undefined ? "" : `<p><strong>Refund amount: ${escape(new Intl.NumberFormat("en", { style: "currency", currency: data.currency }).format(data.refundAmountMinor / 100))}</strong></p>`;
  const accent = /^#[0-9a-f]{6}$/i.test(data.accentColor ?? "") ? data.accentColor : "#192642";
  const links = (data.downloads ?? []).map((d) => `<p><a href="${escape(d.url)}">Download ${escape(d.filename)}</a></p>`).join("");
  const tracking = (data.tracking ?? []).map((t) => `<p>${escape(t.carrier)} ${escape(t.number)}${t.url ? ` <a href="${escape(t.url)}">Track shipment</a>` : ""}</p>`).join("");
  const items = (data.items ?? []).map((item) => `<tr><td style="padding:8px 0">${escape(item.title)} × ${item.quantity}</td><td style="text-align:right;padding:8px 0">${escape(new Intl.NumberFormat("en", { style: "currency", currency: data.currency }).format(item.unitPriceMinor * item.quantity / 100))}</td></tr>`).join("");
  return { subject: `${title} — ${data.number.replace(/[\r\n]/g, "")}`, text: `${data.brandName}\n${title}\nOrder ${data.number}\nOrder total ${total}\n${data.refundAmountMinor === undefined ? "" : `Refund amount ${new Intl.NumberFormat("en", { style: "currency", currency: data.currency }).format(data.refundAmountMinor / 100)}\n`}${data.orderUrl}\n${(data.downloads ?? []).map((d) => `${d.filename}: ${d.url}`).join("\n")}`, html: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f6f6;font-family:Arial,sans-serif;color:#222"><main style="max-width:600px;margin:24px auto;background:white;padding:32px;border-radius:12px">${data.logoUrl ? `<img alt="" src="${escape(data.logoUrl)}" style="max-width:180px;max-height:80px">` : ""}<p>${escape(data.brandName)}</p><h1 style="color:${accent};font-size:26px">${escape(title)}</h1><p>Hello ${escape(data.customerName || "there")},</p><p>Order <strong>${escape(data.number)}</strong></p><table role="presentation" style="width:100%">${items}</table><p>Order total: ${escape(total)}</p>${refund}${tracking}${links}<p><a style="color:${accent}" href="${escape(data.orderUrl)}">View your order</a></p><p style="font-size:12px;color:#666">Contact the store${data.contactEmail ? ` at ${escape(data.contactEmail)}` : " by replying to this email"}.</p></main></body></html>` };
}
export interface NotificationMessage { id: string; to: string; replyTo?: string; subject: string; html: string; text: string }
export interface NotificationTransport { send(message: NotificationMessage): Promise<{ messageId: string }> }
export class UncertainDeliveryError extends Error {}
export class CaptureNotificationTransport implements NotificationTransport {
  readonly messages: NotificationMessage[] = [];
  async send(message: NotificationMessage) { this.messages.push(message); return { messageId: `capture:${message.id}` }; }
}
async function recordNotificationEvent(sql: SqlExecutor, storeId: string, orderId: string, type: string, details: object) {
  await sql.query(`INSERT INTO "OrderEvent"("id","storeId","orderId","type","details") VALUES($1,$2,$3,$4,$5::jsonb)`, [randomUUID(), storeId, orderId, type, JSON.stringify(details)]);
}
export function createNotificationService(database: CommerceDatabase, transport: NotificationTransport, options: { publicBaseUrl: string; apiBaseUrl?: string; tokenSecret: string }) {
  digitalToken("validation", options.tokenSecret);
  const baseUrl = options.publicBaseUrl.replace(/\/$/, "");
  const apiBaseUrl = (options.apiBaseUrl ?? options.publicBaseUrl).replace(/\/$/, "");
  return {
    async branding(storeId: string) { return database.transaction(async (sql) => (await sql.query(`SELECT * FROM "StoreNotificationBranding" WHERE "storeId"=$1`, [storeId])).rows[0] ?? { storeId }); },
    async saveBranding(storeId: string, input: { brandName?: string; replyTo?: string; accentColor: string; logoUrl?: string }) {
      return database.transaction(async (sql) => (await sql.query(`INSERT INTO "StoreNotificationBranding"("storeId","brandName","replyTo","accentColor","logoUrl") VALUES($1,$2,$3,$4,$5) ON CONFLICT("storeId") DO UPDATE SET "brandName"=EXCLUDED."brandName","replyTo"=EXCLUDED."replyTo","accentColor"=EXCLUDED."accentColor","logoUrl"=EXCLUDED."logoUrl" RETURNING *`, [storeId, input.brandName ?? null, input.replyTo ?? null, input.accentColor, input.logoUrl ?? null])).rows[0]);
    },
    async list(storeId: string, orderId?: string) { return database.transaction(async (sql) => (await sql.query(`SELECT * FROM "OrderNotification" WHERE "storeId"=$1 AND ($2::text IS NULL OR "orderId"=$2) ORDER BY "createdAt" DESC LIMIT 200`, [storeId, orderId ?? null])).rows); },
    async resend(storeId: string, orderId: string, type: NotificationType) {
      return database.transaction(async (sql) => {
        const source = (await sql.query(`SELECT * FROM "OrderNotification" WHERE "storeId"=$1 AND "orderId"=$2 AND "type"=$3 ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE`, [storeId, orderId, type])).rows[0];
        if (!source) throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "No matching order notification exists");
        const id = randomUUID();
        await sql.query(`INSERT INTO "OrderNotification"("id","storeId","orderId","type","dedupeKey","snapshot") VALUES($1,$2,$3,$4,$1,$5::jsonb)`, [id, storeId, orderId, type, JSON.stringify(source.snapshot ?? {})]);
        await recordNotificationEvent(sql, storeId, orderId, "NOTIFICATION_RESENT", { notificationId: id, sourceId: source.id, type });
        return { id, status: "QUEUED" };
      });
    },
    async runWorker(limit = 25) {
      const started = Date.now(); let processed = 0;
      for (let index = 0; index < limit && Date.now() - started < 180000; index++) {
      // A crashed SMTP attempt may already have been accepted. Never replay it automatically.
      const jobs = await database.transaction(async (sql) => {
        const expired = (await sql.query(`UPDATE "OrderNotification" SET "status"='UNCERTAIN',"lastError"='Worker lease expired; delivery outcome unknown',"updatedAt"=CURRENT_TIMESTAMP WHERE "status"='SENDING' AND "leaseUntil"<CURRENT_TIMESTAMP RETURNING *`)).rows;
        for (const row of expired) await recordNotificationEvent(sql, String(row.storeId), String(row.orderId), "NOTIFICATION_FAILED", { notificationId: row.id, uncertain: true });
        return (await sql.query(`WITH jobs AS (SELECT "id" FROM "OrderNotification" WHERE "status"='QUEUED' AND "availableAt"<=CURRENT_TIMESTAMP ORDER BY "availableAt" LIMIT 1 FOR UPDATE SKIP LOCKED) UPDATE "OrderNotification" n SET "status"='SENDING',"attempts"="attempts"+1,"leaseUntil"=CURRENT_TIMESTAMP+interval '5 minutes',"updatedAt"=CURRENT_TIMESTAMP FROM jobs WHERE n."id"=jobs."id" RETURNING n.*`)).rows;
      });
      const job = jobs[0]; if (!job) break;
      processed++;
        let providerAccepted = false;
        try {
          const content = await database.transaction(async (sql) => {
            const live = (await sql.query(`SELECT o.*,s."name" AS "storeName",s."slug",b."brandName",b."replyTo",b."accentColor",b."logoUrl" FROM "Order" o JOIN "Store" s ON s."id"=o."storeId" LEFT JOIN "StoreNotificationBranding" b ON b."storeId"=s."id" WHERE o."storeId"=$1 AND o."id"=$2`, [job.storeId, job.orderId])).rows[0]!;
            const order = { ...live, ...(job.snapshot as Record<string, unknown> ?? {}) };
            const grants = job.type === "DIGITAL_READY" ? (await sql.query(`SELECT e.*,a."filename" FROM "DigitalEntitlement" e JOIN "DigitalAsset" a ON a."id"=e."assetId" AND a."storeId"=e."storeId" WHERE e."storeId"=$1 AND e."orderId"=$2 AND e."revokedAt" IS NULL AND (e."expiresAt" IS NULL OR e."expiresAt">CURRENT_TIMESTAMP)`, [job.storeId, job.orderId])).rows : [];
            const downloads = [];
            for (const grant of grants) {
              const token = digitalToken(String(grant.id), options.tokenSecret);
              await sql.query(`UPDATE "DigitalEntitlement" SET "tokenHash"=$2 WHERE "id"=$1`, [grant.id, hashDigitalToken(token)]);
              downloads.push({ filename: String(grant.filename), url: `${apiBaseUrl}/api/public/stores/${encodeURIComponent(String(job.storeId))}/digital/${grant.id}?token=${token}` });
            }
            const tracking = job.type === "SHIPPED" || job.type === "DELIVERED" ? (await sql.query(`SELECT carrier,"trackingNumber" AS number,"trackingUrl" AS url FROM "OrderFulfilment" WHERE "storeId"=$1 AND "orderId"=$2 ORDER BY "createdAt"`, [job.storeId, job.orderId])).rows.map((r) => ({ carrier: String(r.carrier ?? ""), number: String(r.number ?? ""), url: typeof r.url === "string" && /^https?:\/\//.test(r.url) ? r.url : undefined })) : [];
            const itemRows = Array.isArray(order.items) ? order.items as Record<string, unknown>[] : (await sql.query(`SELECT * FROM "OrderItem" WHERE "storeId"=$1 AND "orderId"=$2 ORDER BY "variantId"`, [job.storeId, job.orderId])).rows;
            const items = itemRows.map((r) => ({ title: String(r.titleSnapshot), quantity: Number(r.quantity), unitPriceMinor: Number(r.unitPriceMinor) }));
            return { order, downloads, tracking, items };
          });
          const customer = content.order.customerSnapshot as { name?: string; email?: string };
          if (!customer.email) throw new Error("Order has no customer email");
          const rendered = renderOrderNotification(job.type as NotificationType, { brandName: String(content.order.brandName ?? content.order.storeName), customerName: customer.name, number: String(content.order.number), currency: String(content.order.currency), totalMinor: Number(content.order.totalMinor), orderUrl: `${baseUrl}/${content.order.slug}/order/${content.order.publicToken}`, accentColor: String(content.order.accentColor ?? ""), logoUrl: content.order.logoUrl as string | null, downloads: content.downloads, tracking: content.tracking, items: content.items, refundAmountMinor: typeof content.order.refundAmountMinor === "number" ? content.order.refundAmountMinor : undefined, contactEmail: typeof content.order.replyTo === "string" ? content.order.replyTo : undefined });
          const lease = await database.transaction(async (sql) => (await sql.query(`UPDATE "OrderNotification" SET "leaseUntil"=CURRENT_TIMESTAMP+interval '5 minutes' WHERE "id"=$1 AND "status"='SENDING' AND "leaseUntil">CURRENT_TIMESTAMP RETURNING "id"`, [job.id])).rows.length > 0);
          if (!lease) continue;
          const receipt = await transport.send({ id: String(job.id), to: customer.email, replyTo: content.order.replyTo as string | undefined, ...rendered });
          providerAccepted = true;
          await database.transaction(async (sql) => {
            await sql.query(`UPDATE "OrderNotification" SET "status"='ACCEPTED',"providerMessageId"=$2,"leaseUntil"=NULL,"lastError"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"='SENDING'`, [job.id, receipt.messageId]);
            await recordNotificationEvent(sql, String(job.storeId), String(job.orderId), "NOTIFICATION_ACCEPTED", { notificationId: job.id, type: job.type });
          });
        } catch (error) {
          const retry = notificationRetry(Number(job.attempts), providerAccepted || error instanceof UncertainDeliveryError);
          await database.transaction(async (sql) => {
            await sql.query(`UPDATE "OrderNotification" SET "status"=$2,"leaseUntil"=NULL,"lastError"=$3,"availableAt"=CURRENT_TIMESTAMP+($4*interval '1 second'),"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"='SENDING'`, [job.id, retry.status, error instanceof Error ? error.message.slice(0, 500) : "Delivery failed", retry.delaySeconds]);
            await recordNotificationEvent(sql, String(job.storeId), String(job.orderId), "NOTIFICATION_FAILED", { notificationId: job.id, type: job.type, status: retry.status, attempts: job.attempts });
          });
        }
      }
      return { processed };
    },
  };
}
export type NotificationService = ReturnType<typeof createNotificationService>;



