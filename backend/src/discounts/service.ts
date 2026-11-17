import { randomUUID } from "node:crypto";
import { ApiError } from "../http/errors.js";
import { applyDiscount, describeDiscount, discountProblem, normaliseDiscountCode, type DiscountKind, type DiscountRule, type DiscountedTotals } from "./rules.js";

export interface DiscountSql { query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }> }

export interface MerchantDiscount extends Omit<DiscountRule, "startsAt" | "endsAt"> {
  id: string;
  startsAt: string | null;
  endsAt: string | null;
  /** Orders placed with the code that were not cancelled. */
  uses: number;
  createdAt: string;
}

export interface DiscountInput {
  code: string;
  kind: DiscountKind;
  value?: number;
  minimumSubtotalMinor?: number | null;
  usageLimit?: number | null;
  oncePerCustomer?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  active?: boolean;
}

export interface AppliedDiscount extends DiscountedTotals {
  code: string;
  /** "10% off", "Free delivery". */
  label: string;
}

interface DiscountRow {
  id: string; storeId: string; code: string; kind: DiscountKind; value: number;
  minimumSubtotalMinor: number | null; usageLimit: number | null; oncePerCustomer: boolean;
  startsAt: Date | string | null; endsAt: Date | string | null; active: boolean; createdAt: Date | string; uses?: number | string;
}

const toDate = (value: Date | string | null): Date | null => (value === null || value === undefined ? null : value instanceof Date ? value : new Date(value));
const toIso = (value: Date | string | null): string | null => toDate(value)?.toISOString() ?? null;

function ruleOf(row: DiscountRow): DiscountRule {
  return {
    code: row.code, kind: row.kind, value: Number(row.value),
    minimumSubtotalMinor: row.minimumSubtotalMinor === null ? null : Number(row.minimumSubtotalMinor),
    usageLimit: row.usageLimit === null ? null : Number(row.usageLimit),
    oncePerCustomer: Boolean(row.oncePerCustomer), startsAt: toDate(row.startsAt), endsAt: toDate(row.endsAt), active: Boolean(row.active),
  };
}

function merchantOf(row: DiscountRow): MerchantDiscount {
  return { ...ruleOf(row), id: row.id, startsAt: toIso(row.startsAt), endsAt: toIso(row.endsAt), uses: Number(row.uses ?? 0), createdAt: toIso(row.createdAt) ?? "" };
}

const USES = `(SELECT COUNT(*)::int FROM "Order" o WHERE o."storeId" = d."storeId" AND o."discountCode" = d.code AND o.status <> 'CANCELLED')`;

function cleanInput(input: DiscountInput) {
  const code = normaliseDiscountCode(input.code);
  if (!code) throw new ApiError(422, "DISCOUNT_CODE_INVALID", "Use 2 to 40 letters, numbers, dashes or underscores for the code.");
  const value = input.kind === "free_shipping" ? 0 : Math.round(Number(input.value ?? 0));
  if (input.kind === "percent" && !(value >= 1 && value <= 100)) throw new ApiError(422, "DISCOUNT_VALUE_INVALID", "A percentage must be between 1 and 100.");
  if (input.kind === "fixed" && !(value >= 1 && value <= 100_000_000)) throw new ApiError(422, "DISCOUNT_VALUE_INVALID", "Enter an amount to take off.");
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) throw new ApiError(422, "DISCOUNT_DATES_INVALID", "Check the start and end dates.");
  if (startsAt && endsAt && endsAt <= startsAt) throw new ApiError(422, "DISCOUNT_DATES_INVALID", "The end date must be after the start date.");
  return {
    code, kind: input.kind, value,
    minimumSubtotalMinor: input.minimumSubtotalMinor ? Math.round(input.minimumSubtotalMinor) : null,
    usageLimit: input.usageLimit ? Math.round(input.usageLimit) : null,
    oncePerCustomer: Boolean(input.oncePerCustomer), startsAt, endsAt, active: input.active ?? true,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

/**
 * Looks a code up for a checkout and works out the totals with it. Inside a checkout transaction pass `lock`,
 * so two shoppers can't both take the last use of a limited code. Throws a 422 the shopper can read when the
 * code can't be used.
 */
export async function resolveDiscount(
  sql: DiscountSql,
  storeId: string,
  rawCode: string,
  order: { subtotalMinor: number; shippingMinor: number; hasDelivery: boolean; email?: string; currency: string },
  options: { lock?: boolean; now?: Date } = {},
): Promise<AppliedDiscount> {
  const code = normaliseDiscountCode(rawCode);
  const formatMoney = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: order.currency }).format(minor / 100);
  if (!code) throw new ApiError(422, "DISCOUNT_NOT_FOUND", "This code isn't valid.");
  const { rows } = await sql.query<DiscountRow>(`SELECT * FROM "DiscountCode" WHERE "storeId" = $1 AND code = $2${options.lock ? " FOR UPDATE" : ""}`, [storeId, code]);
  const row = rows[0];
  if (!row) throw new ApiError(422, "DISCOUNT_NOT_FOUND", "This code isn't valid.");
  const rule = ruleOf(row);
  const counts = await sql.query<{ uses: number | string; mine: number | string }>(
    `SELECT COUNT(*)::int AS uses,
            COUNT(*) FILTER (WHERE $3::text IS NOT NULL AND lower(o."customerSnapshot"->>'email') = lower($3::text))::int AS mine
     FROM "Order" o WHERE o."storeId" = $1 AND o."discountCode" = $2 AND o.status <> 'CANCELLED'`,
    [storeId, code, order.email?.trim() || null],
  );
  const problem = discountProblem(rule, {
    subtotalMinor: order.subtotalMinor, hasDelivery: order.hasDelivery,
    uses: Number(counts.rows[0]?.uses ?? 0), usesByCustomer: Number(counts.rows[0]?.mine ?? 0),
    now: options.now ?? new Date(), formatMoney,
  });
  if (problem) throw new ApiError(422, "DISCOUNT_NOT_APPLICABLE", problem);
  return { code, label: describeDiscount(rule, formatMoney), ...applyDiscount(rule, order.subtotalMinor, order.shippingMinor) };
}

