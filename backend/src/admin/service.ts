import { randomUUID } from "node:crypto";
import type { CommerceRepository, CommerceTransaction } from "../commerce/repository.js";
import { ApiError } from "../http/errors.js";

export interface AdminOrder {
  id: string;
  number: string;
  status: string;
  customerSnapshot: Record<string, unknown>;
  totalMinor: number;
  currency: string;
  createdAt: Date;
  paymentStatus: string | null;
  paymentIntentId: string | null;
  chargeId: string | null;
}

export interface AdminLowStockItem {
  productId: string;
  variantId: string;
  title: string;
  /** Option names such as "Double / Without storage", or null for a product with one variant. */
  variantTitle: string | null;
  sku: string | null;
  /** What shoppers can still buy: on hand minus what checkouts are holding. */
  available: number;
  quantity: number;
}

export const SALES_PERIODS = [1, 7, 30, 90] as const;
export type SalesPeriod = (typeof SALES_PERIODS)[number];
export interface SalesFigures { revenueMinor: number; paidOrders: number; averageOrderMinor: number }
export interface AdminSales {
  days: SalesPeriod;
  timezone: string;
  current: SalesFigures;
  /** The same number of days just before the current period, for "compared with" figures. */
  previous: SalesFigures;
  /** One entry per day of the current period in the store's time zone, oldest first. */
  daily: Array<{ date: string; revenueMinor: number; paidOrders: number }>;
}

export interface AdminSummary {
  timezone: string;
  setup: { details: boolean; products: boolean; publication: boolean; shipping: boolean; payments: boolean };
  revenueMinor: number;
  orderCount: number;
  publishedProductCount: number;
  actionableOrders: AdminOrder[];
  lowStock: AdminLowStockItem[];
}

export interface MerchantCustomer {
  id: string;
  name: string;
  email: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  note: string;
  tags: string[];
  address: Record<string, string> | null;
  /** "London, GB" from the saved address or the latest order. */
  location: string | null;
  acceptsEmailMarketing: boolean;
  /** Orders that were not cancelled. */
  orderCount: number;
  lifetimeSpendMinor: number;
  latestOrderAt: Date | null;
  /** When the merchant added or first edited them; null for customers known only from orders. */
  createdAt: Date | null;
  revision: number;
}

export interface MerchantCustomerDetail extends MerchantCustomer {
  orders: AdminOrder[];
}

export class AdminSummaryService {
  constructor(private readonly repository: CommerceRepository, private readonly paymentReady?: (storeId: string) => Promise<boolean>) {}

