import { ResourceRevisionConflictError } from "./errors.js";

interface SqlResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number | null;
}

interface SqlClient {
  query(text: string, values?: unknown[]): Promise<SqlResult>;
  release(): void;
}

export interface SqlPool {
  connect(): Promise<SqlClient>;
}

export async function updateSupabaseTemplate(
  pool: SqlPool,
  storeId: string,
  templateId: string,
  expectedRevision: number,
  patch: { name?: string; handle?: string; layout?: Record<string, unknown> },
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE "StorefrontTemplate"
       SET "name" = COALESCE($4, "name"),
           "handle" = COALESCE($5, "handle"),
           "layout" = COALESCE($6::jsonb, "layout"),
           "revision" = "revision" + 1,
           "updatedAt" = NOW()
       WHERE "storeId" = $1 AND "id" = $2 AND "revision" = $3
       RETURNING "id", "storeId", "revision", lower("type"::text) AS "type", "handle", "name", "layout", "createdAt", "updatedAt"`,
      [
        storeId,
        templateId,
        expectedRevision,
        patch.name ?? null,
        patch.handle ?? null,
        patch.layout ? JSON.stringify(patch.layout) : null,
      ],
    );
    if (updated.rowCount !== 1) {
      const current = await client.query(
        'SELECT "revision" FROM "StorefrontTemplate" WHERE "storeId" = $1 AND "id" = $2',
        [storeId, templateId],
      );
      throw new ResourceRevisionConflictError(Number(current.rows[0]?.revision ?? expectedRevision));
    }
    const workspace = await client.query(
      `INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt")
       VALUES ($1, 1, NOW())
       ON CONFLICT ("storeId") DO UPDATE
       SET "generation" = "StorefrontWorkspace"."generation" + 1, "updatedAt" = NOW()
       RETURNING "generation"`,
      [storeId],
    );
    await client.query("COMMIT");
    return { template: updated.rows[0], generation: Number(workspace.rows[0]?.generation ?? 0) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
