import { Router, type RequestHandler } from "express";
import type { SqlExecutor } from "../commerce/repository.js";

/**
 * When each store was last used: a merchant working in the admin, a paid order, a shopper visiting. The inactive-store
 * stages (see docs/plans/2026-11-20-speed-and-cost-plan.md, Phase 5) read these columns; nothing acts on them yet.
 *
 * Writes are rare by design: a merchant is recorded at most once an hour per store and a visit at most once a day,
 * remembered in this server's memory and again in the UPDATE's own condition (so several servers don't all write).
 * Until the `store_activity` migration is applied the first failing write switches recording off for this server.
 */
export interface StoreActivityRecorder {
  merchantSeen(storeId: string): Promise<void>;
  orderPaid(storeId: string): Promise<void>;
  visited(storeId: string): Promise<void>;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const COLUMNS = { merchant: "lastMerchantActivityAt", order: "lastOrderAt", visit: "lastVisitAt" } as const;
const EVERY = { merchant: HOUR, order: 0, visit: DAY } as const;
type Kind = keyof typeof COLUMNS;

export function createStoreActivityRecorder(sql: SqlExecutor | undefined, now: () => number = Date.now): StoreActivityRecorder {
  const seen = new Map<string, number>();
  let enabled = Boolean(sql);
  async function record(kind: Kind, storeId: string): Promise<void> {
    if (!enabled || !sql || !storeId) return;
    const key = `${kind}:${storeId}`;
    const last = seen.get(key);
    if (EVERY[kind] && last !== undefined && now() - last < EVERY[kind]) return;
    const column = COLUMNS[kind];
    const recent = EVERY[kind] ? ` AND ("${column}" IS NULL OR "${column}" < now() - interval '${EVERY[kind] / 1000} seconds')` : "";
    try {
      await sql.query(`UPDATE "Store" SET "${column}" = now() WHERE "id" = $1${recent}`, [storeId]);
      if (seen.size > 20_000) seen.clear();
      seen.set(key, now());
    } catch (error) {
      // 42703 = the column isn't there yet (migration not applied): stop trying on this server.
      if ((error as { code?: string }).code === "42703") enabled = false;
    }
  }
  return {
    merchantSeen: (storeId) => record("merchant", storeId),
    orderPaid: (storeId) => record("order", storeId),
    visited: (storeId) => record("visit", storeId),
  };
}

const STORE_ROUTE = /^\/api\/stores\/([^/]+)\//;

/** Records merchant activity once a signed-in member's request for a store has succeeded. Never delays the response. */
export function recordMerchantActivity(recorder: StoreActivityRecorder): RequestHandler {
  return (request, response, next) => {
    const storeId = STORE_ROUTE.exec(request.originalUrl)?.[1];
    if (storeId) response.on("finish", () => {
      if (response.statusCode < 400 && request.storeContext) void recorder.merchantSeen(decodeURIComponent(storeId));
    });
    next();
  };
}

/**
 * `POST /api/public/stores/:storeId/visit`: the shopper's browser says it visited, at most once a day per store (see
 * the storefront's `use-visit-beacon.ts`). Carries nothing but the store id in the address; always answers 204.
 */
export function createStoreVisitRouter(recorder: StoreActivityRecorder): Router {
  const router = Router();
  router.post("/:storeId/visit", (request, response) => {
    const storeId = request.params.storeId;
    if (/^[\w-]{1,100}$/.test(storeId)) void recorder.visited(storeId);
    response.status(204).end();
  });
  return router;
}
