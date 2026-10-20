import "dotenv/config";
import { config as loadDotEnv } from "dotenv";
import { createClient, type User } from "@supabase/supabase-js";
import pg from "pg";
import { fileURLToPath } from "node:url";
import {
  assertOnboardingAccountMarker,
  resolveOnboardingE2eTarget,
  validateOnboardingEmail,
} from "./lib/onboarding-e2e-target.js";
import { ONBOARDING_E2E_STORE_SLUG_PREFIX, resetOnboardingE2eStores } from "./lib/onboarding-e2e-reset.js";
import { postgresCommerceDatabase } from "../src/commerce/repository.js";

const localConfigPath = fileURLToPath(new URL("../../jellyshops/.env.onboarding.local", import.meta.url));
loadDotEnv({ path: localConfigPath });

const target = resolveOnboardingE2eTarget({
  projectRef: process.env.JELLY_ONBOARDING_E2E_PROJECT_REF,
  authUrl: process.env.SUPABASE_URL,
  databaseUrl: process.env.SUPABASE_DATABASE_URL,
});
const email = validateOnboardingEmail(process.env.JELLY_ONBOARDING_E2E_EMAIL ?? "");
const password = process.env.JELLY_ONBOARDING_E2E_PASSWORD?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
if (!password || !secretKey || !anonKey) throw new Error("Onboarding E2E credentials and server/client Supabase keys must be configured locally.");

const apiUrl = (process.env.JELLY_ONBOARDING_E2E_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const adminClient = createClient(target.authUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
const signInClient = createClient(target.authUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
const pool = new pg.Pool({ connectionString: target.databaseUrl, max: 1, connectionTimeoutMillis: 15_000 });

try {
  const user = await findAuthUser(adminClient, email);
  if (!user) throw new Error("Dedicated onboarding E2E Auth account is missing; run npm run provision:onboarding-e2e first.");
  assertOnboardingAccountMarker(user.app_metadata);
  const { data, error } = await signInClient.auth.signInWithPassword({ email, password });
  if (error || !data.session || data.user.id !== user.id) throw new Error("Dedicated onboarding E2E merchant sign-in could not be verified.");

  const readMerchant = async () => {
    const response = await fetch(`${apiUrl}/api/me`, { headers: { Authorization: `Bearer ${data.session!.access_token}` } });
    if (!response.ok) throw new Error(`Local backend /api/me preflight failed with HTTP ${response.status}. Start the configured local backend and retry.`);
    const body = await response.json() as { merchantId?: string; stores?: Array<{ id: string; slug: string }> };
    if (body.merchantId !== user.id || !Array.isArray(body.stores)) throw new Error("The backend merchant identity did not match the dedicated onboarding account.");
    return body.stores;
  };

  const before = await readMerchant();
  if (before.some((store) => !store.slug.startsWith(ONBOARDING_E2E_STORE_SLUG_PREFIX))) {
    throw new Error("Refusing reset because the dedicated onboarding merchant owns a store outside the reserved E2E prefix.");
  }
  const result = await resetOnboardingE2eStores(postgresCommerceDatabase(pool), {
    merchantUid: user.id,
    merchantEmail: email,
    slugPrefix: ONBOARDING_E2E_STORE_SLUG_PREFIX,
  });
  const after = await readMerchant();
  if (after.length !== 0) throw new Error("The dedicated onboarding merchant still owns active stores after reset.");
  process.stdout.write(`Onboarding E2E reset is ready (${result.resetStoreIds.length} dedicated test store(s) reset); Auth and internal user accounts remain.\n`);
} finally {
  await pool.end();
}

async function findAuthUser(client: ReturnType<typeof createClient>, exactEmail: string): Promise<User | null> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Could not safely inspect the configured Supabase Auth account list.");
    const match = data.users.find((candidate) => candidate.email?.toLowerCase() === exactEmail);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}
