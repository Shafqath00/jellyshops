import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        throw new ApiError(401, "AUTH_INVALID", "Invalid or expired token");
      }

      // 1. We know the user's Supabase UUID.
      // 2. We use our TenantRepository (or our PostgreSQL database layer) to resolve
      //    their merchant identity and find what stores they own.
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
      if (error instanceof ApiError) {
        throw error;
      }
      console.error("Supabase verification failed:", error);
      throw new ApiError(401, "AUTH_INVALID", "Could not verify authentication token");
    }
  }
}
