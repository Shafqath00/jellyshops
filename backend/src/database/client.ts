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
  const pool = new Pool({
    connectionString: url.toString(),
    max,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    keepAlive: true,
    ssl: {
      rejectUnauthorized: true,
      ...(ca ? { ca } : {}),
    },
  });
  // An idle connection the database or network drops (ECONNRESET) emits "error" on the pool. Without a
  // listener Node treats it as uncaught and the whole server exits; the pool already discards that client.
  pool.on("error", (error: Error & { code?: string }) => {
    console.warn(`Database connection dropped while idle (${error.code ?? error.message}); it will be replaced.`);
  });
  return pool;
}
