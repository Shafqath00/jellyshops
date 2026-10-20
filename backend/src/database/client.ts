import { readFileSync } from "node:fs";
import pg from "pg";

const { Pool } = pg;

export function createSupabasePool(connectionString = process.env.SUPABASE_RUNTIME_DATABASE_URL || process.env.SUPABASE_DATABASE_URL): pg.Pool {
  if (!connectionString) throw new Error("SUPABASE_RUNTIME_DATABASE_URL is required");
  const url = new URL(connectionString);
  // pg's URL options otherwise replace the explicit SSL object below.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert", "ssl"]) url.searchParams.delete(key);
  const max = Number(process.env.DATABASE_POOL_MAX ?? 5);
  if (!Number.isInteger(max) || max < 1 || max > 20) throw new Error("DATABASE_POOL_MAX must be between 1 and 20");
  const caFile = process.env.SUPABASE_DATABASE_CA_FILE?.trim();
  const ca = caFile
    ? readFileSync(caFile, "utf8")
    : process.env.SUPABASE_DATABASE_CA?.replaceAll("\\n", "\n");
  return new Pool({
    connectionString: url.toString(),
    max,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    ssl: {
      rejectUnauthorized: true,
      ...(ca ? { ca } : {}),
    },
  });
}
