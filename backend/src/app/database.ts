import { createSupabasePool } from "../database/client.js";

export const supabasePool =
  (process.env.SUPABASE_RUNTIME_DATABASE_URL || process.env.SUPABASE_DATABASE_URL)
    ? createSupabasePool()
    : undefined;
