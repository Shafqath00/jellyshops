import type { SqlExecutor, StripeConnectedAccountRow } from "../../commerce/repository.js";

export type { StripeConnectedAccountRow };

export interface InsertAccountInput {
  storeId: string;
  stripeAccountId: string;
  cardPaymentsStatus: string;
  payoutsStatus: string;
  requirements: Record<string, unknown>;
}

export interface UpdateAccountStateInput {
  stripeAccountId: string;
  cardPaymentsStatus: string;
  payoutsStatus: string;
  requirements: Record<string, unknown>;
}

/** Parameterized SQL repository for StripeConnectedAccount.
 * One store ↔ one account enforced by DB unique constraint on storeId. */
export class StripeAccountRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findByStoreId(storeId: string): Promise<StripeConnectedAccountRow | undefined> {
    const { rows } = await this.sql.query<StripeConnectedAccountRow>(
      `SELECT "storeId", "stripeAccountId", "cardPaymentsStatus", "payoutsStatus", "requirements", "closedAt"
       FROM "StripeConnectedAccount" WHERE "storeId" = $1`,
      [storeId],
    );
    return rows[0];
  }

  async findByStripeAccountId(stripeAccountId: string): Promise<StripeConnectedAccountRow | undefined> {
    const { rows } = await this.sql.query<StripeConnectedAccountRow>(
      `SELECT "storeId", "stripeAccountId", "cardPaymentsStatus", "payoutsStatus", "requirements", "closedAt"
       FROM "StripeConnectedAccount" WHERE "stripeAccountId" = $1`,
      [stripeAccountId],
    );
    return rows[0];
  }

  async insert(input: InsertAccountInput): Promise<StripeConnectedAccountRow> {
    const { rows } = await this.sql.query<StripeConnectedAccountRow>(
      `INSERT INTO "StripeConnectedAccount"
         ("storeId", "stripeAccountId", "cardPaymentsStatus", "payoutsStatus", "requirements")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING "storeId", "stripeAccountId", "cardPaymentsStatus", "payoutsStatus", "requirements", "closedAt"`,
      [input.storeId, input.stripeAccountId, input.cardPaymentsStatus, input.payoutsStatus, input.requirements],
    );
    const row = rows[0];
    if (!row) throw new Error("Failed to insert StripeConnectedAccount");
    return row;
  }

  async updateState(input: UpdateAccountStateInput): Promise<StripeConnectedAccountRow> {
    const { rows } = await this.sql.query<StripeConnectedAccountRow>(
      `UPDATE "StripeConnectedAccount"
       SET "cardPaymentsStatus" = $2, "payoutsStatus" = $3, "requirements" = $4, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "stripeAccountId" = $1
       RETURNING "storeId", "stripeAccountId", "cardPaymentsStatus", "payoutsStatus", "requirements", "closedAt"`,
      [input.stripeAccountId, input.cardPaymentsStatus, input.payoutsStatus, input.requirements],
    );
    const row = rows[0];
    if (!row) throw new Error(`StripeConnectedAccount not found: ${input.stripeAccountId}`);
    return row;
  }

  async markClosed(stripeAccountId: string): Promise<StripeConnectedAccountRow> {
    const { rows } = await this.sql.query<StripeConnectedAccountRow>(
      `UPDATE "StripeConnectedAccount"
       SET "closedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "stripeAccountId" = $1 AND "closedAt" IS NULL
       RETURNING "storeId", "stripeAccountId", "cardPaymentsStatus", "payoutsStatus", "requirements", "closedAt"`,
      [stripeAccountId],
    );
    const row = rows[0];
    if (!row) throw new Error(`StripeConnectedAccount not found or already closed: ${stripeAccountId}`);
    return row;
  }
}
