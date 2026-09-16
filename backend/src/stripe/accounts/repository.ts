import type {
  SqlExecutor,
  StripeConnectedAccountRow,
} from "../../commerce/repository.js";

export type { StripeConnectedAccountRow };

/* -------------------------------------------------------------------------- */
/*                              Repository Inputs                             */
/* -------------------------------------------------------------------------- */

/**
 * Data required to persist a newly created Stripe connected account.
 *
 * The database is responsible for enforcing the one-store-to-one-account
 * relationship through the unique constraint on `storeId`.
 */
export interface InsertAccountInput {
  storeId: string;
  stripeAccountId: string;
  cardPaymentsStatus: string;
  payoutsStatus: string;
  requirements: Record<string, unknown>;
}

/**
 * Mutable Stripe account state synchronized from Stripe.
 */
export interface UpdateAccountStateInput {
  stripeAccountId: string;
  cardPaymentsStatus: string;
  payoutsStatus: string;
  requirements: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               SQL Fragments                                */
/* -------------------------------------------------------------------------- */

/**
 * Columns returned by repository queries.
 *
 * Keeping the projection consistent prevents individual methods from
 * accidentally returning differently shaped account records.
 */
const ACCOUNT_COLUMNS = `
  "storeId",
  "stripeAccountId",
  "cardPaymentsStatus",
  "payoutsStatus",
  "requirements",
  "closedAt"
`;

/* -------------------------------------------------------------------------- */
/*                              Internal Helpers                              */
/* -------------------------------------------------------------------------- */

/**
 * Returns the first row from a mutation query.
 *
 * INSERT and UPDATE operations in this repository are expected to affect
 * exactly one account. A missing RETURNING row therefore represents an
 * unexpected repository state.
 */
function requireAccountRow(
  rows: StripeConnectedAccountRow[],
  errorMessage: string,
): StripeConnectedAccountRow {
  const row = rows[0];

  if (!row) {
    throw new Error(errorMessage);
  }

  return row;
}

/* -------------------------------------------------------------------------- */
/*                               Repository                                   */
/* -------------------------------------------------------------------------- */

/**
 * Parameterized SQL repository for Stripe connected-account persistence.
 *
 * Responsibilities:
 * - Look up connected accounts by store or Stripe account ID.
 * - Persist newly created connected accounts.
 * - Synchronize payment capability and requirements state.
 * - Mark disconnected/closed accounts without physically deleting them.
 *
 * Database invariant:
 * - One store ↔ one Stripe connected account.
 * - Enforced by the database unique constraint on `storeId`.
 *
 * All SQL values are passed through parameterized query placeholders.
 */
export class StripeAccountRepository {
  constructor(private readonly sql: SqlExecutor) {}

  /**
   * Finds the Stripe connected account associated with a store.
   *
   * @returns The account when one exists, otherwise `undefined`.
   */
  async findByStoreId(
    storeId: string,
  ): Promise<StripeConnectedAccountRow | undefined> {
    const { rows } = await this.sql.query<StripeConnectedAccountRow>(
      `
        SELECT ${ACCOUNT_COLUMNS}
        FROM "StripeConnectedAccount"
        WHERE "storeId" = $1
      `,
      [storeId],
    );

    return rows[0];
  }

  /**
   * Finds an account using Stripe's connected-account identifier.
   *
   * @returns The account when one exists, otherwise `undefined`.
   */
  async findByStripeAccountId(
    stripeAccountId: string,
  ): Promise<StripeConnectedAccountRow | undefined> {
    const { rows } = await this.sql.query<StripeConnectedAccountRow>(
      `
        SELECT ${ACCOUNT_COLUMNS}
        FROM "StripeConnectedAccount"
        WHERE "stripeAccountId" = $1
      `,
      [stripeAccountId],
    );

    return rows[0];
  }

  /**
   * Persists a newly created Stripe connected account.
   *
   * The database unique constraint on `storeId` prevents multiple Stripe
   * accounts from being associated with the same store.
   *
   * @throws If the INSERT unexpectedly returns no row.
   */
  async insert(
    input: InsertAccountInput,
  ): Promise<StripeConnectedAccountRow> {
    const { rows } = await this.sql.query<StripeConnectedAccountRow>(
      `
        INSERT INTO "StripeConnectedAccount" (
          "storeId",
          "stripeAccountId",
          "cardPaymentsStatus",
          "payoutsStatus",
          "requirements"
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING ${ACCOUNT_COLUMNS}
      `,
      [
        input.storeId,
        input.stripeAccountId,
        input.cardPaymentsStatus,
        input.payoutsStatus,
        input.requirements,
      ],
    );

    return requireAccountRow(
      rows,
      "Failed to insert StripeConnectedAccount",
    );
  }

  /**
   * Synchronizes the mutable state of a connected account.
   *
   * This is typically used after retrieving fresh account information from
   * Stripe or processing an account-related webhook.
   *
   * Updating the account state also refreshes `updatedAt`.
   *
   * @throws If no account exists with the supplied Stripe account ID.
   */
  async updateState(
    input: UpdateAccountStateInput,
  ): Promise<StripeConnectedAccountRow> {
    const { rows } = await this.sql.query<StripeConnectedAccountRow>(
      `
        UPDATE "StripeConnectedAccount"
        SET
          "cardPaymentsStatus" = $2,
          "payoutsStatus" = $3,
          "requirements" = $4,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "stripeAccountId" = $1
        RETURNING ${ACCOUNT_COLUMNS}
      `,
      [
        input.stripeAccountId,
        input.cardPaymentsStatus,
        input.payoutsStatus,
        input.requirements,
      ],
    );

    return requireAccountRow(
      rows,
      `StripeConnectedAccount not found: ${input.stripeAccountId}`,
    );
  }

  /**
   * Marks a connected account as closed.
   *
   * Accounts are soft-closed rather than deleted so historical references
   * remain intact.
   *
   * The `closedAt IS NULL` condition also makes repeated close attempts fail
   * instead of silently updating an already-closed account.
   *
   * @throws If the account does not exist or has already been closed.
   */
  async markClosed(
    stripeAccountId: string,
  ): Promise<StripeConnectedAccountRow> {
    const { rows } = await this.sql.query<StripeConnectedAccountRow>(
      `
        UPDATE "StripeConnectedAccount"
        SET
          "closedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE
          "stripeAccountId" = $1
          AND "closedAt" IS NULL
        RETURNING ${ACCOUNT_COLUMNS}
      `,
      [stripeAccountId],
    );

    return requireAccountRow(
      rows,
      `StripeConnectedAccount not found or already closed: ${stripeAccountId}`,
    );
  }
}