/** The merchant's codes: list with use counts, create, change, delete. Every query is scoped by store. */
export class DiscountService {
  constructor(private readonly sql: DiscountSql) {}

  async list(storeId: string): Promise<MerchantDiscount[]> {
    const { rows } = await this.sql.query<DiscountRow>(`SELECT d.*, ${USES} AS uses FROM "DiscountCode" d WHERE d."storeId" = $1 ORDER BY d."createdAt" DESC, d.id LIMIT 500`, [storeId]);
    return rows.map(merchantOf);
  }

  async create(storeId: string, input: DiscountInput): Promise<MerchantDiscount> {
    const clean = cleanInput(input);
    try {
      const { rows } = await this.sql.query<DiscountRow>(
        `INSERT INTO "DiscountCode" (id, "storeId", code, kind, value, "minimumSubtotalMinor", "usageLimit", "oncePerCustomer", "startsAt", "endsAt", active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *, 0 AS uses`,
        [`discount-${randomUUID()}`, storeId, clean.code, clean.kind, clean.value, clean.minimumSubtotalMinor, clean.usageLimit, clean.oncePerCustomer, clean.startsAt, clean.endsAt, clean.active],
      );
      return merchantOf(rows[0]!);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError(409, "DISCOUNT_CODE_TAKEN", "You already have a code with that name.");
      throw error;
    }
  }

  async update(storeId: string, id: string, input: DiscountInput): Promise<MerchantDiscount> {
    const clean = cleanInput(input);
    const current = await this.sql.query<DiscountRow>(`SELECT d.*, ${USES} AS uses FROM "DiscountCode" d WHERE d."storeId" = $1 AND d.id = $2`, [storeId, id]);
    const existing = current.rows[0];
    if (!existing) throw new ApiError(404, "DISCOUNT_NOT_FOUND", "That discount no longer exists.");
    // Orders find their code by name, so a used code keeps its name.
    if (existing.code !== clean.code && Number(existing.uses ?? 0) > 0) throw new ApiError(409, "DISCOUNT_CODE_USED", "This code has been used, so its name can't change. Create a new code instead.");
    try {
      const { rows } = await this.sql.query<DiscountRow>(
        `UPDATE "DiscountCode" d SET code=$3, kind=$4, value=$5, "minimumSubtotalMinor"=$6, "usageLimit"=$7, "oncePerCustomer"=$8, "startsAt"=$9, "endsAt"=$10, active=$11, "updatedAt"=NOW()
         WHERE d."storeId"=$1 AND d.id=$2 RETURNING d.*, ${USES} AS uses`,
        [storeId, id, clean.code, clean.kind, clean.value, clean.minimumSubtotalMinor, clean.usageLimit, clean.oncePerCustomer, clean.startsAt, clean.endsAt, clean.active],
      );
      return merchantOf(rows[0]!);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError(409, "DISCOUNT_CODE_TAKEN", "You already have a code with that name.");
      throw error;
    }
  }

  async remove(storeId: string, id: string): Promise<void> {
    const { rows } = await this.sql.query(`DELETE FROM "DiscountCode" WHERE "storeId" = $1 AND id = $2 RETURNING id`, [storeId, id]);
    if (!rows.length) throw new ApiError(404, "DISCOUNT_NOT_FOUND", "That discount no longer exists.");
  }
}
