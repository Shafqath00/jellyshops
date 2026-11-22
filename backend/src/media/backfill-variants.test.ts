import sharp from "sharp";
import { afterEach, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { backfillMediaVariants } from "./backfill-variants.js";
import type { MediaStorage } from "./storage.js";

let db: IntegrationDatabase | undefined;
afterEach(async () => { await db?.close(); db = undefined; });

it("records which copies exist and adds a placeholder, writing only empty columns and never files", async () => {
  db = await createPGliteDatabase();
  await seedStore(db, "store-a", "a");
  const photo = await sharp({ create: { width: 64, height: 64, channels: 3, background: "red" } }).webp().toBuffer();
  const files = new Map([["a/new.png", photo], ["a/new.png.w320.webp", photo], ["a/new.png.w640.webp", photo], ["a/old.png", photo]]);
  const writes: string[] = [];
  const storage: MediaStorage = {
    open: async (key) => files.get(key) ?? null,
    put: async (input) => { writes.push(input.mediaId); return ""; },
    remove: async (key) => { writes.push(key); },
  };
  const insert = `INSERT INTO "Media" ("id", "storeId", "type", "storageKey", "url", "mimeType", "byteSize", "originalName", "referenced", "contentHash", "placeholder") VALUES ($1, 'store-a', 'image', $2, '/u', 'image/png', 1, 'n', false, $3, $4)`;
  await db.query(insert, ["new", "a/new.png", "hash-new", null]);
  await db.query(insert, ["old", "a/old.png", null, null]);
  await db.query(insert, ["done", "a/done.png", "hash-done", "data:image/webp;base64,AAAA"]);

  const dry = await backfillMediaVariants(db, storage, { dryRun: true });
  expect(dry).toMatchObject({ checked: 2, withCopies: 1, withPlaceholder: 2, written: 0 });
  expect((await db.query(`SELECT count(*)::int AS n FROM "Media" WHERE "placeholder" IS NOT NULL`)).rows[0]).toEqual({ n: 1 });

  const real = await backfillMediaVariants(db, storage, { dryRun: false });
  expect(real).toMatchObject({ written: 2, problems: [] });
  const rows = (await db.query<{ id: string; variantWidths: number[] | null; placeholder: string | null }>(`SELECT "id", "variantWidths", "placeholder" FROM "Media"`)).rows;
  expect(rows.find((row) => row.id === "new")).toMatchObject({ variantWidths: [320, 640], placeholder: expect.stringMatching(/^data:image\/webp;base64,/) });
  expect(rows.find((row) => row.id === "old")).toMatchObject({ variantWidths: null, placeholder: expect.stringMatching(/^data:image\/webp;base64,/) });
  expect(rows.find((row) => row.id === "done")).toMatchObject({ placeholder: "data:image/webp;base64,AAAA" });
  expect(writes).toEqual([]);
  expect(await backfillMediaVariants(db, storage, { dryRun: false })).toMatchObject({ checked: 0, written: 0 });
});
