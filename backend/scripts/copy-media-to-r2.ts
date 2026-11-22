/**
 * Copies every uploaded file from Supabase Storage to Cloudflare R2, key for key (speed and cost plan, Phase 3).
 *
 *   npx tsx scripts/copy-media-to-r2.ts <approved Supabase project ref> --dry-run
 *   npx tsx scripts/copy-media-to-r2.ts <approved Supabase project ref>
 *
 * Needs the backend's Supabase settings plus R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET.
 * Reads from Supabase only (nothing there is changed or deleted), skips files already in R2 with the same size, and
 * writes nothing to the database. The project ref must match the configured Supabase address, so it can't run against
 * the wrong project by accident.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const approvedProjectRef = process.argv[2]?.startsWith("--") ? undefined : process.argv[2];
const dryRun = process.argv.includes("--dry-run");
const env = process.env;
if (!approvedProjectRef || !env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  throw new Error("Usage: copy-media-to-r2.ts <approved Supabase project ref> [--dry-run] (and the backend's Supabase settings).");
}
if (new URL(env.SUPABASE_URL).hostname !== `${approvedProjectRef}.supabase.co`) throw new Error("The approved project ref does not match the configured Supabase address.");
if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
  throw new Error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET must be set.");
}

const { SupabaseMediaStorage } = await import("../src/media/supabase-media-storage.js");
const { R2MediaStorage } = await import("../src/media/r2-media-storage.js");
const { copyMediaToR2 } = await import("../src/media/copy-to-r2.js");

const source = new SupabaseMediaStorage(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, env.SUPABASE_MEDIA_BUCKET || "media");
// No fallback here: the target must answer for R2 alone.
const target = new R2MediaStorage({ accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, bucket: env.R2_BUCKET });
const result = await copyMediaToR2(source, target, { dryRun });
console.log(JSON.stringify({ dryRun, ...result, bytes: `${(result.bytes / 1024 / 1024).toFixed(1)} MB` }, null, 2));
if (result.problems.length) process.exitCode = 1;