  async getSummary(storeId: string): Promise<AdminSummary> {
    const payments = await this.paymentReady?.(storeId).catch(() => false) ?? false;
    return this.repository.transaction(async (tx) => {
      const totals = await tx.query<{ revenueMinor: number; orderCount: number }>(`
        SELECT COALESCE(SUM(o."totalMinor") FILTER (WHERE p."status" = 'PAID' AND o."status" <> 'CANCELLED'), 0)::int AS "revenueMinor",
          COUNT(o."id")::int AS "orderCount"
        FROM "Order" o LEFT JOIN "Payment" p ON p."storeId" = o."storeId" AND p."orderId" = o."id"
        WHERE o."storeId" = $1`, [storeId]);
      const products = await tx.query<{ publishedProductCount: number }>(`
        SELECT COUNT(*)::int AS "publishedProductCount" FROM "Product"
        WHERE "storeId" = $1 AND "status" = 'ACTIVE'`, [storeId]);
      const actionableOrders = await tx.query<AdminOrder>(`
        SELECT o.*, p."status" AS "paymentStatus", p."paymentIntentId", p."chargeId"
        FROM "Order" o LEFT JOIN "Payment" p ON p."storeId" = o."storeId" AND p."orderId" = o."id"
        WHERE o."storeId" = $1 AND o."status" NOT IN ('DELIVERED', 'CANCELLED', 'REFUNDED')
        ORDER BY o."createdAt" DESC LIMIT 4`, [storeId]);
      const lowStock = await tx.query<AdminLowStockItem>(`
        SELECT p."id" AS "productId", v."id" AS "variantId", p."title",
          CASE WHEN (SELECT COUNT(*) FROM "ProductVariant" s WHERE s."storeId" = v."storeId" AND s."productId" = v."productId" AND s."archivedAt" IS NULL) > 1 THEN NULLIF(v."title", '') END AS "variantTitle",
          v."sku", i."quantity", GREATEST(i."quantity" - i."reserved", 0)::int AS "available"
        FROM "InventoryLevel" i JOIN "ProductVariant" v ON v."storeId" = i."storeId" AND v."id" = i."variantId"
        JOIN "Product" p ON p."storeId" = v."storeId" AND p."id" = v."productId"
        WHERE i."storeId" = $1 AND v."trackInventory" = true AND i."quantity" - i."reserved" <= COALESCE(v."lowStockThreshold", 3)
          AND p."status" = 'ACTIVE' AND v."archivedAt" IS NULL
        ORDER BY i."quantity" - i."reserved", p."title", v."title" LIMIT 5`, [storeId]);
      const configuration = await tx.query<{ timezone: string; details: boolean; publication: boolean; shipping: boolean }>(`
        SELECT COALESCE(ss."timezone", 'UTC') AS "timezone",
          (length(trim(s."name")) > 0 AND length(trim(s."slug")) > 0) AS "details",
          (s."currentPublicationId" IS NOT NULL) AS "publication",
          (ss."storeId" IS NOT NULL AND ss."shippingMinor" >= 0) AS "shipping"
        FROM "Store" s LEFT JOIN "StoreSettings" ss ON ss."storeId" = s."id"
        WHERE s."id" = $1`, [storeId]);
      const settings = configuration.rows[0];
      const publishedProductCount = products.rows[0]?.publishedProductCount ?? 0;
      return { timezone: settings?.timezone ?? "UTC", setup: { details: settings?.details ?? false, products: publishedProductCount > 0, publication: settings?.publication ?? false, shipping: settings?.shipping ?? false, payments }, revenueMinor: totals.rows[0]?.revenueMinor ?? 0, orderCount: totals.rows[0]?.orderCount ?? 0, publishedProductCount, actionableOrders: actionableOrders.rows, lowStock: lowStock.rows };
    });
  }
}

const figures = (row?: { revenueMinor?: number; paidOrders?: number }): SalesFigures => {
  const revenueMinor = Number(row?.revenueMinor ?? 0), paidOrders = Number(row?.paidOrders ?? 0);
  return { revenueMinor, paidOrders, averageOrderMinor: paidOrders ? Math.round(revenueMinor / paidOrders) : 0 };
};

/** Sales count paid orders that were not cancelled, the same rule as the dashboard total. */
export class AdminSalesService {
  constructor(private readonly repository: CommerceRepository, private readonly now: () => Date = () => new Date()) {}

