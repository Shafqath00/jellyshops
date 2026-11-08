import { afterEach, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../../test/integration/pglite.js";
import { writeSqlGlobalSection } from "./sql-global-section-store.js";

let database: IntegrationDatabase | undefined;
afterEach(async () => database?.close());

it("persists shared section changes with store isolation, revisions, and atomic generation updates", async () => {
  database = await createPGliteDatabase();
  await seedStore(database, "store-a", "a");
  await seedStore(database, "store-b", "b");
  const db = database;
  const pool = { async connect() { return { async query(sql: string, values?: unknown[]) { const result = await db.query(sql, values); return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length }; }, release() {} }; } };
  const created = await writeSqlGlobalSection(pool, "store-a", null, null, { name: "Header", section: { id: "header", type: "header", enabled: true, settings: { logoText: "Before" }, blocks: [] } });
  const id = String(created.globalSection.id);
  const updated = await writeSqlGlobalSection(pool, "store-a", id, 0, { section: { ...created.globalSection.section as object, settings: { logoText: "My shop" } } });
  expect(updated.generation).toBe(created.generation + 1);
  expect(updated.globalSection.revision).toBe(1);
  const persisted = await db.query('SELECT "section" FROM "GlobalSection" WHERE "id" = $1', [id]);
  expect(persisted.rows[0].section).toMatchObject({ settings: { logoText: "My shop" } });
  await expect(writeSqlGlobalSection(pool, "store-a", id, 0, { name: "Stale" })).rejects.toMatchObject({ currentRevision: 1 });
  await expect(writeSqlGlobalSection(pool, "store-b", id, 1, { name: "Wrong store" })).rejects.toMatchObject({ status: 404 });
  expect((await db.query('SELECT "generation" FROM "StorefrontWorkspace" WHERE "storeId" = $1', ["store-a"])).rows[0].generation).toBe(updated.generation);
}, 20_000);
