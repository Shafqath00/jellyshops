import { randomInt, randomUUID } from "node:crypto";
import {
  calculateDiscounts, describeDiscountValue, discountStatus, generateDiscountCode, normaliseDiscountCode, validateDiscountInput,
  type DiscountCandidate, type DiscountCartLine, type DiscountCustomer, type DiscountDefinition, type DiscountStatus, type DiscountType,
} from "@jelly/storefront-schema";
import { ApiError } from "../http/errors.js";
import type { PlanLimitChecker } from "../billing/plan-limits.js";

export interface DiscountSql { query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }> }
export interface DiscountDatabase { transaction<T>(work: (sql: DiscountSql) => Promise<T>): Promise<T> }

/** A discount as the admin sees it: the definition with dates as text, plus how it is doing. */
export interface MerchantDiscount extends Omit<DiscountDefinition, "startsAt" | "endsAt" | "createdAt"> {
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: DiscountStatus;
  /** Orders that used it and were not cancelled. */
  uses: number;
  /** Codes a shopper can type (1 for an ordinary code discount, more once codes are generated in bulk). */
  codeCount: number;
}

/** A code applied at checkout (order-level discounts only until checkout reads product lines, phase 2). */
export interface AppliedDiscount {
  discountId: string;
  code: string;
  title: string;
  kind: DiscountType;
  /** "10% off the whole order", "Free shipping". */
  label: string;
  discountMinor: number;
  /** Delivery after the discount. */
  shippingMinor: number;
  /** What it took off delivery. */
  shippingSavedMinor: number;
  totalMinor: number;
}

interface DiscountRow {
  id: string; storeId: string; code: string | null; title: string; method: string; kind: string; valueType: string | null; value: number;
  appliesTo: unknown; appliesOncePerOrder: boolean; minimumSubtotalMinor: number | null; minimumQuantity: number | null;
  eligibility: unknown; combinesWith: unknown; maxShippingMinor: number | null; buyXGetY: unknown;
  usageLimit: number | null; oncePerCustomer: boolean; startsAt: Date | string | null; endsAt: Date | string | null; active: boolean;
  createdAt: Date | string; updatedAt: Date | string; uses?: number | string; codeCount?: number | string;
}

const toDate = (value: Date | string | null | undefined): Date | null => (value === null || value === undefined ? null : value instanceof Date ? value : new Date(value));
const json = <T>(value: unknown, fallback: T): T => (value === null || value === undefined ? fallback : typeof value === "string" ? JSON.parse(value) as T : value as T);
const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

export function definitionOf(row: DiscountRow): DiscountDefinition {
  const minimumSubtotal = num(row.minimumSubtotalMinor);
  const minimumQuantity = num(row.minimumQuantity);
  return {
    id: row.id, title: row.title || row.code || "", method: row.method === "automatic" ? "automatic" : "code", code: row.code,
    type: row.kind as DiscountType, valueType: (row.valueType as DiscountDefinition["valueType"]) ?? null, value: Number(row.value),
    appliesTo: json(row.appliesTo, { scope: "all", productIds: [], collectionIds: [] }), appliesOncePerOrder: Boolean(row.appliesOncePerOrder),
    minimum: minimumSubtotal !== null ? { type: "amount", amountMinor: minimumSubtotal } : minimumQuantity !== null ? { type: "quantity", quantity: minimumQuantity } : { type: "none" },
    eligibility: json(row.eligibility, { scope: "everyone" }), combinesWith: json(row.combinesWith, { product: false, order: false, shipping: false }),
    maxShippingMinor: num(row.maxShippingMinor), buyXGetY: json(row.buyXGetY, null),
    usageLimit: num(row.usageLimit), oncePerCustomer: Boolean(row.oncePerCustomer),
    startsAt: toDate(row.startsAt), endsAt: toDate(row.endsAt), active: Boolean(row.active), createdAt: toDate(row.createdAt) ?? new Date(0),
  };
}

function merchantOf(row: DiscountRow, now = new Date()): MerchantDiscount {
  const definition = definitionOf(row);
  const uses = Number(row.uses ?? 0);
  return {
    ...definition,
    startsAt: definition.startsAt?.toISOString() ?? null, endsAt: definition.endsAt?.toISOString() ?? null,
    createdAt: definition.createdAt.toISOString(), updatedAt: toDate(row.updatedAt)?.toISOString() ?? definition.createdAt.toISOString(),
    status: discountStatus(definition, uses, now), uses, codeCount: Number(row.codeCount ?? 0),
  };
}

/** Orders that used a discount and were not cancelled (d = "DiscountCode"). */
const USES = `(SELECT COUNT(DISTINCT od."orderId")::int FROM "OrderDiscount" od JOIN "Order" o ON o."storeId" = od."storeId" AND o.id = od."orderId"
  WHERE od."storeId" = d."storeId" AND od."discountId" = d.id AND o.status <> 'CANCELLED')`;
