import type { CatalogInventoryQuantity } from "../catalog/types.js";
import type { QueryResultRow } from "pg";

export interface SqlExecutor {
  query<Row extends QueryResultRow = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

export interface CommerceDatabase {
  transaction<T>(work: (sql: SqlExecutor) => Promise<T>): Promise<T>;
}

interface TransactionPool {
  connect(): Promise<SqlExecutor & { release(error?: Error | boolean): void }>;
}

/** Owns exactly one connection for the whole transaction, including the lock. */
export function postgresCommerceDatabase(pool: TransactionPool): CommerceDatabase {
  return {
    async transaction(work) {
      const client = await pool.connect();
      let broken = false;
      try {
        await client.query("BEGIN");
        const result = await work(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try { await client.query("ROLLBACK"); } catch { broken = true; }
        throw error;
      } finally {
        if (broken) client.release(true);
        else client.release();
      }
    },
  };
}

export interface ReserveVariantsInput {
  storeId: string;
  attemptId: string;
  items: CatalogInventoryQuantity[];
}

export interface InventoryReservationRow {
  attemptId: string;
  storeId: string;
  variantId: string;
  quantity: number;
  status: "HELD" | "RELEASED" | "SOLD";
  expiresAt: Date;
}

export interface CheckoutAttemptRow {
  id: string;
  orderId: string;
  storeId: string;
  cartKey: string;
  cartHash: string;
  stripeIdempotencyKey: string;
  paymentIntentId: string | null;
  status: "PAYMENT_INTENT_CREATING" | "READY" | "PROCESSING" | "SUCCEEDED" | "CANCELLED" | "EXPIRED" | "FAILED";
  expiresAt: Date;
  createdAt: Date;
}

export interface OrderRow {
  id: string;
  storeId: string;
  number: string;
  publicToken: string;
  status: "PENDING_PAYMENT" | "PAID" | "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
  fulfilmentStartedAt: Date | null;
  customerSnapshot: Record<string, unknown>;
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRow {
  id: string;
  storeId: string;
  orderId: string;
  stripeAccountId: string;
  paymentIntentId: string | null;
  chargeId: string | null;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
  amountMinor: number;
  currency: string;
}

export interface StripeConnectedAccountRow {
  storeId: string;
  stripeAccountId: string;
  cardPaymentsStatus: string;
  payoutsStatus: string;
  requirements: Record<string, unknown>;
  closedAt: Date | null;
}

export interface OrderItemRow {
  orderId: string;
  storeId: string;
  variantId: string;
  titleSnapshot: string;
  skuSnapshot: string | null;
  imageSnapshot: string | null;
  unitPriceMinor: number;
  quantity: number;
}

export interface RefundRow {
  id: string;
  storeId: string;
  orderId: string;
  paymentId: string;
  stripeRefundId: string | null;
  amountMinor: number;
  status: "PENDING" | "REQUIRES_ACTION" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  inventoryRestoredAt: Date | null;
}

export interface PaymentDisputeRow {
  storeId: string;
  paymentId: string;
  stripeDisputeId: string;
  status: "warning_needs_response" | "warning_under_review" | "warning_closed" | "needs_response" | "under_review" | "won" | "lost" | "prevented";
}

export interface StripeWebhookEventRow {
  id: string;
  endpointFamily: "accounts-v2" | "connect-payments";
  stripeEventId: string;
  stripeAccountId: string | null;
  type: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
  processedAt: Date | null;
}

export interface WebhookProcessingAttemptRow {
  eventId: string;
  attemptNo: number;
  errorMessage: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface PublicOrderAccessRateLimitRow {
  storeId: string;
  ipHash: string;
  windowStartedAt: Date;
  requestCount: number;
}

/** Transaction-bound operations; callers can atomically combine order writes
 * with reservation replacement. Never retain this object after work returns. */
export class CommerceTransaction implements SqlExecutor {
  constructor(private readonly sql: SqlExecutor) {}

  query<Row extends QueryResultRow = Record<string, unknown>>(statement: string, values?: unknown[]) {
    return this.sql.query<Row>(statement, values);
  }

  async reserveVariants(input: ReserveVariantsInput): Promise<InventoryReservationRow[]> {
    const items = [...input.items].sort((a, b) => a.variantId.localeCompare(b.variantId));
    if (items.length === 0 || items.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity <= 0)) {
      throw new Error("Reservation quantity must be a positive integer");
    }
    if (new Set(items.map((item) => item.variantId)).size !== items.length) {
      throw new Error("Duplicate reservation variant");
    }
    const { rows: attempts } = await this.query<CheckoutAttemptRow>(
      `SELECT * FROM "CheckoutAttempt" WHERE "id" = $1 AND "storeId" = $2
       AND "status" IN ('PAYMENT_INTENT_CREATING', 'READY') AND "expiresAt" > CURRENT_TIMESTAMP FOR UPDATE`,
      [input.attemptId, input.storeId],
    );
    if (!attempts[0]) throw new Error("Checkout attempt unavailable");
    const existing = (await this.query<InventoryReservationRow>(
      `SELECT * FROM "InventoryReservation" WHERE "attemptId" = $1 ORDER BY "variantId"`, [input.attemptId],
    )).rows;
    if (existing.length > 0) {
      if (existing.length !== items.length || items.some((item) => !existing.some((row) =>
        row.variantId === item.variantId && row.quantity === item.quantity && row.status === "HELD"))) {
        throw new Error("Reservation does not match existing attempt");
      }
      return existing;
    }
    const reservations: InventoryReservationRow[] = [];
    for (const item of items) {
      const { rows } = await this.query(
        `UPDATE "InventoryLevel" SET "reserved" = "reserved" + $3, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "storeId" = $1 AND "variantId" = $2 AND "quantity" - "reserved" >= $3 RETURNING *`,
        [input.storeId, item.variantId, item.quantity],
      );
      if (rows.length === 0) throw new Error(`Insufficient inventory: ${item.variantId}`);
      const inserted = await this.query<InventoryReservationRow>(
        `INSERT INTO "InventoryReservation" ("attemptId", "storeId", "variantId", "quantity", "expiresAt")
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [input.attemptId, input.storeId, item.variantId, item.quantity, attempts[0].expiresAt],
      );
      reservations.push(inserted.rows[0]);
    }
    return reservations;
  }

  releaseAttempt(attemptId: string): Promise<number> {
    return this.transitionReservations(attemptId, "RELEASED");
  }

  convertAttemptToSold(attemptId: string): Promise<number> {
    return this.transitionReservations(attemptId, "SOLD");
  }

  private async transitionReservations(attemptId: string, status: "RELEASED" | "SOLD"): Promise<number> {
    // Use the same attempt lock as reservation creation, including empty holds.
    await this.query(`SELECT "id" FROM "CheckoutAttempt" WHERE "id" = $1 FOR UPDATE`, [attemptId]);
    const { rows } = await this.query<InventoryReservationRow>(
      `UPDATE "InventoryReservation" SET "status" = $2 WHERE "attemptId" = $1 AND "status" = 'HELD' RETURNING *`,
      [attemptId, status],
    );
    rows.sort((a, b) => a.variantId.localeCompare(b.variantId));
    for (const row of rows) {
      const result = await this.query(
        `UPDATE "InventoryLevel" SET "reserved" = "reserved" - $3,
          "quantity" = "quantity" - $4, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "storeId" = $1 AND "variantId" = $2 AND "reserved" >= $3 RETURNING *`,
        [row.storeId, row.variantId, row.quantity, status === "SOLD" ? row.quantity : 0],
      );
      if (result.rows.length !== 1) throw new Error("Reservation inventory invariant violated");
    }
    return rows.length;
  }
}

export class CommerceRepository {
  constructor(private readonly database: CommerceDatabase) {}

  transaction<T>(work: (tx: CommerceTransaction) => Promise<T>): Promise<T> {
    return this.database.transaction((sql) => work(new CommerceTransaction(sql)));
  }

  withCheckoutLock<T>(storeId: string, cartKey: string, work: (tx: CommerceTransaction) => Promise<T>): Promise<T> {
    return this.transaction(async (tx) => {
      // JSON avoids ambiguous concatenation across store/cart pairs.
      await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [JSON.stringify([storeId, cartKey])]);
      return work(tx);
    });
  }

  reserveVariants(input: ReserveVariantsInput): Promise<InventoryReservationRow[]> {
    return this.transaction((tx) => tx.reserveVariants(input));
  }

  releaseAttempt(attemptId: string): Promise<number> {
    return this.transaction((tx) => tx.releaseAttempt(attemptId));
  }

  convertAttemptToSold(attemptId: string): Promise<number> {
    return this.transaction((tx) => tx.convertAttemptToSold(attemptId));
  }

  async getPublicOrder(storeId: string, publicToken: string): Promise<{ order: OrderRow; items: OrderItemRow[]; payment: PaymentRow | null } | null> {
    return this.database.transaction(async (sql) => {
      const order = (await sql.query<OrderRow>(
        `SELECT * FROM "Order" WHERE "storeId" = $1 AND "publicToken" = $2`, [storeId, publicToken],
      )).rows[0];
      if (!order) return null;
      const items = (await sql.query<OrderItemRow>(
        `SELECT * FROM "OrderItem" WHERE "storeId" = $1 AND "orderId" = $2 ORDER BY "variantId"`, [storeId, order.id],
      )).rows;
      const payment = (await sql.query<PaymentRow>(
        `SELECT * FROM "Payment" WHERE "storeId" = $1 AND "orderId" = $2`, [storeId, order.id],
      )).rows[0] ?? null;
      return { order, items, payment };
    });
  }
}
