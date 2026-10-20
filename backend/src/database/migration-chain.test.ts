import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("bootstraps a fresh staging schema from all committed migrations", async () => {
  const db = new PGlite();
  try {
    const directory = new URL("../../sql/migrations/", import.meta.url);
    for (const name of (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort()) {
      try { await db.exec(await readFile(new URL(name, directory), "utf8")); }
      catch (error) { throw new Error(`Migration ${name} failed`, { cause: error }); }
    }
    expect((await db.query(`SELECT count(*)::integer AS count FROM information_schema.tables WHERE table_schema = 'public'`)).rows[0].count).toBeGreaterThan(35);
  } finally { await db.close(); }
}, 30000);
