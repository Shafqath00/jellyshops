import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { createDatabase, type DatabaseResource } from "../../src/database/client.js";

const { Pool } = pg;

export interface IntegrationDatabase {
  schema: string;
  database: DatabaseResource;
  close(): Promise<void>;
}

function requireTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error(
      "TEST_DATABASE_URL is required and must target a disposable local jellyshops_test database",
    );
  }

  const parsed = new URL(value);
  const loopback = parsed.hostname === "localhost"
    || parsed.hostname === "::1"
    || parsed.hostname.startsWith("127.");
  if (!loopback || parsed.pathname !== "/jellyshops_test") {
    throw new Error(
      "TEST_DATABASE_URL must target a disposable loopback database named jellyshops_test",
    );
  }
  return value;
}

async function migrationSql(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

const migrationFiles = [
  "../../prisma/migrations/20260903164628_init/migration.sql",
  "../../prisma/migrations/20260905090000_tenant_storefront/migration.sql",
  "../../prisma/migrations/20260913160000_add_developer_membership_role/migration.sql",
  "../../prisma/migrations/20260913170000_add_audit_events/migration.sql",
  "../../prisma/migrations/20260913200000_add_media_metadata/migration.sql",
  "../../prisma/migrations/20260913210000_add_canonical_catalog/migration.sql",
] as const;

export async function createIntegrationDatabase(): Promise<IntegrationDatabase> {
  const databaseUrl = requireTestDatabaseUrl();
  const schema = `jellyshops_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
  const administration = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5_000,
    application_name: "jellyshops-integration-setup",
  });

  try {
    await administration.query(`CREATE SCHEMA "${schema}"`);
    const migrationConnection = await administration.connect();
    try {
      await migrationConnection.query(`SET search_path TO "${schema}"`);
      for (const migrationFile of migrationFiles) {
        await migrationConnection.query(await migrationSql(migrationFile));
      }
    } finally {
      migrationConnection.release();
    }

    const database = createDatabase(databaseUrl, { schema });
    await database.client.$connect();
    let closePromise: Promise<void> | undefined;
    return {
      schema,
      database,
      close() {
        closePromise ??= (async () => {
          try {
            await database.close();
          } finally {
            await administration.query(`DROP SCHEMA "${schema}" CASCADE`);
            await administration.end();
          }
        })();
        return closePromise;
      },
    };
  } catch (error) {
    try {
      await administration.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await administration.end();
    }
    throw error;
  }
}
