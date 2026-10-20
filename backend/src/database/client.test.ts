import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const { Pool } = vi.hoisted(() => ({ Pool: vi.fn(function (input) { return input; }) }));
vi.mock("pg", () => ({ default: { Pool } }));
import { createSupabasePool } from "./client.js";
describe("database transport security", () => {
  it("verifies certificates even when a connection URL requests weaker TLS", () => {
    createSupabasePool("postgresql://user:password@db.example.test/postgres?sslmode=require");
    const config = Pool.mock.calls.at(-1)?.[0];
    expect(config.ssl.rejectUnauthorized).toBe(true);
    expect(config.connectionString).not.toContain("sslmode");
  });

  it("loads an explicit Supabase CA file without disabling certificate verification", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "jelly-supabase-ca-"));
    const ca = "-----BEGIN CERTIFICATE-----\nlocal-test-ca\n-----END CERTIFICATE-----\n";
    const file = path.join(directory, "supabase-root.crt");
    const previousFile = process.env.SUPABASE_DATABASE_CA_FILE;
    const previousInline = process.env.SUPABASE_DATABASE_CA;
    writeFileSync(file, ca, "utf8");

    try {
      process.env.SUPABASE_DATABASE_CA_FILE = file;
      delete process.env.SUPABASE_DATABASE_CA;
      createSupabasePool("postgresql://user:password@db.example.test/postgres");
      const config = Pool.mock.calls.at(-1)?.[0];
      expect(config.ssl).toEqual({ rejectUnauthorized: true, ca: readFileSync(file, "utf8") });
    } finally {
      if (previousFile === undefined) delete process.env.SUPABASE_DATABASE_CA_FILE;
      else process.env.SUPABASE_DATABASE_CA_FILE = previousFile;
      if (previousInline === undefined) delete process.env.SUPABASE_DATABASE_CA;
      else process.env.SUPABASE_DATABASE_CA = previousInline;
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