const CODE_COUNT = `(SELECT COUNT(*)::int FROM "DiscountRedeemCode" r WHERE r."discountId" = d.id)`;
const WITH_STATS = `d.*, ${USES} AS uses, ${CODE_COUNT} AS "codeCount"`;

function cleanInput(input: unknown) {
  const result = validateDiscountInput(input);
  if (!result.ok) throw new ApiError(422, "DISCOUNT_INPUT_INVALID", result.problems[0]?.message ?? "Check the discount details and try again.", result.problems);
  return result.value;
}

function columns(value: ReturnType<typeof cleanInput>) {
  return [
    value.title, value.method, value.code, value.type, value.valueType, value.value, JSON.stringify(value.appliesTo), value.appliesOncePerOrder,
    value.minimum.type === "amount" ? value.minimum.amountMinor : null, value.minimum.type === "quantity" ? value.minimum.quantity : null,
    JSON.stringify(value.eligibility), JSON.stringify(value.combinesWith), value.maxShippingMinor, value.buyXGetY ? JSON.stringify(value.buyXGetY) : null,
    value.usageLimit, value.oncePerCustomer, value.startsAt, value.endsAt, value.active,
  ];
}

const COLUMN_NAMES = `title, method, code, kind, "valueType", value, "appliesTo", "appliesOncePerOrder", "minimumSubtotalMinor", "minimumQuantity",
  eligibility, "combinesWith", "maxShippingMinor", "buyXGetY", "usageLimit", "oncePerCustomer", "startsAt", "endsAt", active`;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

const codeTaken = () => new ApiError(409, "DISCOUNT_CODE_TAKEN", "You already have a discount with that code. Try another.", [{ path: "code", message: "You already have a discount with that code. Try another." }]);
const notFound = () => new ApiError(404, "DISCOUNT_NOT_FOUND", "That discount no longer exists.");

async function customerFor(sql: DiscountSql, storeId: string, email: string | undefined, needed: boolean): Promise<DiscountCustomer> {
  const clean = email?.trim().toLowerCase() || null;
  if (!clean || !needed) return { email: clean, tags: [], previousOrders: 0 };
  const { rows } = await sql.query<{ tags: string[] | null; previous: number | string }>(
    `SELECT (SELECT tags FROM "CustomerProfile" WHERE "storeId" = $1 AND lower(email) = $2 LIMIT 1) AS tags,
            (SELECT COUNT(*)::int FROM "Order" WHERE "storeId" = $1 AND lower("customerSnapshot"->>'email') = $2 AND status NOT IN ('CANCELLED', 'PENDING_PAYMENT')) AS previous`,
    [storeId, clean],
  );
  return { email: clean, tags: (rows[0]?.tags ?? []).map((tag) => tag.toLowerCase()), previousOrders: Number(rows[0]?.previous ?? 0) };
}

async function usageFor(sql: DiscountSql, storeId: string, discountId: string, email: string | null): Promise<{ uses: number; mine: number }> {
  const { rows } = await sql.query<{ uses: number | string; mine: number | string }>(
    `SELECT COUNT(DISTINCT od."orderId")::int AS uses,
            COUNT(DISTINCT od."orderId") FILTER (WHERE $3::text IS NOT NULL AND lower(o."customerSnapshot"->>'email') = $3::text)::int AS mine
     FROM "OrderDiscount" od JOIN "Order" o ON o."storeId" = od."storeId" AND o.id = od."orderId"
     WHERE od."storeId" = $1 AND od."discountId" = $2 AND o.status <> 'CANCELLED'`,
    [storeId, discountId, email],
  );
  return { uses: Number(rows[0]?.uses ?? 0), mine: Number(rows[0]?.mine ?? 0) };
}

/**
 * Looks a code up for a checkout and works out the totals with it. Inside a checkout transaction pass `lock`, so two
 * shoppers can't both take the last use of a limited code. Throws a 422 the shopper can read when the code can't be used.
 */
