import type { RequestHandler } from "express";

/**
 * Tells the storefront (Next.js) that a store changed, so its cached pages are rebuilt on the next visit.
 *
 * Published store pages are cached by the storefront and only rebuilt when asked (or after a safety limit). This calls
 * the storefront's `POST /api/revalidate` with the store id. Set `STOREFRONT_REVALIDATE_URL` (for example
 * `https://jellyshop.io/api/revalidate`) and `STOREFRONT_REVALIDATE_SECRET` (the same value on the storefront);
 * without them nothing is sent and the storefront falls back to its time limit.
 */
export interface StorefrontRefresher {
  /** Resolves once the storefront answered or the wait ran out; never throws. */
  storeChanged(storeId: string): Promise<void>;
  readonly enabled: boolean;
}

export interface StorefrontRefresherOptions {
  url?: string;
  secret?: string;
  /** How long a merchant request waits for the storefront before carrying on (ms). */
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export function createStorefrontRefresher(options: StorefrontRefresherOptions = {}): StorefrontRefresher {
  const { url, secret, timeoutMs = 1500, fetch: fetcher = fetch } = options;
  if (!url || !secret) return { enabled: false, storeChanged: async () => undefined };
  let warned = false;
  return {
    enabled: true,
    async storeChanged(storeId: string) {
      try {
        const response = await fetcher(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
          body: JSON.stringify({ storeId }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) throw new Error(`status ${response.status}`);
      } catch (error) {
        // One warning per instance is enough: the storefront still refreshes on its time limit.
        if (!warned) {
          warned = true;
          console.warn(JSON.stringify({ level: "warn", message: "storefront refresh failed", storeId, error: error instanceof Error ? error.message : String(error) }));
        }
      }
    },
  };
}

export function storefrontRefresherFromEnv(env: NodeJS.ProcessEnv = process.env): StorefrontRefresher {
  return createStorefrontRefresher({ url: env.STOREFRONT_REVALIDATE_URL, secret: env.STOREFRONT_REVALIDATE_SECRET });
}

const STORE_ROUTE = /^\/api\/stores\/([^/]+)\//;
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * After any successful change a merchant makes through `/api/stores/:storeId/...`, ask the storefront to refresh that
 * store before the response is sent. Waiting (up to the refresher's time limit) matters on Cloud Functions, which slow
 * an instance down once it has answered, so a call started afterwards may never finish. Draft-only edits refresh too:
 * that costs one small request, and it keeps the rule simple enough that nothing a shopper sees is ever missed.
 */
export function refreshStorefrontAfterChanges(refresher: StorefrontRefresher): RequestHandler {
  return (request, response, next) => {
    if (!refresher.enabled || READ_METHODS.has(request.method)) return next();
    const storeId = STORE_ROUTE.exec(request.originalUrl)?.[1];
    if (!storeId) return next();
    const end = response.end.bind(response) as (...args: unknown[]) => typeof response;
    let ending = false;
    response.end = ((...args: unknown[]) => {
      if (ending || response.statusCode >= 400) return end(...args);
      ending = true;
      void refresher.storeChanged(decodeURIComponent(storeId)).finally(() => end(...args));
      return response;
    }) as typeof response.end;
    next();
  };
}
