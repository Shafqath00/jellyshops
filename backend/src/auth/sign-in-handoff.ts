import { Router } from "express";
import { ApiError } from "../http/errors.js";
import { requireMerchant } from "./middleware.js";
import type { AuthProvider } from "./types.js";

/**
 * Sign-in hand-off: sessions live in each site's own browser storage, so someone signed in on jellyshop.io is not
 * signed in on admin.jellyshop.io. The main site asks for a one-time sign-in token for the merchant who is already
 * signed in there; admin.jellyshop.io/auth/continue exchanges it for its own, separate session (no refresh token is
 * copied between sites). Design: docs/plans/2026-11-22-subdomain-tenancy-plan.md §6.
 *
 * `POST /api/auth/handoff` (merchant token) → `{ tokenHash }`. Supabase's admin "magic link" generator makes the
 * token without sending an email; it is single use and expires on Supabase's schedule.
 */
export type HandoffTokenMaker = (email: string) => Promise<string>;

/** Asks Supabase (admin API, server secret) for a one-time sign-in token for this email. */
export function supabaseHandoffTokenMaker(options: { url: string; secretKey: string; fetch?: typeof fetch }): HandoffTokenMaker {
  const request = options.fetch ?? fetch;
  const base = options.url.replace(/\/+$/, "");
  return async (email) => {
    const response = await request(`${base}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: { apikey: options.secretKey, Authorization: `Bearer ${options.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "magiclink", email }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`generate_link failed with ${response.status}`);
    const body = await response.json() as { hashed_token?: string; properties?: { hashed_token?: string } };
    const token = body.hashed_token ?? body.properties?.hashed_token;
    if (!token) throw new Error("generate_link returned no token");
    return token;
  };
}

const WINDOW_MS = 10 * 60_000;
const LIMIT = 10;
const MAX_ENTRIES = 10_000;

/** At most 10 hand-offs per merchant in 10 minutes, kept in this server's memory. */
export function createHandoffLimiter(now: () => number = Date.now) {
  const recent = new Map<string, number[]>();
  return (userId: string): boolean => {
    const time = now();
    const kept = (recent.get(userId) ?? []).filter((at) => time - at < WINDOW_MS);
    if (kept.length >= LIMIT) { recent.set(userId, kept); return false; }
    if (!recent.has(userId) && recent.size >= MAX_ENTRIES) recent.delete(recent.keys().next().value as string);
    recent.set(userId, [...kept, time]);
    return true;
  };
}

export function createSignInHandoffRouter(authProvider: AuthProvider, makeToken: HandoffTokenMaker | null, allow = createHandoffLimiter()): Router {
  const router = Router();
  router.post("/", requireMerchant(authProvider), async (request, response, next) => {
    try {
      if (!makeToken) throw new ApiError(503, "HANDOFF_UNAVAILABLE", "Signing in on the dashboard isn't set up on this server. Sign in there instead.");
      const merchant = request.merchant!;
      if (!merchant.email) throw new ApiError(400, "HANDOFF_NO_EMAIL", "This account has no email address. Sign in on the dashboard instead.");
      if (!allow(merchant.userId)) throw new ApiError(429, "HANDOFF_RATE_LIMITED", "Too many tries. Wait a few minutes, or sign in on the dashboard.");
      let tokenHash: string;
      try {
        tokenHash = await makeToken(merchant.email);
      } catch {
        throw new ApiError(502, "HANDOFF_FAILED", "We couldn't sign you in to the dashboard. Sign in there instead.");
      }
      response.set("Cache-Control", "no-store").json({ tokenHash });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
