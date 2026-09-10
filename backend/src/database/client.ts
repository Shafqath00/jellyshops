import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.js";

const { Pool } = pg;

export interface DatabaseResource {
  client: PrismaClient;
  close(): Promise<void>;
}

export interface DatabaseOptions {
  schema?: string;
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost"
    || hostname === "::1"
    || hostname.startsWith("127.");
}

function parseDatabaseUrl(databaseUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Database URL must be a valid URL");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("Database URL must use PostgreSQL");
  }

  const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
  if (!isLoopback(parsed.hostname) && !["require", "verify-ca", "verify-full"].includes(sslMode ?? "")) {
    throw new Error("Remote database connections must require TLS");
  }

  return parsed;
}

export function createDatabase(databaseUrl: string, options: DatabaseOptions = {}): DatabaseResource {
  parseDatabaseUrl(databaseUrl);
  if (options.schema && !/^[a-z][a-z0-9_]*$/.test(options.schema)) {
    throw new Error("Database schema name is invalid");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "jellyshops-api",
    options: options.schema ? `-c search_path=${options.schema}` : undefined,
  });
  const client = new PrismaClient({
    adapter: new PrismaPg(pool, options.schema ? { schema: options.schema } : undefined),
  });
  let closePromise: Promise<void> | undefined;

  return {
    client,
    close() {
      closePromise ??= (async () => {
        try {
          await client.$disconnect();
        } finally {
          await pool.end();
        }
      })();
      return closePromise;
    },
  };
}
