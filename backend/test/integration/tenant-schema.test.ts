import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Every table is either one shop's data or knowingly global (docs/plans/2026-11-22-subdomain-tenancy-plan.md §4, §5,
 * step 11). Builds the whole schema from both migration folders in date order (as staging was built), with the
 * Supabase roles present so the grants and policies really run, then checks each table:
 *   - row security on, a policy for the backend role, and nothing granted to the browser roles (anon, authenticated);
 *   - shop data: a NOT NULL "storeId" tied to "Store" by a foreign key (directly or through a key that includes it);
 *   - anything else must be listed in GLOBAL_TABLES with the reason, so a new table is a decision, not an accident.
 */
const GLOBAL_TABLES: Record<string, string> = {
  Store: "the shops themselves",
  User: "people, who may belong to several shops",
  MerchantProfile: "one person's profile, across their shops",
  MerchantOnboarding: "a person's sign-up answers before their shop exists",
  MerchantOnboardingImage: "pictures uploaded during sign-up, before the shop exists",
  MerchantPolicyAcceptance: "a person's acceptance of Jellyshop's terms",
  DigitalDownloadAttempt: "download counts, reached only through a shop's digital entitlement",
  ReservedSlug: "shop addresses nobody may take",
  PlatformAdmin: "Jellyshop staff",
  PlatformAuditEvent: "what Jellyshop staff did (may name a shop, may not)",
  StripeWebhookEvent: "Stripe's events, matched to a shop while they are processed",
  WebhookProcessingAttempt: "retries of Stripe's events",
  ThemePackage: "uploaded themes, owned by a shop through their owner column",
  ThemePackageVersion: "versions of an uploaded theme",
};

type TableFacts = {
  name: string; rls: boolean; hasStoreId: boolean; storeIdNullable: boolean; storeKey: boolean;
  backendPolicy: boolean; browserPolicy: boolean; browserGrant: boolean;
};

let tables: TableFacts[] = [];
let rights: Record<string, { select: boolean; insert: boolean; update: boolean; delete: boolean }> = {};

beforeAll(async () => {
  const database = new PGlite();
  for (const role of ["anon", "authenticated", "jelly_backend"]) await database.exec(`CREATE ROLE ${role}`);
  const files = new Map<string, URL>();
  for (const folder of ["../../sql/migrations/", "../../supabase/migrations/"].map((path) => new URL(path, import.meta.url))) {
    for (const name of (await readdir(folder)).filter((file) => file.endsWith(".sql"))) if (!files.has(name)) files.set(name, new URL(name, folder));
  }
  for (const name of [...files.keys()].sort()) await database.exec(await readFile(files.get(name)!, "utf8"));
  const result = await database.query<TableFacts>(`
    SELECT c.relname AS "name", c.relrowsecurity AS "rls",
      k."column_name" IS NOT NULL AS "hasStoreId", COALESCE(k."is_nullable" = 'YES', false) AS "storeIdNullable",
      EXISTS (SELECT 1 FROM pg_constraint f JOIN pg_attribute a ON a.attrelid = f.conrelid AND a.attnum = ANY(f.conkey)
              WHERE f.conrelid = c.oid AND f.contype = 'f' AND a.attname = 'storeId') AS "storeKey",
      EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname AND 'jelly_backend' = ANY(p.roles)) AS "backendPolicy",
      EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname AND (p.roles && ARRAY['anon', 'authenticated', 'public']::name[])) AS "browserPolicy",
      (has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE') OR has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE')) AS "browserGrant"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN information_schema.columns k ON k.table_schema = 'public' AND k.table_name = c.relname AND k.column_name = 'storeId'
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY 1`);
  tables = result.rows;
  for (const name of ["PlatformAdmin", "PlatformAuditEvent"]) {
    const row = (await database.query<{ select: boolean; insert: boolean; update: boolean; delete: boolean }>(
      `SELECT has_table_privilege('jelly_backend', $1, 'SELECT') AS "select", has_table_privilege('jelly_backend', $1, 'INSERT') AS "insert",
              has_table_privilege('jelly_backend', $1, 'UPDATE') AS "update", has_table_privilege('jelly_backend', $1, 'DELETE') AS "delete"`,
      [`public."${name}"`],
    )).rows[0]!;
    rights[name] = row;
  }
}, 300_000);

describe("database tables and shops", () => {
  it("reads the whole schema", () => {
    expect(tables.length).toBeGreaterThan(60);
    expect(tables.map((table) => table.name)).toEqual(expect.arrayContaining(["Store", "Order", "Product", "StoreSlugHistory", "PlatformAdmin"]));
  });

  it("protects every table from the browser and lets only the backend in", () => {
    const problems = tables.flatMap((table) => [
      ...(table.rls ? [] : [`${table.name}: row security is off`]),
      ...(table.backendPolicy ? [] : [`${table.name}: no policy for the backend role`]),
      ...(table.browserPolicy ? [`${table.name}: a policy lets the browser in`] : []),
      ...(table.browserGrant ? [`${table.name}: the browser has table rights`] : []),
    ]);
    expect(problems).toEqual([]);
  });

  it("ties every shop table to its shop, and names every global table", () => {
    const problems = tables.flatMap((table) => {
      if (GLOBAL_TABLES[table.name]) return [];
      if (!table.hasStoreId) return [`${table.name}: no storeId (add one, or list it in GLOBAL_TABLES with the reason)`];
      if (table.storeIdNullable) return [`${table.name}: storeId may be empty`];
      if (!table.storeKey) return [`${table.name}: storeId isn't tied to Store by a foreign key`];
      return [];
    });
    expect(problems).toEqual([]);
  });

  it("lets the backend read platform admins but never add or change them, and only add to their log", () => {
    expect(rights.PlatformAdmin).toEqual({ select: true, insert: false, update: false, delete: false });
    expect(rights.PlatformAuditEvent).toEqual({ select: true, insert: true, update: false, delete: false });
  });

  it("keeps the list of global tables up to date", () => {
    const names = new Set(tables.map((table) => table.name));
    expect(Object.keys(GLOBAL_TABLES).filter((name) => !names.has(name))).toEqual([]);
  });
});
