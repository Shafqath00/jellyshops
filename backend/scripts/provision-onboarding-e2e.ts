import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { config as loadDotEnv } from "dotenv";
import pg from "pg";
import { createClient, type User } from "@supabase/supabase-js";
import {
  assertOnboardingAccountMarker,
  resolveOnboardingE2eTarget,
  validateOnboardingEmail,
} from "./lib/onboarding-e2e-target.js";

loadDotEnv({ path: fileURLToPath(new URL("../../jellyshops/.env.onboarding.local", import.meta.url)) });

const target = resolveOnboardingE2eTarget({
  projectRef: process.env.JELLY_ONBOARDING_E2E_PROJECT_REF,
  authUrl: process.env.SUPABASE_URL,
  databaseUrl: process.env.SUPABASE_DATABASE_URL,
});
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is required for the server-side Auth Admin setup.");

const email = validateOnboardingEmail(
  process.env.JELLY_ONBOARDING_E2E_EMAIL?.trim() || `jelly-onboarding-e2e+${target.projectRef}@example.test`,
);
const configuredPassword = process.env.JELLY_ONBOARDING_E2E_PASSWORD?.trim();
const password = configuredPassword || randomBytes(36).toString("base64url");
const auth = createClient(target.authUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const pool = new pg.Pool({ connectionString: target.databaseUrl, max: 1, connectionTimeoutMillis: 15_000 });

try {
  await pool.query("SELECT 1");
  const existing = await findAuthUser(auth, email);
  if (existing) {
    assertOnboardingAccountMarker(existing.app_metadata);
    if (!configuredPassword) {
      const { error } = await auth.auth.admin.updateUserById(existing.id, { password });
      if (error) throw new Error("Could not generate the missing dedicated onboarding test password.");
    }
  } else {
    const { error } = await auth.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { jelly_e2e_role: "storeless-onboarding" },
    });
    if (error) throw new Error("Could not provision the dedicated onboarding E2E Auth account.");
  }

  const configPath = fileURLToPath(new URL("../../jellyshops/.env.onboarding.local", import.meta.url));
  const existingText = await readFile(configPath, "utf8").catch(() => "");
  const nextText = upsertEnv(existingText, {
    JELLY_ONBOARDING_E2E_PROJECT_REF: target.projectRef,
    JELLY_ONBOARDING_E2E_EMAIL: email,
    JELLY_ONBOARDING_E2E_PASSWORD: password,
  });
  await writeFile(configPath, nextText, { encoding: "utf8", mode: 0o600 });
  process.stdout.write("Dedicated storeless onboarding merchant is ready; credentials were saved to the ignored local E2E file.\n");
} finally {
  await pool.end();
}

async function findAuthUser(client: ReturnType<typeof createClient>, exactEmail: string): Promise<User | null> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Could not safely inspect the configured Supabase Auth account list.");
    const match = data.users.find((user) => user.email?.toLowerCase() === exactEmail);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}

function upsertEnv(source: string, values: Record<string, string>): string {
  const lines = source.split(/\r?\n/);
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${JSON.stringify(value)}`;
    const index = lines.findIndex((existing) => new RegExp(`^\\s*${key}\\s*=`).test(existing));
    if (index >= 0) lines[index] = line;
    else lines.push(line);
  }
  return `${lines.filter((line, index) => line || index < lines.length - 1).join("\n").replace(/\n*$/, "")}\n`;
}
