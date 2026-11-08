import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

describe("server-owned database isolation", () => {
  const databases: PGlite[] = [];
  afterEach(async () => { await Promise.all(databases.splice(0).map((db) => db.close())); });

  it("revokes browser access, enables RLS, and protects future tables without blocking the owner", async () => {
    const db = new PGlite(); databases.push(db);
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE TABLE public."Store" (id text PRIMARY KEY);
      INSERT INTO public."Store" VALUES ('private');
      GRANT USAGE ON SCHEMA public TO anon, authenticated;
      GRANT ALL ON public."Store" TO anon, authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;`);
    const migration = await readFile(new URL("../../sql/security/isolate-server-owned-data.sql", import.meta.url), "utf8");
    await db.exec(migration);
    const result = await db.query<{ rls: boolean; allowed: boolean }>(`SELECT c.relrowsecurity AS rls, has_table_privilege('anon', c.oid, 'SELECT') AS allowed FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'Store'`);
    expect(result.rows).toEqual([{ rls: true, allowed: false }]);
    await db.exec(`CREATE TABLE public."FutureTable" (id text);`);
    expect((await db.query<{ allowed: boolean }>(`SELECT has_table_privilege('authenticated', 'public."FutureTable"', 'INSERT') AS allowed`)).rows[0].allowed).toBe(false);
    await db.exec(`SET ROLE anon`);
    await expect(db.query(`SELECT * FROM public."Store"`)).rejects.toThrow(/permission denied/);
    await db.exec(`RESET ROLE`);
    expect((await db.query(`SELECT * FROM public."Store"`)).rows).toEqual([{ id: "private" }]);
  });
});
