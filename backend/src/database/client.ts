import pg from "pg";

const { Pool } = pg;

export function createSupabasePool(connectionString = process.env.SUPABASE_DATABASE_URL): pg.Pool {
  if (!connectionString) throw new Error("SUPABASE_DATABASE_URL is required");
  return new Pool({ connectionString, max: 5, ssl: { rejectUnauthorized: false } });
}
