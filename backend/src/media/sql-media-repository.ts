import type { SqlExecutor } from "../commerce/repository.js";
import type { CreateMediaRecordInput, MediaRepository } from "./repository.js";
import type { StoredMediaRecord } from "./types.js";

type MediaRow = Omit<StoredMediaRecord, "createdAt"> & { createdAt: Date | string };
function record(row: MediaRow): StoredMediaRecord {
  return { ...row, createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt };
}
export class SqlMediaRepository implements MediaRepository {
  /** Whether the database has the Phase 2 columns; checked once, so the backend works before the migration too. */
  private variantColumns: Promise<boolean> | null = null;
  constructor(private readonly sql: SqlExecutor) {}
  private hasVariantColumns(): Promise<boolean> {
    this.variantColumns ??= this.sql.query<{ count: number }>(`SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Media' AND column_name IN ('variantWidths', 'placeholder')`)
      .then(result => Number(result.rows[0]?.count) === 2).catch(() => false);
    return this.variantColumns;
  }
  async findByHash(storeId: string, contentHash: string): Promise<StoredMediaRecord | null> {
    const result = await this.sql.query<MediaRow>(`SELECT * FROM "Media" WHERE "storeId" = $1 AND "contentHash" = $2`, [storeId, contentHash]);
    return result.rows[0] ? record(result.rows[0]) : null;
  }
  async create(input: CreateMediaRecordInput): Promise<StoredMediaRecord> {
    if (await this.hasVariantColumns()) {
      const result = await this.sql.query<MediaRow>(`INSERT INTO "Media" ("id", "storeId", "type", "storageKey", "url", "mimeType", "byteSize", "width", "height", "originalName", "altText", "referenced", "contentHash", "variantWidths", "placeholder") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`, [input.id, input.storeId, input.type, input.storageKey, input.url, input.mimeType, input.byteSize, input.width, input.height, input.originalName, input.altText, input.referenced, input.contentHash ?? null, input.variantWidths ?? null, input.placeholder ?? null]);
      return record(result.rows[0]);
    }
    const result = await this.sql.query<MediaRow>(`INSERT INTO "Media" ("id", "storeId", "type", "storageKey", "url", "mimeType", "byteSize", "width", "height", "originalName", "altText", "referenced", "contentHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [input.id, input.storeId, input.type, input.storageKey, input.url, input.mimeType, input.byteSize, input.width, input.height, input.originalName, input.altText, input.referenced, input.contentHash ?? null]);
    return record(result.rows[0]);
  }
  async get(storeId: string, id: string): Promise<StoredMediaRecord | null> {
    const result = await this.sql.query<MediaRow>(`SELECT * FROM "Media" WHERE "storeId" = $1 AND "id" = $2`, [storeId, id]);
    return result.rows[0] ? record(result.rows[0]) : null;
  }
  async list(storeId: string): Promise<StoredMediaRecord[]> {
    const result = await this.sql.query<MediaRow>(`SELECT * FROM "Media" WHERE "storeId" = $1 ORDER BY "createdAt" DESC, "id"`, [storeId]);
    return result.rows.map(record);
  }
  async delete(storeId: string, id: string): Promise<StoredMediaRecord | null> {
    const result = await this.sql.query<MediaRow>(`DELETE FROM "Media" WHERE "storeId" = $1 AND "id" = $2 RETURNING *`, [storeId, id]);
    return result.rows[0] ? record(result.rows[0]) : null;
  }
}
