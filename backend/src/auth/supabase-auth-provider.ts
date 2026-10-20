import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { ApiError } from "../http/errors.js";
import type { TenantRepository } from "../tenants/repository.js";
import type { AuthProvider, MerchantPrincipal } from "./types.js";

export class SupabaseAuthProvider implements AuthProvider {
  private readonly supabase: SupabaseClient;

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
    try {
      const response = await this.supabase.auth.getUser(token);

      if (response.error || !response.data.user) {
        throw new ApiError(401, "AUTH_INVALID", "Invalid or expired token");
      }
      user = response.data.user;
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