  async getSales(storeId: string, days: SalesPeriod): Promise<AdminSales> {
    const now = this.now();
    return this.repository.transaction(async (tx) => {
      const settings = await tx.query<{ timezone: string }>(`SELECT COALESCE("timezone", 'UTC') AS "timezone" FROM "StoreSettings" WHERE "storeId" = $1`, [storeId]);
      const timezone = settings.rows[0]?.timezone ?? "UTC";
      const start = new Date(now.getTime() - days * 86_400_000), before = new Date(now.getTime() - 2 * days * 86_400_000);
      const paid = `FROM "Order" o JOIN "Payment" p ON p."storeId" = o."storeId" AND p."orderId" = o."id"
        WHERE o."storeId" = $1 AND p."status" = 'PAID' AND o."status" <> 'CANCELLED'`;
      const totals = await tx.query<{ period: string; revenueMinor: number; paidOrders: number }>(`
        SELECT CASE WHEN o."createdAt" >= $2 THEN 'current' ELSE 'previous' END AS "period",
          COALESCE(SUM(o."totalMinor"), 0)::int AS "revenueMinor", COUNT(*)::int AS "paidOrders"
        ${paid} AND o."createdAt" >= $3 AND o."createdAt" < $4 GROUP BY 1`, [storeId, start, before, now]);
      const daily = await tx.query<{ date: string; revenueMinor: number; paidOrders: number }>(`
        SELECT to_char(o."createdAt" AT TIME ZONE $3, 'YYYY-MM-DD') AS "date",
          COALESCE(SUM(o."totalMinor"), 0)::int AS "revenueMinor", COUNT(*)::int AS "paidOrders"
        ${paid} AND o."createdAt" >= $2 AND o."createdAt" < $4 GROUP BY 1`, [storeId, start, timezone, now]);
      const byDate = new Map(daily.rows.map((row) => [row.date, row]));
      const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
      const series = Array.from({ length: days }, (_, index) => {
        const date = dayKey.format(new Date(now.getTime() - (days - 1 - index) * 86_400_000));
        const row = byDate.get(date);
        return { date, revenueMinor: Number(row?.revenueMinor ?? 0), paidOrders: Number(row?.paidOrders ?? 0) };
      });
      return {
        days, timezone,
        current: figures(totals.rows.find((row) => row.period === "current")),
        previous: figures(totals.rows.find((row) => row.period === "previous")),
        daily: series,
      };
    });
  }
}

export interface CustomerAddressInput { line1?: string; line2?: string; city?: string; region?: string; postalCode?: string; country?: string }
export interface CustomerProfileInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  note?: string;
  tags?: string[];
  address?: CustomerAddressInput | null;
  /** Email marketing consent. Stored in "NewsletterSubscriber", the store's one record of consent. */
  acceptsEmailMarketing?: boolean;
}

const customerId = (email: string) => `email:${email}`;
const emailOf = (id: string) => id.startsWith("email:") ? id.slice("email:".length).trim().toLowerCase() : "";
const cleanTags = (tags: string[] = []) => [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 50);
const jsonOrNull = (value: unknown) => value == null ? null : JSON.stringify(value);
const cleanAddress = (address?: CustomerAddressInput | null) => {
  if (!address) return null;
  const entries = Object.entries(address).flatMap(([key, value]) => typeof value === "string" && value.trim() ? [[key, value.trim()]] : []);
  return entries.length ? Object.fromEntries(entries) as Record<string, string> : null;
};

/**
 * Customers are everyone who has ordered (grouped by email) plus everyone the merchant added by hand.
 * A merchant's edits live in "CustomerProfile"; order history is never changed.
 */
const CUSTOMER_ROWS = `
  WITH ordered AS (
    SELECT lower(o."customerSnapshot"->>'email') AS "email",
      (array_agg(NULLIF(o."customerSnapshot"->>'name', '') ORDER BY o."createdAt" DESC))[1] AS "orderName",
      (array_agg(o."customerSnapshot"->'address' ORDER BY o."createdAt" DESC))[1] AS "orderAddress",
      COUNT(*) FILTER (WHERE o."status" <> 'CANCELLED')::int AS "orderCount",
      COALESCE(SUM(o."totalMinor") FILTER (WHERE p."status" = 'PAID' AND o."status" <> 'CANCELLED'), 0)::int AS "lifetimeSpendMinor",
      MAX(o."createdAt") AS "latestOrderAt"
    FROM "Order" o LEFT JOIN "Payment" p ON p."storeId" = o."storeId" AND p."orderId" = o."id"
    WHERE o."storeId" = $1 AND COALESCE(o."customerSnapshot"->>'email', '') <> '' GROUP BY 1
  ), people AS (
    SELECT COALESCE(c."email", o."email") AS "email", c."firstName", c."lastName", c."phone", c."note", c."tags", c."address",
      c."revision", c."createdAt" AS "profileCreatedAt", o."orderName", o."orderAddress",
      COALESCE(o."orderCount", 0) AS "orderCount", COALESCE(o."lifetimeSpendMinor", 0) AS "lifetimeSpendMinor", o."latestOrderAt"
    FROM ordered o FULL OUTER JOIN (SELECT * FROM "CustomerProfile" WHERE "storeId" = $1) c ON c."email" = o."email"
  )
  SELECT people.*, (n."id" IS NOT NULL AND n."unsubscribedAt" IS NULL) AS "acceptsEmailMarketing"
  FROM people LEFT JOIN "NewsletterSubscriber" n ON n."storeId" = $1 AND lower(n."email") = people."email"`;

