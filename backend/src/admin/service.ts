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
  sku: string | null;
  quantity: number;
}

export interface AdminSummary {
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
  constructor(private readonly repository: CommerceRepository) {}

  async getSummary(storeId: string): Promise<AdminSummary> {
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
        SELECT p."id" AS "productId", v."id" AS "variantId", p."title", v."sku", i."quantity"
        FROM "InventoryLevel" i JOIN "ProductVariant" v ON v."storeId" = i."storeId" AND v."id" = i."variantId"
        JOIN "Product" p ON p."storeId" = v."storeId" AND p."id" = v."productId"
        WHERE i."storeId" = $1 AND i."quantity" <= 3 AND p."status" = 'ACTIVE' AND v."archivedAt" IS NULL
        ORDER BY i."quantity", p."title", v."title" LIMIT 5`, [storeId]);
      return { revenueMinor: totals.rows[0]?.revenueMinor ?? 0, orderCount: totals.rows[0]?.orderCount ?? 0, publishedProductCount: products.rows[0]?.publishedProductCount ?? 0, actionableOrders: actionableOrders.rows, lowStock: lowStock.rows };
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