export async function resolveDiscount(
  sql: DiscountSql,
  storeId: string,
  rawCode: string,
  order: { subtotalMinor: number; shippingMinor: number; hasDelivery: boolean; email?: string; currency: string; itemCount?: number },
  options: { lock?: boolean; now?: Date } = {},
): Promise<AppliedDiscount> {
  const code = normaliseDiscountCode(rawCode);
  const formatMoney = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: order.currency }).format(minor / 100);
  if (!code) throw new ApiError(422, "DISCOUNT_NOT_FOUND", "This code isn't valid.");
  const { rows } = await sql.query<DiscountRow>(
    `SELECT d.* FROM "DiscountRedeemCode" r JOIN "DiscountCode" d ON d.id = r."discountId" AND d."storeId" = r."storeId"
     WHERE r."storeId" = $1 AND r.code = $2${options.lock ? ` FOR UPDATE OF d` : ""}`,
    [storeId, code],
  );
  const row = rows[0];
  if (!row) throw new ApiError(422, "DISCOUNT_NOT_FOUND", "This code isn't valid.");
  const discount = definitionOf(row);
  // Product and Buy X get Y discounts need the bag's lines; checkout passes them from phase 2.
  if (discount.type === "product_amount" || discount.type === "buy_x_get_y") throw new ApiError(422, "DISCOUNT_NOT_APPLICABLE", "This code can't be used in this shop yet.");
  const customer = await customerFor(sql, storeId, order.email, discount.eligibility.scope === "first_order" || discount.eligibility.scope === "tags");
  const usage = await usageFor(sql, storeId, discount.id, customer.email);
  const itemCount = Math.max(1, order.itemCount ?? 1);
  // One line per item keeps a quantity minimum right; the subtotal is spread so the lines add up exactly.
  const per = Math.floor(order.subtotalMinor / itemCount);
  const lines: DiscountCartLine[] = Array.from({ length: itemCount }, (_, index) => ({
    key: `item-${index}`, productId: "", collectionIds: [], quantity: 1,
    unitPriceMinor: index === 0 ? order.subtotalMinor - per * (itemCount - 1) : per,
  }));
  const candidate: DiscountCandidate = { discount, code, uses: usage.uses, usesByCustomer: usage.mine };
  const result = calculateDiscounts({ lines, shippingMinor: order.shippingMinor, hasDelivery: order.hasDelivery }, [candidate], customer, { now: options.now ?? new Date(), formatMoney });
  const applied = result.applied[0];
  if (!applied) throw new ApiError(422, "DISCOUNT_NOT_APPLICABLE", result.problems[0]?.message ?? "This code isn't valid.");
  return {
    discountId: discount.id, code, title: discount.title, kind: discount.type, label: describeDiscountValue(discount, { formatMoney }),
    discountMinor: result.discountMinor, shippingMinor: result.shippingMinor, shippingSavedMinor: applied.shippingMinor, totalMinor: result.totalMinor,
  };
}

