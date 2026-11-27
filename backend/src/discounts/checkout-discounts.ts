import {
  calculateDiscounts, describeDiscountValue, normaliseDiscountCode,
  type DiscountCalculation, type DiscountCandidate, type DiscountCartLine, type DiscountType,
} from "@jelly/storefront-schema";
import { ApiError } from "../http/errors.js";
import { definitionOf, type AppliedDiscount, type DiscountSql } from "./service.js";

/** A bag line as checkout knows it (from `validateCart`). */
export interface BagLine {
  variantId: string;
  productId: string;
  configurationKey: string;
  unitPriceMinor: number;
  quantity: number;
}

export interface BagInput {
  lines: BagLine[];
  shippingMinor: number;
  hasDelivery: boolean;
  currency: string;
  email?: string;
  /** What the shopper typed, if anything. */
  code?: string;
}

export interface BagDiscountLine {
  discountId: string;
  title: string;
  code: string | null;
  type: DiscountType;
  /** "20% off products in Summer", "Free shipping". */
  label: string;
  amountMinor: number;
  shippingMinor: number;
}

export interface BagDiscounts {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  discounts: BagDiscountLine[];
  /** The typed code once it applies (uppercase). */
  code: string | null;
  /** Why the typed code doesn't apply, in shopper words. */
  codeProblem: string | null;
  /** What each line takes off, by `lineKey`. */
  lineDiscounts: Record<string, number>;
  /** For recording on the order. */
  applied: AppliedDiscount[];
}

export const lineKey = (line: Pick<BagLine, "variantId" | "configurationKey">) => `${line.variantId}|${line.configurationKey}`;

const MAX_AUTOMATIC = 50;
let tablesReady: Promise<boolean> | null = null;

/** Whether the second discount migration is in this database (checkout must keep working without it). */
async function discountTablesExist(sql: DiscountSql): Promise<boolean> {
  tablesReady ??= sql.query<{ ready: boolean }>(`SELECT to_regclass('public."OrderDiscount"') IS NOT NULL AS ready`)
    .then((result) => Boolean(result.rows[0]?.ready))
    .catch(() => { tablesReady = null; return false; });
  const ready = await tablesReady;
  if (!ready) tablesReady = null; // look again next time, so applying the migration needs no restart
  return ready;
}

/** For tests. */
export function resetDiscountTableCheck(): void { tablesReady = null; }

/**
 * Every discount on a bag: the typed code plus the store's automatic discounts, through the shared calculation.
 * Inside a checkout transaction pass `lock`: the typed code and any automatic discount with a usage limit are locked,
 * so two shoppers can't both take the last use.
 */
