import type { SqlExecutor } from "../commerce/repository.js";
import type { CreateMediaRecordInput, MediaRepository } from "./repository.js";
import type { StoredMediaRecord } from "./types.js";

type MediaRow = Omit<StoredMediaRecord, "createdAt"> & { createdAt: Date | string };
function record(row: MediaRow): StoredMediaRecord {
  return { ...row, createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt };
}
export class SqlMediaRepository implements MediaRepository {
  constructor(private readonly sql: SqlExecutor) {}
  async create(input: CreateMediaRecordInput): Promise<StoredMediaRecord> {
    const result = await this.sql.query<MediaRow>(`INSERT INTO "Media" ("id", "storeId", "type", "storageKey", "url", "mimeType", "byteSize", "width", "height", "originalName", "altText", "referenced") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [input.id, input.storeId, input.type, input.storageKey, input.url, input.mimeType, input.byteSize, input.width, input.height, input.originalName, input.altText, input.referenced]);
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
