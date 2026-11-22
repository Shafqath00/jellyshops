/**
 * Fills the copy widths and blur placeholder for images uploaded before Phase 2 of the speed plan.
 *
 *   npx tsx scripts/backfill-media-variants.ts <approved Supabase project ref> --dry-run
 *   npx tsx scripts/backfill-media-variants.ts <approved Supabase project ref>
 *
 * Reads files from the configured media storage (never changes them) and writes only to empty Media columns.
 * The project ref must match both configured Supabase targets, so it can't run against the wrong database by accident.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const approvedProjectRef = process.argv[2]?.startsWith("--") ? undefined : process.argv[2];
const dryRun = process.argv.includes("--dry-run");
const supabaseUrl = process.env.SUPABASE_URL;
const databaseUrl = process.env.SUPABASE_RUNTIME_DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
if (!approvedProjectRef || !supabaseUrl || !databaseUrl) {
  throw new Error("Usage: backfill-media-variants.ts <approved Supabase project ref> [--dry-run] (and the backend's Supabase configuration).");
}
const database = new URL(databaseUrl);
const approved = new URL(supabaseUrl).hostname === `${approvedProjectRef}.supabase.co`
  && (database.hostname === `db.${approvedProjectRef}.supabase.co`
    || (database.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(database.username).endsWith(`.${approvedProjectRef}`)));
if (!approved) throw new Error("The approved project ref does not match both configured Supabase targets.");

const { loadConfig } = await import("../src/config.js");
const { createDefaultMediaStorage } = await import("../src/app/dependencies.js");
const { createSupabasePool } = await import("../src/database/client.js");
const { backfillMediaVariants } = await import("../src/media/backfill-variants.js");

const pool = createSupabasePool();
try {
  const result = await backfillMediaVariants(pool, createDefaultMediaStorage(loadConfig()), { dryRun });
  console.log(JSON.stringify({ dryRun, ...result }, null, 2));
} finally {
  await pool.end();
}
