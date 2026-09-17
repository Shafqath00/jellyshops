import type { QueryResultRow } from "pg";

import type { CatalogInventoryQuantity } from "../catalog/types.js";

/* -------------------------------------------------------------------------- */
/* Database                                                                   */
/* -------------------------------------------------------------------------- */

export interface SqlExecutor {
  query<Row extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Row[] }>;
}

export interface CommerceDatabase {
  transaction<T>(
    work: (sql: SqlExecutor) => Promise<T>,
  ): Promise<T>;
}

interface TransactionClient extends SqlExecutor {
  release(error?: Error | boolean): void;
}

interface TransactionPool {
  connect(): Promise<TransactionClient>;
}

/**
 * Runs all transaction work on one PostgreSQL connection.
 */
export function postgresCommerceDatabase(
  pool: TransactionPool,
): CommerceDatabase {
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
        try {
          await client.query("ROLLBACK");
        } catch {
          broken = true;
        }

        throw error;
      } finally {
        client.release(broken || undefined);
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Commerce rows                                                              */
/* -------------------------------------------------------------------------- */

export type ReservationStatus =
  | "HELD"
  | "RELEASED"
  | "SOLD";

export type CheckoutAttemptStatus =
  | "PAYMENT_INTENT_CREATING"
  | "READY"
  | "PROCESSING"
  | "SUCCEEDED"
  | "CANCELLED"
  | "EXPIRED"
  | "FAILED";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

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
  status: ReservationStatus;
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
  status: CheckoutAttemptStatus;
  expiresAt: Date;
  createdAt: Date;
}

export interface OrderRow {
  id: string;
  storeId: string;
  number: string;
  publicToken: string;
  status: OrderStatus;
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
  status: PaymentStatus;
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
  status:
    | "PENDING"
    | "REQUIRES_ACTION"
    | "SUCCEEDED"
    | "FAILED"
    | "CANCELLED";
  inventoryRestoredAt: Date | null;
}

export interface PaymentDisputeRow {
  storeId: string;
  paymentId: string;
  stripeDisputeId: string;
  status:
    | "warning_needs_response"
    | "warning_under_review"
    | "warning_closed"
    | "needs_response"
    | "under_review"
    | "won"
    | "lost"
    | "prevented";
}

