import { ApiError } from "../http/errors.js";
import { DEFAULT_PLAN, PLANS, type LimitKind, type PlanId, type UploadRules } from "./plans.js";

/** How much of something a store uses now. */
export interface UsageReader {
  usage(storeId: string, kind: LimitKind): Promise<number>;
}

/** Which plan a store is on; "exempt" stores are never limited (the owner's own and comped stores, step 4b). */
export type PlanResolver = (storeId: string) => Promise<PlanId | "exempt">;

export interface PlanUsage {
  plan: PlanId | "exempt";
  kind: LimitKind;
  used: number;
  limit: number | null;
}

const number = new Intl.NumberFormat("en-GB");

/** Bytes as people read them: "9.8 GB", "750 MB", "120 KB". */
export function formatBytes(bytes: number): string {
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return unit === 0 ? `${value} bytes` : `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`;
}

function limitMessage(kind: LimitKind, used: number, limit: number, adding: number): string {
  switch (kind) {
    case "products":
      return `Your plan allows up to ${number.format(limit)} products and this shop already has ${number.format(used)}. `
        + "Archive products you no longer sell to make room, or contact us about a bigger plan.";
    case "photoBytes":
      return `Your plan includes ${formatBytes(limit)} of photos and this shop uses ${formatBytes(used)}`
        + (adding > 0 ? `, so there is no room for this ${formatBytes(adding)} photo. ` : ". ")
        + "Delete photos you no longer use in Content > Files, or contact us about a bigger plan.";
    case "staff":
      return `Your plan allows ${number.format(limit)} people on this shop (you included) and it already has ${number.format(used)}. `
        + "Remove someone who no longer needs access, or contact us about a bigger plan.";
    case "files":
      return `Your plan allows up to ${number.format(limit)} files and this shop already has ${number.format(used)}. `
        + "Delete files you no longer use in Content > Files, or pay for your plan to get more room.";
    case "customDomains":
      return `Your plan allows ${number.format(limit)} own domain${limit === 1 ? "" : "s"} and this shop already has ${number.format(used)}. `
        + "Remove one first, or contact us about a bigger plan.";
  }
}

/**
 * The one place plan limits are checked. Call `check` right before creating something that counts towards a limit;
 * it throws a 409 `PLAN_LIMIT` with a plain message when the store has no room. Nothing is ever deleted or hidden.
 *
 * The check and the write are not one transaction: two creates at the same moment may go one over the limit, which
 * is cheaper than locking every write (see the Phase 4 plan, "Risks").
 */
export class PlanLimitChecker {
  constructor(
    private readonly reader: UsageReader,
    private readonly resolvePlan: PlanResolver = async () => DEFAULT_PLAN,
  ) {}

  async usage(storeId: string, kind: LimitKind): Promise<PlanUsage> {
    const plan = await this.resolvePlan(storeId);
    const used = await this.reader.usage(storeId, kind);
    return { plan, kind, used, limit: plan === "exempt" ? null : PLANS[plan].limits[kind] };
  }

  /** Upload rules for a store's plan; null for exempt stores (only the server-wide size cap applies). */
  async uploadRules(storeId: string): Promise<UploadRules | null> {
    const plan = await this.resolvePlan(storeId);
    return plan === "exempt" ? null : PLANS[plan].uploads;
  }

  /** Refuses a single file larger than the store's plan allows (413). */
  async checkFileSize(storeId: string, bytes: number): Promise<void> {
    const rules = await this.uploadRules(storeId);
    if (rules && bytes > rules.fileBytes) throw fileTooLarge(rules.fileBytes, bytes);
  }

  /** `adding` is how many items (or bytes, for photos) the write adds. */
  async check(storeId: string, kind: LimitKind, adding = 1): Promise<void> {
    const plan = await this.resolvePlan(storeId);
    if (plan === "exempt") return;
    const limit = PLANS[plan].limits[kind];
    const used = await this.reader.usage(storeId, kind);
    if (used + adding > limit) throw new ApiError(409, "PLAN_LIMIT", limitMessage(kind, used, limit, kind === "photoBytes" ? adding : 0));
  }
}

/** 413 for a file over the plan's per-file limit, with both sizes in plain words. */
export function fileTooLarge(limit: number, bytes?: number): ApiError {
  return new ApiError(413, "FILE_TOO_LARGE", `Files can be up to ${formatBytes(limit)} on your plan`
    + (bytes ? ` and this one is ${formatBytes(bytes)}. ` : ". ") + "Make the photo smaller and try again.");
}

interface Sql {
  query<Row>(text: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

/** Usage straight from the database: cheap counts by store (both tables are indexed by "storeId"). */
export function sqlUsageReader(sql: Sql): UsageReader {
  const queries: Record<LimitKind, string | null> = {
    products: `SELECT count(*)::bigint AS "value" FROM "Product" WHERE "storeId" = $1 AND "status" <> 'ARCHIVED'`,
    photoBytes: `SELECT coalesce(sum("byteSize"), 0)::bigint AS "value" FROM "Media" WHERE "storeId" = $1`,
    files: `SELECT count(*)::bigint AS "value" FROM "Media" WHERE "storeId" = $1`,
    staff: `SELECT count(*)::bigint AS "value" FROM "StoreMembership" WHERE "storeId" = $1`,
    // Custom domains are not built yet; nothing to count.
    customDomains: null,
  };
  return {
    async usage(storeId, kind) {
      const query = queries[kind];
      if (!query) return 0;
      const result = await sql.query<{ value: string | number }>(query, [storeId]);
      return Number(result.rows[0]?.value ?? 0);
    },
  };
}