export async function discountsForBag(sql: DiscountSql, storeId: string, bag: BagInput, options: { lock?: boolean; now?: Date } = {}): Promise<BagDiscounts> {
  const now = options.now ?? new Date();
  const formatMoney = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: bag.currency }).format(minor / 100);
  const subtotalMinor = bag.lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const shippingBefore = bag.hasDelivery ? bag.shippingMinor : 0;
  const none = (codeProblem: string | null): BagDiscounts => ({
    subtotalMinor, discountMinor: 0, shippingMinor: shippingBefore, totalMinor: subtotalMinor + shippingBefore,
    discounts: [], code: null, codeProblem, lineDiscounts: {}, applied: [],
  });

  const typed = bag.code?.trim() ? normaliseDiscountCode(bag.code) : null;
  if (!(await discountTablesExist(sql))) return none(bag.code?.trim() ? "This code isn't valid." : null);
  if (bag.code?.trim() && !typed) return none("This code isn't valid.");

  const lock = options.lock ? " FOR UPDATE OF d" : "";
  const codeRows = typed
    ? (await sql.query<Parameters<typeof definitionOf>[0]>(
      `SELECT d.* FROM "DiscountRedeemCode" r JOIN "DiscountCode" d ON d.id = r."discountId" AND d."storeId" = r."storeId"
       WHERE r."storeId" = $1 AND r.code = $2${lock}`, [storeId, typed])).rows
    : [];
  if (typed && !codeRows.length) return none("This code isn't valid.");
  const automaticRows = (await sql.query<Parameters<typeof definitionOf>[0]>(
    `SELECT d.* FROM "DiscountCode" d WHERE d."storeId" = $1 AND d.method = 'automatic' AND d.active
       AND (d."startsAt" IS NULL OR d."startsAt" <= $2) AND (d."endsAt" IS NULL OR d."endsAt" > $2)
     ORDER BY d."createdAt", d.id LIMIT ${MAX_AUTOMATIC}`, [storeId, now])).rows;
  if (options.lock) {
    const limited = automaticRows.filter((row) => row.usageLimit !== null || row.oncePerCustomer).map((row) => row.id);
    if (limited.length) await sql.query(`SELECT id FROM "DiscountCode" WHERE "storeId" = $1 AND id = ANY($2::text[]) ORDER BY id FOR UPDATE`, [storeId, limited]);
  }
  const rows = [...codeRows, ...automaticRows];
  if (!rows.length) return none(null);

  const definitions = rows.map(definitionOf);
  const email = bag.email?.trim().toLowerCase() || null;
  const ids = definitions.map((definition) => definition.id);
  const usage = new Map((await sql.query<{ discountId: string; uses: number | string; mine: number | string }>(
    `SELECT od."discountId", COUNT(DISTINCT od."orderId")::int AS uses,
            COUNT(DISTINCT od."orderId") FILTER (WHERE $3::text IS NOT NULL AND lower(o."customerSnapshot"->>'email') = $3::text)::int AS mine
     FROM "OrderDiscount" od JOIN "Order" o ON o."storeId" = od."storeId" AND o.id = od."orderId"
     WHERE od."storeId" = $1 AND od."discountId" = ANY($2::text[]) AND o.status <> 'CANCELLED' GROUP BY od."discountId"`,
    [storeId, ids, email])).rows.map((row) => [row.discountId, { uses: Number(row.uses), mine: Number(row.mine) }]));

  const needsProfile = definitions.some((definition) => definition.eligibility.scope === "tags" || definition.eligibility.scope === "first_order");
  let tags: string[] = [];
  let previousOrders = 0;
  if (email && needsProfile) {
    const { rows: profile } = await sql.query<{ tags: string[] | null; previous: number | string }>(
      `SELECT (SELECT tags FROM "CustomerProfile" WHERE "storeId" = $1 AND lower(email) = $2 LIMIT 1) AS tags,
              (SELECT COUNT(*)::int FROM "Order" WHERE "storeId" = $1 AND lower("customerSnapshot"->>'email') = $2 AND status NOT IN ('CANCELLED', 'PENDING_PAYMENT')) AS previous`,
      [storeId, email],
    );
    tags = (profile[0]?.tags ?? []).map((tag) => tag.toLowerCase());
    previousOrders = Number(profile[0]?.previous ?? 0);
  }

  const needsCollections = definitions.some((definition) =>
    definition.appliesTo.scope === "collections" || definition.buyXGetY?.buysItems.scope === "collections" || definition.buyXGetY?.getsItems.scope === "collections");
  const collections = new Map<string, string[]>();
  if (needsCollections) {
    const productIds = [...new Set(bag.lines.map((line) => line.productId))];
    const { rows: links } = await sql.query<{ productId: string; collectionId: string }>(
      `SELECT "productId", "collectionId" FROM "CollectionProduct" WHERE "storeId" = $1 AND "productId" = ANY($2::text[])`, [storeId, productIds]);
    for (const link of links) collections.set(link.productId, [...(collections.get(link.productId) ?? []), link.collectionId]);
  }

  const lines: DiscountCartLine[] = bag.lines.map((line) => ({
    key: lineKey(line), productId: line.productId, collectionIds: collections.get(line.productId) ?? [], unitPriceMinor: line.unitPriceMinor, quantity: line.quantity,
  }));
  const candidates: DiscountCandidate[] = definitions.map((discount, index) => ({
    discount, code: index < codeRows.length ? typed : null, uses: usage.get(discount.id)?.uses ?? 0, usesByCustomer: usage.get(discount.id)?.mine ?? 0,
  }));
  const result: DiscountCalculation = calculateDiscounts({ lines, shippingMinor: bag.shippingMinor, hasDelivery: bag.hasDelivery }, candidates, { email, tags, previousOrders }, { now, formatMoney });

  // Product and collection names, so the shopper reads "20% off Wool blanket" rather than "20% off 1 product".
  const productIds = new Set<string>();
  const collectionIds = new Set<string>();
  for (const definition of result.applied.map((applied) => definitions.find((item) => item.id === applied.discountId)!)) {
    for (const selection of [definition.appliesTo, definition.buyXGetY?.buysItems, definition.buyXGetY?.getsItems]) {
      selection?.productIds.slice(0, 3).forEach((id) => productIds.add(id));
      selection?.collectionIds.slice(0, 3).forEach((id) => collectionIds.add(id));
    }
  }
  const names = { products: {} as Record<string, string>, collections: {} as Record<string, string> };
  if (productIds.size) for (const row of (await sql.query<{ id: string; title: string }>(`SELECT id, title FROM "Product" WHERE "storeId" = $1 AND id = ANY($2::text[])`, [storeId, [...productIds]])).rows) names.products[row.id] = row.title;
  if (collectionIds.size) for (const row of (await sql.query<{ id: string; title: string }>(`SELECT id, title FROM "Collection" WHERE "storeId" = $1 AND id = ANY($2::text[])`, [storeId, [...collectionIds]])).rows) names.collections[row.id] = row.title;
  const named = (ids: string[], map: Record<string, string>) => ids.length > 0 && ids.length <= 3 && ids.every((id) => map[id]);
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  // Names only when every chosen item has one (a long list stays "3 products").
  const labelNames = (definition: (typeof definitions)[number]) => {
    const selections = [definition.appliesTo, definition.buyXGetY?.buysItems, definition.buyXGetY?.getsItems].filter((item) => item && item.scope !== "all");
    const ok = selections.every((item) => (item!.scope === "products" ? named(item!.productIds, names.products) : named(item!.collectionIds, names.collections)));
    return ok ? names : undefined;
  };
  const discounts = result.applied.map((applied): BagDiscountLine => ({
    discountId: applied.discountId, title: applied.title, code: applied.code, type: applied.type,
    label: describeDiscountValue(byId.get(applied.discountId)!, { formatMoney, names: labelNames(byId.get(applied.discountId)!) }), amountMinor: applied.amountMinor, shippingMinor: applied.shippingMinor,
  }));
  const codeApplied = typed ? discounts.some((line) => line.code === typed) : false;
  return {
    subtotalMinor: result.subtotalMinor, discountMinor: result.discountMinor, shippingMinor: result.shippingMinor, totalMinor: result.totalMinor,
    discounts, code: codeApplied ? typed : null,
    codeProblem: typed && !codeApplied ? result.problems.find((problem) => problem.code === typed)?.message ?? "This code isn't valid." : null,
    lineDiscounts: result.lineDiscounts,
    applied: discounts.map((line) => ({
      discountId: line.discountId, code: line.code ?? "", title: line.title, kind: line.type, label: line.label,
      discountMinor: line.amountMinor, shippingMinor: result.shippingMinor, shippingSavedMinor: line.shippingMinor, totalMinor: result.totalMinor,
    })),
  };
}

/** The same, for placing an order: a typed code that doesn't apply stops the checkout with the shopper's words. */
export async function requireBagDiscounts(sql: DiscountSql, storeId: string, bag: BagInput, options: { lock?: boolean; now?: Date } = {}): Promise<BagDiscounts> {
  const result = await discountsForBag(sql, storeId, bag, options);
  if (result.codeProblem) throw new ApiError(422, result.codeProblem === "This code isn't valid." ? "DISCOUNT_NOT_FOUND" : "DISCOUNT_NOT_APPLICABLE", result.codeProblem);
  return result;
}