export interface StripeWebhookEventRow {
  id: string;
  endpointFamily:
    | "accounts-v2"
    | "connect-payments";
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

/* -------------------------------------------------------------------------- */
/* Transaction                                                                */
/* -------------------------------------------------------------------------- */

function validateReservationItems(
  items: CatalogInventoryQuantity[],
): void {
  if (items.length === 0) {
    throw new Error(
      "Reservation requires at least one item",
    );
  }

  const invalidQuantity = items.some(
    (item) =>
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0,
  );

  if (invalidQuantity) {
    throw new Error(
      "Reservation quantity must be a positive integer",
    );
  }

  const variantIds = items.map(
    (item) => item.variantId,
  );

  if (
    new Set(variantIds).size !== variantIds.length
  ) {
    throw new Error(
      "Duplicate reservation variant",
    );
  }
}

/**
 * Operations that must run inside one database transaction.
 *
 * Never retain this object after the transaction callback returns.
 */
export class CommerceTransaction
  implements SqlExecutor
{
  constructor(
    private readonly sql: SqlExecutor,
  ) {}

  query<Row extends QueryResultRow = Record<string, unknown>>(
    statement: string,
    values?: unknown[],
  ) {
    return this.sql.query<Row>(
      statement,
      values,
    );
  }

  async reserveVariants(
    input: ReserveVariantsInput,
  ): Promise<InventoryReservationRow[]> {
    const items = [...input.items].sort(
      (a, b) =>
        a.variantId.localeCompare(b.variantId),
    );

    validateReservationItems(items);

    const attempt = await this.getReservableAttempt(
      input.storeId,
      input.attemptId,
    );

    const existing =
      await this.getExistingReservations(
        input.attemptId,
      );

    if (existing.length > 0) {
      this.assertReservationsMatch(
        existing,
        items,
      );

      return existing;
    }

    const reservations: InventoryReservationRow[] =
      [];

    for (const item of items) {
      await this.reserveInventory(
        input.storeId,
        item.variantId,
        item.quantity,
      );

      const reservation =
        await this.createReservation(
          input,
          item,
          attempt.expiresAt,
        );

      reservations.push(reservation);
    }

    return reservations;
  }

  releaseAttempt(
    attemptId: string,
  ): Promise<number> {
    return this.transitionReservations(
      attemptId,
      "RELEASED",
    );
  }

  convertAttemptToSold(
    attemptId: string,
  ): Promise<number> {
    return this.transitionReservations(
      attemptId,
      "SOLD",
    );
  }

  private async getReservableAttempt(
    storeId: string,
    attemptId: string,
  ): Promise<CheckoutAttemptRow> {
    const result =
      await this.query<CheckoutAttemptRow>(
        `
          SELECT *
          FROM "CheckoutAttempt"
          WHERE "id" = $1
            AND "storeId" = $2
            AND "status" IN (
              'PAYMENT_INTENT_CREATING',
              'READY'
            )
            AND "expiresAt" > CURRENT_TIMESTAMP
          FOR UPDATE
        `,
        [attemptId, storeId],
      );

    const attempt = result.rows[0];

    if (!attempt) {
      throw new Error(
        "Checkout attempt unavailable",
      );
    }

    return attempt;
  }

  private async getExistingReservations(
    attemptId: string,
  ): Promise<InventoryReservationRow[]> {
    const result =
      await this.query<InventoryReservationRow>(
        `
          SELECT *
          FROM "InventoryReservation"
          WHERE "attemptId" = $1
          ORDER BY "variantId"
        `,
        [attemptId],
      );

    return result.rows;
  }

  private assertReservationsMatch(
    existing: InventoryReservationRow[],
    requested: CatalogInventoryQuantity[],
  ): void {
    const matches =
      existing.length === requested.length &&
      requested.every((item) =>
        existing.some(
          (row) =>
            row.variantId === item.variantId &&
            row.quantity === item.quantity &&
            row.status === "HELD",
        ),
      );

    if (!matches) {
      throw new Error(
        "Reservation does not match existing attempt",
      );
    }
  }

  private async reserveInventory(
    storeId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    const result = await this.query(
      `
        UPDATE "InventoryLevel"
        SET
          "reserved" = "reserved" + $3,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "storeId" = $1
          AND "variantId" = $2
          AND "quantity" - "reserved" >= $3
        RETURNING *
      `,
      [
        storeId,
        variantId,
        quantity,
      ],
    );

    if (result.rows.length !== 1) {
      throw new Error(
        `Insufficient inventory: ${variantId}`,
      );
    }
  }

  private async createReservation(
    input: ReserveVariantsInput,
    item: CatalogInventoryQuantity,
    expiresAt: Date,
  ): Promise<InventoryReservationRow> {
    const result =
      await this.query<InventoryReservationRow>(
        `
          INSERT INTO "InventoryReservation" (
            "attemptId",
            "storeId",
            "variantId",
            "quantity",
            "expiresAt"
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `,
        [
          input.attemptId,
          input.storeId,
          item.variantId,
          item.quantity,
          expiresAt,
        ],
      );

    return result.rows[0];
  }

  private async transitionReservations(
    attemptId: string,
    status: "RELEASED" | "SOLD",
  ): Promise<number> {
    // Serialize release/sale with reservation creation.
    await this.query(
      `
        SELECT "id"
        FROM "CheckoutAttempt"
        WHERE "id" = $1
        FOR UPDATE
      `,
      [attemptId],
    );

    const result =
      await this.query<InventoryReservationRow>(
        `
          UPDATE "InventoryReservation"
          SET "status" = $2
          WHERE "attemptId" = $1
            AND "status" = 'HELD'
          RETURNING *
        `,
        [attemptId, status],
      );

    const reservations = result.rows.sort(
      (a, b) =>
        a.variantId.localeCompare(b.variantId),
    );

    for (const reservation of reservations) {
      await this.applyInventoryTransition(
        reservation,
        status,
      );
    }

    return reservations.length;
  }

  private async applyInventoryTransition(
    reservation: InventoryReservationRow,
    status: "RELEASED" | "SOLD",
  ): Promise<void> {
    const soldQuantity =
      status === "SOLD"
        ? reservation.quantity
        : 0;

    const result = await this.query(
      `
        UPDATE "InventoryLevel"
        SET
          "reserved" = "reserved" - $3,
          "quantity" = "quantity" - $4,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "storeId" = $1
          AND "variantId" = $2
          AND "reserved" >= $3
        RETURNING *
      `,
      [
        reservation.storeId,
        reservation.variantId,
        reservation.quantity,
        soldQuantity,
      ],
    );

    if (result.rows.length !== 1) {
      throw new Error(
        "Reservation inventory invariant violated",
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Repository                                                                 */
/* -------------------------------------------------------------------------- */

export interface PublicOrder {
  order: OrderRow;
  items: OrderItemRow[];
  payment: PaymentRow | null;
}

export class CommerceRepository {
  constructor(
    private readonly database: CommerceDatabase,
  ) {}

  transaction<T>(
    work: (
      tx: CommerceTransaction,
    ) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction((sql) =>
      work(new CommerceTransaction(sql)),
    );
  }

  withCheckoutLock<T>(
    storeId: string,
    cartKey: string,
    work: (
      tx: CommerceTransaction,
    ) => Promise<T>,
  ): Promise<T> {
    return this.transaction(async (tx) => {
      const lockKey = JSON.stringify([
        storeId,
        cartKey,
      ]);

      await tx.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [lockKey],
      );

      return work(tx);
    });
  }

  reserveVariants(
    input: ReserveVariantsInput,
  ): Promise<InventoryReservationRow[]> {
    return this.transaction((tx) =>
      tx.reserveVariants(input),
    );
  }

  releaseAttempt(
    attemptId: string,
  ): Promise<number> {
    return this.transaction((tx) =>
      tx.releaseAttempt(attemptId),
    );
  }

  convertAttemptToSold(
    attemptId: string,
  ): Promise<number> {
    return this.transaction((tx) =>
      tx.convertAttemptToSold(attemptId),
    );
  }

  async getPublicOrder(
    storeId: string,
    publicToken: string,
  ): Promise<PublicOrder | null> {
    return this.database.transaction(
      async (sql) => {
        const orderResult =
          await sql.query<OrderRow>(
            `
              SELECT *
              FROM "Order"
              WHERE "storeId" = $1
                AND "publicToken" = $2
            `,
            [storeId, publicToken],
          );

        const order = orderResult.rows[0];

        if (!order) {
          return null;
        }

        const itemsResult =
          await sql.query<OrderItemRow>(
            `
              SELECT *
              FROM "OrderItem"
              WHERE "storeId" = $1
                AND "orderId" = $2
              ORDER BY "variantId"
            `,
            [storeId, order.id],
          );

        const paymentResult =
          await sql.query<PaymentRow>(
            `
              SELECT *
              FROM "Payment"
              WHERE "storeId" = $1
                AND "orderId" = $2
            `,
            [storeId, order.id],
          );

        return {
          order,
          items: itemsResult.rows,
          payment:
            paymentResult.rows[0] ?? null,
        };
      },
    );
  }
}
