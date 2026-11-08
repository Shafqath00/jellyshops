import { createHash, createHmac, randomUUID } from "node:crypto";
import type { CommerceDatabase, SqlExecutor } from "./repository.js";
import { ApiError } from "../http/errors.js";

export const notificationTypes = ["PLACED", "PAYMENT_CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "SHIPMENT_DELAYED", "DELIVERY_FAILED", "CANCELLED", "REFUND_PROCESSED", "DIGITAL_READY"] as const;
/** Notifications that name a shipment, so they carry its carrier and tracking details. */
const shipmentNotificationTypes: ReadonlySet<string> = new Set(["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "SHIPMENT_DELAYED", "DELIVERY_FAILED"]);
export type NotificationType = typeof notificationTypes[number];
const titles: Record<NotificationType, string> = { PLACED: "Order placed", PAYMENT_CONFIRMED: "Payment confirmed", PROCESSING: "Your order is being prepared", PACKED: "Your order is packed", SHIPPED: "Your order has shipped", OUT_FOR_DELIVERY: "Your order is out for delivery", DELIVERED: "Your order was delivered", SHIPMENT_DELAYED: "Your shipment is delayed", DELIVERY_FAILED: "A delivery attempt failed", CANCELLED: "Order cancelled", REFUND_PROCESSED: "Refund processed", DIGITAL_READY: "Your downloads are ready" };
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function digitalToken(id: string, secret: string): string {
  if (secret.length < 32) throw new Error("DIGITAL_TOKEN_SECRET must contain at least 32 characters");
  return createHmac("sha256", secret).update(id).digest("base64url");
}
export const hashDigitalToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function notificationRetry(attempts: number, uncertain: boolean) {
  return { status: uncertain ? "UNCERTAIN" : attempts >= 8 ? "FAILED" : "QUEUED", delaySeconds: uncertain || attempts >= 8 ? 0 : Math.min(3600, 30 * 2 ** attempts) };
}
export interface NotificationContent { brandName: string; customerName?: string; number: string; totalMinor: number; currency: string; orderUrl: string; accentColor?: string; logoUrl?: string | null; contactEmail?: string; refundAmountMinor?: number; items?: { title: string; quantity: number; unitPriceMinor: number; /** The line's choices and personalisation, "Engraving: SAM". */ details?: string[] }[]; downloads?: { filename: string; url: string }[]; tracking?: { carrier?: string; number?: string; url?: string }[] }
export interface NotificationTemplate { subject: string; heading: string; message: string; closing: string }
const defaultMessages: Record<NotificationType, string> = {
  PLACED: "We've received your order. You'll find your order details below.",
  PAYMENT_CONFIRMED: "Your payment is confirmed. Thank you for shopping with us.",
  PROCESSING: "We're preparing your order and will keep you updated as it moves along.",
  PACKED: "Your order has been packed and is being prepared for shipment.",
  SHIPPED: "Your order is on its way. You can find any available tracking details below.",
  OUT_FOR_DELIVERY: "Your shipment is out for delivery. Check your tracking details for the latest updates.",
  DELIVERED: "Your shipment has been marked as delivered. We hope you enjoy your order.",
  SHIPMENT_DELAYED: "Your shipment is delayed. Please check the tracking details for the latest information.",
  DELIVERY_FAILED: "A delivery attempt was unsuccessful. Please check the tracking details for next steps.",
  CANCELLED: "Your order has been cancelled. Please contact the store if you have any questions.",
  REFUND_PROCESSED: "Your refund has been processed. The amount is shown in your order details below.",
  DIGITAL_READY: "Your digital items are ready. Use the download links below to access them.",
};
export function defaultNotificationTemplate(type: NotificationType): NotificationTemplate {
  return {
    subject: titles[type],
    heading: type === "PLACED" ? "Thank you for your order" : titles[type],
    message: defaultMessages[type],
    closing: "Thank you for shopping with us.",
  };
}
function safeWebUrl(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? value : undefined; } catch { return undefined; }
}
function buttonTextColor(hex: string): string {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  if ((1.05 / (luminance + 0.05)) >= 4.5) return "#ffffff";
  return (luminance + 0.05) / 0.065 >= 4.5 ? "#14213d" : "#000000";
}
export function renderOrderNotification(type: NotificationType, data: NotificationContent, template: NotificationTemplate = defaultNotificationTemplate(type)) {
  const money = (minor: number) => new Intl.NumberFormat("en", { style: "currency", currency: data.currency }).format(minor / 100);
  const total = money(data.totalMinor);
  const accent = /^#[0-9a-f]{6}$/i.test(data.accentColor ?? "") ? data.accentColor! : "#14213d";
  const buttonColor = buttonTextColor(accent);
  const orderUrl = safeWebUrl(data.orderUrl);
  const logoUrl = safeWebUrl(data.logoUrl);
  const lines = (value: string) => escape(value).replace(/\r\n|\r|\n/g, "<br>");
  const items = (data.items ?? []).map(item => `<tr><td style="padding:14px 8px 14px 0;border-bottom:1px solid #dcd8ce;font-size:14px;line-height:21px;color:#14213d">${escape(item.title)} <span style="color:#45516a">× ${item.quantity}</span>${(item.details ?? []).map((detail) => `<br><span style="font-size:13px;color:#45516a">${escape(detail)}</span>`).join("")}</td><td align="right" style="padding:14px 0 14px 8px;border-bottom:1px solid #dcd8ce;font-size:14px;line-height:21px;color:#14213d;white-space:nowrap">${escape(money(item.unitPriceMinor * item.quantity))}</td></tr>`).join("");
  const refund = data.refundAmountMinor === undefined ? "" : `<tr><td colspan="2" style="padding:0 0 12px;font-size:14px;line-height:22px;color:#14213d"><strong>Refund amount: ${escape(money(data.refundAmountMinor))}</strong></td></tr>`;
  const tracking = (data.tracking ?? []).map(t => {
    const url = safeWebUrl(t.url);
    return `<tr><td style="padding:0 0 12px;font-size:14px;line-height:23px;color:#14213d"><strong>Shipment details</strong><br>${escape([t.carrier, t.number].filter(Boolean).join(" · "))}${url ? `<br><a href="${escape(url)}" style="color:#14213d;text-decoration:underline">Track shipment</a>` : ""}</td></tr>`;
  }).join("");
  const downloads = (data.downloads ?? []).map(d => {
    const url = safeWebUrl(d.url);
    return `<tr><td style="padding:0 0 12px;font-size:14px;line-height:23px;color:#14213d">${url ? `<a href="${escape(url)}" style="color:#14213d;text-decoration:underline">Download ${escape(d.filename)}</a>` : `Download ${escape(d.filename)}`}</td></tr>`;
  }).join("");
  const plainItems = (data.items ?? []).map(item => `${item.title} × ${item.quantity} — ${money(item.unitPriceMinor * item.quantity)}${(item.details ?? []).map((detail) => `\n  ${detail}`).join("")}`).join("\n");
  const plainTracking = (data.tracking ?? []).map(t => [t.carrier, t.number, safeWebUrl(t.url)].filter(Boolean).join(" · ")).join("\n");
  const plainDownloads = (data.downloads ?? []).map(d => `${d.filename}${safeWebUrl(d.url) ? `: ${d.url}` : ""}`).join("\n");
  const contact = data.contactEmail && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.contactEmail) ? data.contactEmail : undefined;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(template.subject)}</title><style>@media screen and (max-width: 600px){.email-padding{padding-left:20px !important;padding-right:20px !important}.email-heading{font-size:28px !important;line-height:34px !important}}</style></head>
<body style="margin:0;padding:0;background-color:#f7f4ed;color:#14213d;font-family:Aptos,'Segoe UI',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f7f4ed" style="border-collapse:collapse"><tr><td align="center" style="padding:32px 12px"><!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]--><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#fffdf8" style="width:100%;max-width:600px;border-collapse:collapse;border:1px solid #dcd8ce">
<tr><td class="email-padding" style="padding:28px 36px;border-bottom:1px solid #dcd8ce">${logoUrl ? `<img src="${escape(logoUrl)}" alt="${escape(data.brandName)}" width="150" style="display:block;width:auto;max-width:150px;max-height:64px;height:auto;border:0">` : `<span style="font-family:'Arial Rounded MT Bold','Trebuchet MS',Arial,sans-serif;font-size:22px;font-weight:bold;letter-spacing:-0.5px;color:#14213d">${escape(data.brandName)}</span>`}</td></tr>
<tr><td class="email-padding" style="padding:36px 36px 8px"><p style="margin:0 0 14px;color:#45516a;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase">Order ${escape(data.number)}</p><h1 class="email-heading" style="margin:0 0 22px;font-family:'Arial Rounded MT Bold','Trebuchet MS',Arial,sans-serif;font-size:32px;line-height:39px;color:#14213d">${escape(template.heading)}</h1><p style="margin:0 0 14px;font-size:15px;line-height:24px">Hello ${escape(data.customerName || "there")},</p><p style="margin:0 0 26px;font-size:15px;line-height:24px;color:#45516a">${lines(template.message)}</p></td></tr>
<tr><td class="email-padding" style="padding:0 36px 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;border-top:1px solid #dcd8ce"><tr><td colspan="2" style="padding:19px 0 4px;font-size:12px;line-height:18px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#45516a">Order summary</td></tr>${items}<tr><td colspan="2" style="padding:18px 0 12px;font-size:15px;line-height:22px;color:#14213d"><strong>Order total: ${escape(total)}</strong></td></tr>${refund}</table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse">${tracking}${downloads}</table>${orderUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 0;border-collapse:separate"><tr><td bgcolor="${accent}" style="background-color:${accent};border-radius:6px"><a href="${escape(orderUrl)}" style="display:inline-block;padding:15px 25px;color:${buttonColor};font-size:14px;line-height:20px;font-weight:bold;text-decoration:none">View your order</a></td></tr></table>` : ""}<p style="margin:28px 0 0;font-size:15px;line-height:24px;color:#45516a">${lines(template.closing)}</p></td></tr>
<tr><td class="email-padding" bgcolor="#f7f4ed" style="padding:24px 36px;border-top:1px solid #dcd8ce;color:#45516a;font-size:12px;line-height:20px"><strong style="color:#14213d">${escape(data.brandName)}</strong><br>Questions about your order? ${contact ? `<a href="mailto:${escape(contact)}" style="color:#14213d;text-decoration:underline">Contact the store</a>` : "Reply to this email to contact the store"}.<br>You received this transactional email about your order.</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
  const text = [data.brandName, template.heading, `Hello ${data.customerName || "there"},`, template.message, `Order ${data.number}`, plainItems, `Order total: ${total}`, data.refundAmountMinor === undefined ? "" : `Refund amount ${money(data.refundAmountMinor)}`, plainTracking, plainDownloads, orderUrl ? `View your order: ${orderUrl}` : "", template.closing, contact ? `Contact the store: ${contact}` : "Reply to this email to contact the store."].filter(Boolean).join("\n\n");
  return { subject: `${template.subject.replace(/[\r\n]/g, " ")} — ${data.number.replace(/[\r\n]/g, "")}`, text, html };
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
    async queueStatus() {
      return database.transaction(async (sql) => {
        const result = await sql.query<{ status: string; count: number }>(`SELECT "status", count(*)::int AS count FROM "OrderNotification" GROUP BY "status"`);
        return { counts: Object.fromEntries(result.rows.map(row => [row.status, row.count])) };
      });
    },
    async branding(storeId: string) { return database.transaction(async (sql) => (await sql.query(`SELECT * FROM "StoreNotificationBranding" WHERE "storeId"=$1`, [storeId])).rows[0] ?? { storeId }); },
    async template(storeId: string, type: NotificationType): Promise<NotificationTemplate> {
      const row = await database.transaction(async sql => (await sql.query(`SELECT to_jsonb(b)->'templates' AS "templates" FROM "StoreNotificationBranding" b WHERE "storeId"=$1`, [storeId])).rows[0]);
      return (row?.templates as Record<string, NotificationTemplate> | undefined)?.[type] ?? defaultNotificationTemplate(type);
    },
    async saveTemplate(storeId: string, type: NotificationType, template: NotificationTemplate) {
      await database.transaction(async sql => { await sql.query(`INSERT INTO "StoreNotificationBranding" ("storeId", "templates") VALUES ($1, jsonb_build_object($2::text, $3::jsonb)) ON CONFLICT ("storeId") DO UPDATE SET "templates" = jsonb_set("StoreNotificationBranding"."templates", ARRAY[$2::text], $3::jsonb, true)`, [storeId, type, JSON.stringify(template)]); });
      return template;
    },
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
            const live = (await sql.query(`SELECT o.*,s."name" AS "storeName",s."slug",b."brandName",b."replyTo",b."accentColor",b."logoUrl",to_jsonb(b)->'templates' AS "emailTemplates" FROM "Order" o JOIN "Store" s ON s."id"=o."storeId" LEFT JOIN "StoreNotificationBranding" b ON b."storeId"=s."id" WHERE o."storeId"=$1 AND o."id"=$2`, [job.storeId, job.orderId])).rows[0]!;
            const order = { ...live, ...(job.snapshot as Record<string, unknown> ?? {}) };
            const grants = job.type === "DIGITAL_READY" ? (await sql.query(`SELECT e.*,a."filename" FROM "DigitalEntitlement" e JOIN "DigitalAsset" a ON a."id"=e."assetId" AND a."storeId"=e."storeId" WHERE e."storeId"=$1 AND e."orderId"=$2 AND e."revokedAt" IS NULL AND (e."expiresAt" IS NULL OR e."expiresAt">CURRENT_TIMESTAMP)`, [job.storeId, job.orderId])).rows : [];
            const downloads = [];
            for (const grant of grants) {
              const token = digitalToken(String(grant.id), options.tokenSecret);
              await sql.query(`UPDATE "DigitalEntitlement" SET "tokenHash"=$2 WHERE "id"=$1`, [grant.id, hashDigitalToken(token)]);
              downloads.push({ filename: String(grant.filename), url: `${apiBaseUrl}/api/public/stores/${encodeURIComponent(String(job.storeId))}/digital/${grant.id}?token=${token}` });
            }
            const tracking = shipmentNotificationTypes.has(String(job.type)) ? (await sql.query(`SELECT carrier,"trackingNumber" AS number,"trackingUrl" AS url FROM "OrderFulfilment" WHERE "storeId"=$1 AND "orderId"=$2 ORDER BY "createdAt"`, [job.storeId, job.orderId])).rows.map((r) => ({ carrier: String(r.carrier ?? ""), number: String(r.number ?? ""), url: typeof r.url === "string" && /^https?:\/\//.test(r.url) ? r.url : undefined })) : [];
            const itemRows = Array.isArray(order.items) ? order.items as Record<string, unknown>[] : (await sql.query(`SELECT * FROM "OrderItem" WHERE "storeId"=$1 AND "orderId"=$2 ORDER BY "variantId"`, [job.storeId, job.orderId])).rows;
            const items = itemRows.map((r) => ({ title: String(r.titleSnapshot), quantity: Number(r.quantity), unitPriceMinor: Number(r.unitPriceMinor), details: lineDetails(r.configurationSnapshot) }));
            return { order, downloads, tracking, items };
          });
          const customer = content.order.customerSnapshot as { name?: string; email?: string };
          if (!customer.email) throw new Error("Order has no customer email");
          const templates = content.order.emailTemplates as Record<string, NotificationTemplate> | null;
          const rendered = renderOrderNotification(job.type as NotificationType, { brandName: String(content.order.brandName ?? content.order.storeName), customerName: customer.name, number: String(content.order.number), currency: String(content.order.currency), totalMinor: Number(content.order.totalMinor), orderUrl: `${baseUrl}/${content.order.slug}/order/${content.order.publicToken}`, accentColor: String(content.order.accentColor ?? ""), logoUrl: content.order.logoUrl as string | null, downloads: content.downloads, tracking: content.tracking, items: content.items, refundAmountMinor: typeof content.order.refundAmountMinor === "number" ? content.order.refundAmountMinor : undefined, contactEmail: typeof content.order.replyTo === "string" ? content.order.replyTo : undefined }, templates?.[String(job.type)]);
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




/** An order line's choices and personalisation as "Name: value", for emails. */
export function lineDetails(snapshot: unknown): string[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot.flatMap((entry) => {
    const item = entry as { optionName?: unknown; valueLabel?: unknown } | null;
    return item && typeof item.optionName === "string" && typeof item.valueLabel === "string" ? [`${item.optionName}: ${item.valueLabel}`] : [];
  }).slice(0, 12);
}