/** Records the discounts an order used, inside the checkout transaction. */
export async function recordOrderDiscounts(sql: DiscountSql, storeId: string, orderId: string, applied: AppliedDiscount[]): Promise<void> {
  for (const discount of applied) {
    await sql.query(
      `INSERT INTO "OrderDiscount" (id, "storeId", "orderId", "discountId", code, title, kind, "amountMinor", "shippingMinor") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [`od-${randomUUID()}`, storeId, orderId, discount.discountId, discount.code || null, discount.title, discount.kind, discount.discountMinor, discount.shippingSavedMinor],
    );
  }
}

/** The merchant's discounts. Every query is scoped by store. */
export class DiscountService {
  constructor(private readonly database: DiscountDatabase, private readonly planLimits?: Pick<PlanLimitChecker, "check">) {}

  async list(storeId: string): Promise<MerchantDiscount[]> {
    return this.database.transaction(async (sql) => {
      const { rows } = await sql.query<DiscountRow>(`SELECT ${WITH_STATS} FROM "DiscountCode" d WHERE d."storeId" = $1 ORDER BY d."createdAt" DESC, d.id LIMIT 2000`, [storeId]);
      const now = new Date();
      return rows.map((row) => merchantOf(row, now));
    });
  }

  async get(storeId: string, id: string): Promise<MerchantDiscount> {
    return this.database.transaction(async (sql) => {
      const { rows } = await sql.query<DiscountRow>(`SELECT ${WITH_STATS} FROM "DiscountCode" d WHERE d."storeId" = $1 AND d.id = $2`, [storeId, id]);
      if (!rows[0]) throw notFound();
      return merchantOf(rows[0]);
    });
  }

  async create(storeId: string, input: unknown): Promise<MerchantDiscount> {
    const clean = cleanInput(input);
    await this.planLimits?.check(storeId, "discounts");
    const id = `discount-${randomUUID()}`;
    try {
      return await this.database.transaction(async (sql) => {
        const { rows } = await sql.query<DiscountRow>(
          `INSERT INTO "DiscountCode" (id, "storeId", ${COLUMN_NAMES}) VALUES ($1,$2,${columns(clean).map((_, index) => `$${index + 3}`).join(",")}) RETURNING *, 0 AS uses`,
          [id, storeId, ...columns(clean)],
        );
        if (clean.code) await sql.query(`INSERT INTO "DiscountRedeemCode" (id, "storeId", "discountId", code) VALUES ($1,$2,$3,$4)`, [`redeem-${id}`, storeId, id, clean.code]);
        return merchantOf({ ...rows[0]!, codeCount: clean.code ? 1 : 0 });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw codeTaken();
      throw error;
    }
  }

  async update(storeId: string, id: string, input: unknown): Promise<MerchantDiscount> {
    const clean = cleanInput(input);
    try {
      return await this.database.transaction(async (sql) => {
        const current = await sql.query<DiscountRow>(`SELECT ${WITH_STATS} FROM "DiscountCode" d WHERE d."storeId" = $1 AND d.id = $2 FOR UPDATE OF d`, [storeId, id]);
        const existing = current.rows[0];
        if (!existing) throw notFound();
        if (existing.kind !== clean.type) throw new ApiError(409, "DISCOUNT_TYPE_LOCKED", "A discount's type can't change. Create a new discount instead.", [{ path: "type", message: "A discount's type can't change. Create a new discount instead." }]);
        const used = Number(existing.uses ?? 0) > 0;
        // Receipts and reports name the code, so a used code keeps its name.
        if (used && existing.code !== clean.code) throw new ApiError(409, "DISCOUNT_CODE_USED", "This code has been used, so it can't change. Create a new discount instead.", [{ path: "code", message: "This code has been used, so it can't change." }]);
        if (existing.code !== clean.code) {
          if (existing.code) await sql.query(`DELETE FROM "DiscountRedeemCode" WHERE "storeId" = $1 AND "discountId" = $2 AND code = $3`, [storeId, id, existing.code]);
          if (clean.method === "automatic") await sql.query(`DELETE FROM "DiscountRedeemCode" WHERE "storeId" = $1 AND "discountId" = $2`, [storeId, id]);
          if (clean.code) await sql.query(`INSERT INTO "DiscountRedeemCode" (id, "storeId", "discountId", code) VALUES ($1,$2,$3,$4)`, [`redeem-${randomUUID()}`, storeId, id, clean.code]);
        }
        const set = COLUMN_NAMES.split(",").map((name, index) => `${name.trim()} = $${index + 3}`).join(", ");
        const { rows } = await sql.query<DiscountRow>(
          `UPDATE "DiscountCode" d SET ${set}, "updatedAt" = NOW() WHERE d."storeId" = $1 AND d.id = $2 RETURNING ${WITH_STATS}`,
          [storeId, id, ...columns(clean)],
        );
        return merchantOf(rows[0]!);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw codeTaken();
      throw error;
    }
  }

  /** Switches discounts on or off; returns how many changed. */
  async setActive(storeId: string, ids: string[], active: boolean): Promise<number> {
    if (!ids.length) return 0;
    return this.database.transaction(async (sql) => {
      const { rows } = await sql.query(`UPDATE "DiscountCode" SET active = $3, "updatedAt" = NOW() WHERE "storeId" = $1 AND id = ANY($2::text[]) RETURNING id`, [storeId, ids, active]);
      return rows.length;
    });
  }

  /** Deletes discounts; orders keep their record of what they used. Returns how many went. */
  async removeMany(storeId: string, ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    return this.database.transaction(async (sql) => {
      const { rows } = await sql.query(`DELETE FROM "DiscountCode" WHERE "storeId" = $1 AND id = ANY($2::text[]) RETURNING id`, [storeId, ids]);
      return rows.length;
    });
  }

  async remove(storeId: string, id: string): Promise<void> {
    if (!(await this.removeMany(storeId, [id]))) throw notFound();
  }

  /** Whether a code is free to use in this store (optionally ignoring one discount's own codes). */
  async codeAvailable(storeId: string, raw: string, exceptDiscountId?: string): Promise<{ code: string | null; available: boolean; message: string | null }> {
    const code = normaliseDiscountCode(raw);
    if (!code) return { code: null, available: false, message: "Use 2 to 40 letters, numbers, dashes or underscores, with no spaces." };
    return this.database.transaction(async (sql) => {
      const { rows } = await sql.query(`SELECT 1 FROM "DiscountRedeemCode" WHERE "storeId" = $1 AND code = $2 AND ($3::text IS NULL OR "discountId" <> $3::text) LIMIT 1`, [storeId, code, exceptDiscountId ?? null]);
      return rows.length ? { code, available: false, message: "You already have a discount with that code. Try another." } : { code, available: true, message: null };
    });
  }

  /** A random code nobody in this store uses yet. */
  async generateCode(storeId: string, prefix = ""): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = generateDiscountCode(() => randomInt(0, 1_000_000) / 1_000_000, 8, prefix);
      if ((await this.codeAvailable(storeId, code)).available) return code;
    }
    throw new ApiError(503, "DISCOUNT_CODE_GENERATION_FAILED", "We couldn't make a new code just now. Try again.");
  }
}
