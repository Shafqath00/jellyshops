import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// An in-memory PostgreSQL database only. Never reads DATABASE_URL or .env.
const db = new PGlite();
const sql = async (relative) => readFile(new URL(relative, import.meta.url), 'utf8');
let checks = 0;
async function rejectsSql(statement, code) {
  await assert.rejects(db.exec(statement), (error) => error.code === code);
  checks++;
}

try {
  await db.exec(await sql('../prisma/migrations/20260903164628_init/migration.sql'));
  await db.exec(`INSERT INTO "User" (name, email, "createdAt")
    VALUES ('Existing merchant', 'existing@example.test', '2026-01-01');`);
  await db.exec(await sql('../prisma/migrations/20260905090000_tenant_storefront/migration.sql'));

  const { rows: users } = await db.query(`SELECT id, name, email, "firebaseUid",
    "updatedAt" = "createdAt" AS backfilled FROM "User"`);
  assert.deepEqual(users, [{ id: 1, name: 'Existing merchant',
    email: 'existing@example.test', firebaseUid: null, backfilled: true }]);
  checks++;

  const { rows: tables } = await db.query(`SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' ORDER BY tablename`);
  assert.deepEqual(tables.map((r) => r.tablename), ['Store', 'StoreDomain',
    'StoreMembership', 'StoreSettings', 'StorefrontDraft', 'StorefrontPublication', 'User']);
  checks++;

  await db.exec(`INSERT INTO "Store" (id, name, slug, currency, country, "updatedAt")
    VALUES ('a', 'A', 'a', 'USD', 'US', now()), ('b', 'B', 'b', 'USD', 'US', now());
    INSERT INTO "StoreMembership" ("storeId", "userId", role) VALUES ('a', 1, 'OWNER');
    INSERT INTO "StoreSettings" ("storeId") VALUES ('a');
    INSERT INTO "StoreDomain" (id, "storeId", hostname, "updatedAt")
      VALUES ('domain-a', 'a', 'a.example.test', now());
    INSERT INTO "StorefrontDraft" ("storeId", revision, document, "updatedAt")
      VALUES ('a', 0, '{}', now());`);

  await rejectsSql(`INSERT INTO "StoreMembership" ("storeId", "userId") VALUES ('a', 1)`, '23505');
  await rejectsSql(`INSERT INTO "StoreMembership" ("storeId", "userId") VALUES ('missing', 1)`, '23503');
  await rejectsSql(`INSERT INTO "StoreMembership" ("storeId", "userId") VALUES ('b', 999)`, '23503');
  await rejectsSql(`UPDATE "StorefrontDraft" SET revision = -1`, '23514');
  await rejectsSql(`UPDATE "StorefrontDraft" SET document = '[]'`, '23514');
  await rejectsSql(`UPDATE "StorefrontDraft" SET document = 'null'`, '23514');
  await rejectsSql(`UPDATE "Store" SET currency = 'usd' WHERE id = 'a'`, '23514');
  await rejectsSql(`UPDATE "Store" SET country = 'U' WHERE id = 'a'`, '23514');

  await db.exec(`UPDATE "StorefrontDraft" SET revision = 1 WHERE "storeId" = 'a';
    INSERT INTO "StorefrontPublication" (id, "storeId", "sourceRevision", document)
      VALUES ('pub-a', 'a', 1, '{}');
    UPDATE "Store" SET "currentPublicationId" = 'pub-a' WHERE id = 'a';`);
  await rejectsSql(`UPDATE "Store" SET "currentPublicationId" = 'pub-a' WHERE id = 'b'`, '23503');
  await rejectsSql(`INSERT INTO "StorefrontPublication" (id, "storeId", "sourceRevision", document)
    VALUES ('bad-revision', 'a', 0, '{}')`, '23514');
  await rejectsSql(`INSERT INTO "StorefrontPublication" (id, "storeId", "sourceRevision", document)
    VALUES ('bad-document', 'a', 1, 'null')`, '23514');
  await rejectsSql(`UPDATE "StorefrontPublication" SET document = '{"changed":true}'`, '23514');
  // Unpublish first so deletion checks prove the trigger, not the live-pointer FK.
  await db.exec(`UPDATE "Store" SET "currentPublicationId" = NULL WHERE id = 'a'`);
  await rejectsSql(`DELETE FROM "StorefrontPublication" WHERE id = 'pub-a'`, '23514');
  await rejectsSql(`TRUNCATE "StorefrontPublication" CASCADE`, '23514');
  await rejectsSql(`DELETE FROM "Store" WHERE id = 'a'`, '23503');

  await db.exec(`UPDATE "User" SET "firebaseUid" = 'firebase-1' WHERE id = 1;
    INSERT INTO "User" (name, email, "updatedAt") VALUES ('Second', 'second@example.test', now());`);
  await rejectsSql(`UPDATE "User" SET "firebaseUid" = 'firebase-1' WHERE id = 2`, '23505');
  const { rows: ids } = await db.query(`SELECT id FROM "User" ORDER BY id`);
  assert.deepEqual(ids, [{ id: 1 }, { id: 2 }]);
  checks++;
  const { rows: publications } = await db.query(`SELECT document FROM "StorefrontPublication" WHERE id = 'pub-a'`);
  assert.deepEqual(publications, [{ document: {} }]);
  checks++;
  console.log(`Phase-one migration: ${checks} checks passed in isolated PGlite PostgreSQL.`);
} finally {
  await db.close();
}
