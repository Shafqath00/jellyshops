import { randomUUID } from "node:crypto";
import { ApiError } from "../../http/errors.js";
import { ResourceRevisionConflictError } from "./errors.js";
import type { SqlPool } from "./supabase-template-store.js";

/** Shared-section writes use the same revision and generation contract as templates. */
export async function writeSqlGlobalSection(pool: SqlPool, storeId: string, id: string | null, expectedRevision: number | null, patch: { name?: string; section?: Record<string, unknown> }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = id === null
      ? await client.query(
        `INSERT INTO "GlobalSection" ("id", "storeId", "revision", "name", "section", "createdAt", "updatedAt")
         VALUES ($1, $2, 0, $3, $4::jsonb, NOW(), NOW()) RETURNING *`,
        [randomUUID(), storeId, patch.name, JSON.stringify(patch.section)],
      )
      : await client.query(
        `UPDATE "GlobalSection" SET "name" = COALESCE($4, "name"), "section" = COALESCE($5::jsonb, "section"),
         "revision" = "revision" + 1, "updatedAt" = NOW()
         WHERE "storeId" = $1 AND "id" = $2 AND "revision" = $3 RETURNING *`,
        [storeId, id, expectedRevision, patch.name ?? null, patch.section ? JSON.stringify(patch.section) : null],
      );
    if (updated.rows.length !== 1) {
      const current = await client.query('SELECT "revision" FROM "GlobalSection" WHERE "storeId" = $1 AND "id" = $2', [storeId, id]);
      if (!current.rows.length) throw new ApiError(404, "GLOBAL_SECTION_NOT_FOUND", "This shared section could not be found.");
      throw new ResourceRevisionConflictError(Number(current.rows[0].revision));
    }
    const workspace = await client.query(
      `INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt") VALUES ($1, 1, NOW())
       ON CONFLICT ("storeId") DO UPDATE SET "generation" = "StorefrontWorkspace"."generation" + 1, "updatedAt" = NOW()
       RETURNING "generation"`, [storeId],
    );
    await client.query("COMMIT");
    return { globalSection: updated.rows[0], generation: Number(workspace.rows[0].generation) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