type CustomerRow = {
  email: string; firstName: string | null; lastName: string | null; phone: string | null; note: string | null; tags: string[] | null;
  address: Record<string, string> | null; revision: number | null; profileCreatedAt: Date | null; orderName: string | null;
  orderAddress: Record<string, unknown> | null; orderCount: number; lifetimeSpendMinor: number; latestOrderAt: Date | null; acceptsEmailMarketing: boolean;
};

function toCustomer(row: CustomerRow): MerchantCustomer {
  const fullName = [row.firstName, row.lastName].filter((part) => part?.trim()).join(" ");
  const address = (row.address ?? row.orderAddress ?? null) as Record<string, unknown> | null;
  const location = address ? [address.city, address.country].filter((part) => typeof part === "string" && part).join(", ") : "";
  return {
    id: customerId(row.email), name: fullName || row.orderName || row.email, email: row.email,
    firstName: row.firstName ?? "", lastName: row.lastName ?? "", phone: row.phone ?? "", note: row.note ?? "", tags: row.tags ?? [],
    address: row.address ?? null, location: location || null, acceptsEmailMarketing: Boolean(row.acceptsEmailMarketing),
    orderCount: Number(row.orderCount), lifetimeSpendMinor: Number(row.lifetimeSpendMinor), latestOrderAt: row.latestOrderAt,
    createdAt: row.profileCreatedAt, revision: row.revision ?? 0,
  };
}

async function setConsent(tx: CommerceTransaction, storeId: string, email: string, subscribed: boolean) {
  if (subscribed) {
    await tx.query(`INSERT INTO "NewsletterSubscriber" ("id","storeId","email","source") VALUES ($1,$2,$3,'admin')
      ON CONFLICT ("storeId","email") DO UPDATE SET "unsubscribedAt"=NULL,"consentAt"=NOW()`, [`sub_${randomUUID()}`, storeId, email]);
  } else {
    await tx.query(`UPDATE "NewsletterSubscriber" SET "unsubscribedAt"=NOW() WHERE "storeId"=$1 AND lower("email")=$2 AND "unsubscribedAt" IS NULL`, [storeId, email]);
  }
}

/** Tags on an order, for the merchant's own sorting ("gift", "wholesale"). */
export class OrderTagService {
  constructor(private readonly repository: CommerceRepository) {}

  async setTags(storeId: string, orderId: string, tags: string[]): Promise<string[]> {
    const clean = cleanTags(tags);
    return this.repository.transaction(async (tx) => {
      const result = await tx.query<{ tags: string[] }>(`UPDATE "Order" SET "tags" = $3, "updatedAt" = NOW() WHERE "storeId" = $1 AND "id" = $2 RETURNING "tags"`, [storeId, orderId, clean]);
      if (!result.rows[0]) throw new ApiError(404, "NOT_FOUND", "This order was not found.");
      return result.rows[0].tags;
    });
  }
}

export class CustomerService {
  constructor(private readonly repository: CommerceRepository) {}

  async list(storeId: string): Promise<MerchantCustomer[]> {
    return this.repository.transaction(async (tx) => {
      const result = await tx.query<CustomerRow>(`${CUSTOMER_ROWS} ORDER BY COALESCE(people."latestOrderAt", people."profileCreatedAt") DESC NULLS LAST, people."email"`, [storeId]);
      return result.rows.map(toCustomer);
    });
  }

