import type { SqlExecutor } from "../commerce/repository.js";
import type { MediaStorage } from "./storage.js";
import { derivativeKey, makePlaceholder, MEDIA_WIDTHS } from "./service.js";

export interface BackfillResult { checked: number; withCopies: number; withPlaceholder: number; written: number; problems: string[] }

/**
 * Fills `Media.variantWidths` and `Media.placeholder` for images uploaded before they were recorded.
 * Only ever adds values to empty columns (the UPDATE repeats the "still empty" condition) and never touches a file.
 * Images without a content hash (the oldest uploads) have no copies: they only get a placeholder from the original.
 */
export async function backfillMediaVariants(sql: SqlExecutor, storage: MediaStorage, options: { dryRun: boolean; limit?: number }): Promise<BackfillResult> {
  const rows = (await sql.query<{ id: string; storeId: string; storageKey: string; contentHash: string | null }>(
    `SELECT "id", "storeId", "storageKey", "contentHash" FROM "Media" WHERE "type" = 'image' AND "variantWidths" IS NULL AND "placeholder" IS NULL ORDER BY "createdAt" LIMIT $1`,
    [options.limit ?? 10_000],
  )).rows;
  const result: BackfillResult = { checked: 0, withCopies: 0, withPlaceholder: 0, written: 0, problems: [] };
  for (const row of rows) {
    result.checked += 1;
    try {
      const widths: number[] = [];
      let smallest: Buffer | null = null;
      if (row.contentHash) {
        for (const width of MEDIA_WIDTHS) {
          const copy = await storage.open(derivativeKey(row.storageKey, width));
          if (copy) { widths.push(width); smallest ??= copy; }
        }
      }
      const source = smallest ?? await storage.open(row.storageKey);
      const placeholder = source ? await makePlaceholder(source) : null;
      if (widths.length) result.withCopies += 1;
      if (placeholder) result.withPlaceholder += 1;
      if (options.dryRun || (!widths.length && !placeholder)) continue;
      const updated = await sql.query(
        `UPDATE "Media" SET "variantWidths" = $3, "placeholder" = $4 WHERE "storeId" = $1 AND "id" = $2 AND "variantWidths" IS NULL AND "placeholder" IS NULL RETURNING "id"`,
        [row.storeId, row.id, widths.length ? widths : null, placeholder],
      );
      result.written += updated.rows.length;
    } catch (error) {
      result.problems.push(`${row.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
}
