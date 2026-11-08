import { createHash } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { ApiError } from "../http/errors.js";
import type { TenantRepository } from "../tenants/repository.js";
import type { AuthProvider, MerchantPrincipal } from "./types.js";

/** How long a token Supabase has confirmed is trusted without asking again. Never past the token's own expiry. */
export const VERIFIED_TOKEN_TTL_MS = 60_000;
const MAX_CACHED_TOKENS = 1000;

function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch { return null; }
}

export class SupabaseAuthProvider implements AuthProvider {
  private readonly supabase: SupabaseClient;
  /** Confirmed sign-ins by token hash. Every request otherwise waited on a network call to Supabase Auth. */
  private readonly verified = new Map<string, { user: User; until: number }>();
  now: () => number = () => Date.now();

  constructor(
    private readonly supabaseUrl: string,
    private readonly supabaseAnonKey: string,
    private readonly tenants: TenantRepository,
  ) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase credentials are required for SupabaseAuthProvider");
    }
    
    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      realtime: {
        timeout: 0,
        params: {},
        log_level: "disable",
      },
    });
  }

  async verify(token: string): Promise<MerchantPrincipal> {
    let user: User;
    const key = createHash("sha256").update(token).digest("hex");
    const cached = this.verified.get(key);
    try {
      if (cached && cached.until > this.now()) {
        user = cached.user;
      } else {
        this.verified.delete(key);
        const response = await this.supabase.auth.getUser(token);
        if (response.error || !response.data.user) {
          throw new ApiError(401, "AUTH_INVALID", "Invalid or expired token");
        }
        user = response.data.user;
        const expiry = tokenExpiry(token);
        const until = Math.min(this.now() + VERIFIED_TOKEN_TTL_MS, expiry ?? this.now());
        if (until > this.now()) {
          if (this.verified.size >= MAX_CACHED_TOKENS) this.verified.delete(this.verified.keys().next().value!);
          this.verified.set(key, { user, until });
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      console.error("Supabase auth request failed:", error);
      throw new ApiError(503, "AUTH_PROVIDER_UNAVAILABLE", "The authentication provider is temporarily unavailable");
    }

    // 1. We know the user's Supabase UUID.
    // 2. Resolve their merchant identity and stores in the application database.
    try {
      const account = await this.tenants.resolveMerchant({
        uid: user.id,
        email: user.email ?? "",
        name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Unknown",
      });

      const storeIds = account.stores.map((s) => s.id);
      const storeRoles = Object.fromEntries(account.stores.map((s) => [s.id, s.role]));

      return {
        userId: user.id,
        storeIds,
        storeRoles,
      };
    } catch (error) {
      console.error("Supabase merchant lookup failed:", error);
      throw new ApiError(503, "MERCHANT_DATA_UNAVAILABLE", "Merchant data is temporarily unavailable");
    }
  }
}
