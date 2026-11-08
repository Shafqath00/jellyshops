import type { CommerceRepository, CommerceTransaction } from "../commerce/repository.js";

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
  orderCount: number;
  lifetimeSpendMinor: number;
  latestOrderAt: Date | null;
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

export class CustomerService {
  constructor(private readonly repository: CommerceRepository) {}

  async list(storeId: string): Promise<MerchantCustomer[]> {
    return this.repository.transaction(async (tx) => {
      const result = await tx.query<MerchantCustomer>(`
        SELECT CONCAT('email:', lower(COALESCE(o."customerSnapshot"->>'email', 'unknown'))) AS "id",
          COALESCE(NULLIF(o."customerSnapshot"->>'name', ''), 'Customer') AS "name",
          NULLIF(lower(o."customerSnapshot"->>'email'), '') AS "email",
          COUNT(*)::int AS "orderCount", COALESCE(SUM(o."totalMinor") FILTER (WHERE p."status" = 'PAID'), 0)::int AS "lifetimeSpendMinor",
          MAX(o."createdAt") AS "latestOrderAt"
        FROM "Order" o LEFT JOIN "Payment" p ON p."storeId" = o."storeId" AND p."orderId" = o."id"
        WHERE o."storeId" = $1 GROUP BY 1, 2, 3 ORDER BY "latestOrderAt" DESC`, [storeId]);
      return result.rows;
    });
  }

  async get(storeId: string, customerId: string): Promise<MerchantCustomerDetail | null> {
    return this.repository.transaction(async (tx) => {
      const email = customerId.startsWith("email:") ? customerId.slice("email:".length).toLowerCase() : "";
      if (!email) return null;
      const customer = await tx.query<MerchantCustomer>(`
        SELECT CONCAT('email:', lower(o."customerSnapshot"->>'email')) AS "id", COALESCE(NULLIF(o."customerSnapshot"->>'name', ''), 'Customer') AS "name",
          lower(o."customerSnapshot"->>'email') AS "email", COUNT(*)::int AS "orderCount",
          COALESCE(SUM(o."totalMinor") FILTER (WHERE p."status" = 'PAID'), 0)::int AS "lifetimeSpendMinor", MAX(o."createdAt") AS "latestOrderAt"
        FROM "Order" o LEFT JOIN "Payment" p ON p."storeId" = o."storeId" AND p."orderId" = o."id"
        WHERE o."storeId" = $1 AND lower(o."customerSnapshot"->>'email') = $2 GROUP BY 1, 2, 3`, [storeId, email]);
      const row = customer.rows[0];
      if (!row) return null;
      const orders = await tx.query<AdminOrder>(`
        SELECT o.*, p."status" AS "paymentStatus", p."paymentIntentId", p."chargeId" FROM "Order" o
        LEFT JOIN "Payment" p ON p."storeId" = o."storeId" AND p."orderId" = o."id"
        WHERE o."storeId" = $1 AND lower(o."customerSnapshot"->>'email') = $2 ORDER BY o."createdAt" DESC`, [storeId, email]);
      return { ...row, orders: orders.rows };
    });
  }
}