  async get(storeId: string, id: string): Promise<MerchantCustomerDetail | null> {
    const email = emailOf(id);
    if (!email) return null;
    return this.repository.transaction(async (tx) => {
      const found = await tx.query<CustomerRow>(`${CUSTOMER_ROWS} WHERE people."email" = $2`, [storeId, email]);
      if (!found.rows[0]) return null;
      const orders = await tx.query<AdminOrder>(`
        SELECT o.*, p."status" AS "paymentStatus", p."paymentIntentId", p."chargeId" FROM "Order" o
        LEFT JOIN "Payment" p ON p."storeId" = o."storeId" AND p."orderId" = o."id"
        WHERE o."storeId" = $1 AND lower(o."customerSnapshot"->>'email') = $2 ORDER BY o."createdAt" DESC`, [storeId, email]);
      return { ...toCustomer(found.rows[0]), orders: orders.rows };
    });
  }

  /** Adds a customer by hand. Refused when the email already belongs to a customer of this store. */
  async create(storeId: string, input: CustomerProfileInput & { email: string }): Promise<MerchantCustomerDetail> {
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(422, "EMAIL_INVALID", "Enter a valid email address.");
    await this.repository.transaction(async (tx) => {
      const existing = await tx.query(`${CUSTOMER_ROWS} WHERE people."email" = $2`, [storeId, email]);
      if (existing.rows.length) throw new ApiError(409, "CUSTOMER_EXISTS", "A customer with this email already exists. Open them from the customer list.");
      await tx.query(`INSERT INTO "CustomerProfile" ("id","storeId","email","firstName","lastName","phone","note","tags","address") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [`cust_${randomUUID()}`, storeId, email, input.firstName?.trim() ?? "", input.lastName?.trim() ?? "", input.phone?.trim() ?? "", input.note?.trim() ?? "", cleanTags(input.tags), jsonOrNull(cleanAddress(input.address))]);
      if (input.acceptsEmailMarketing !== undefined) await setConsent(tx, storeId, email, input.acceptsEmailMarketing);
    });
    return (await this.get(storeId, customerId(email)))!;
  }

  /** Saves the merchant's edits. A customer known only from orders gets a profile on the first edit. */
  async update(storeId: string, id: string, input: CustomerProfileInput & { revision?: number }): Promise<MerchantCustomerDetail> {
    const email = emailOf(id);
    const current = email ? await this.get(storeId, id) : null;
    if (!current) throw new ApiError(404, "NOT_FOUND", "This customer was not found.");
    if (input.revision !== undefined && input.revision !== current.revision) throw new ApiError(409, "CUSTOMER_CHANGED", "Someone else changed this customer. Reload and try again.");
    const next = {
      firstName: input.firstName?.trim() ?? current.firstName, lastName: input.lastName?.trim() ?? current.lastName, phone: input.phone?.trim() ?? current.phone,
      note: input.note?.trim() ?? current.note, tags: input.tags ? cleanTags(input.tags) : current.tags, address: input.address !== undefined ? cleanAddress(input.address) : current.address,
    };
    await this.repository.transaction(async (tx) => {
      await tx.query(`INSERT INTO "CustomerProfile" ("id","storeId","email","firstName","lastName","phone","note","tags","address") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
        ON CONFLICT ("storeId","email") DO UPDATE SET "firstName"=EXCLUDED."firstName","lastName"=EXCLUDED."lastName","phone"=EXCLUDED."phone","note"=EXCLUDED."note",
        "tags"=EXCLUDED."tags","address"=EXCLUDED."address","revision"="CustomerProfile"."revision"+1,"updatedAt"=NOW()`,
        [`cust_${randomUUID()}`, storeId, email, next.firstName, next.lastName, next.phone, next.note, next.tags, jsonOrNull(next.address)]);
      if (input.acceptsEmailMarketing !== undefined && input.acceptsEmailMarketing !== current.acceptsEmailMarketing) await setConsent(tx, storeId, email, input.acceptsEmailMarketing);
    });
    return (await this.get(storeId, id))!;
  }
}
