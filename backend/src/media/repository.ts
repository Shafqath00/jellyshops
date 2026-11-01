import type { StoredMediaRecord } from "./types.js";

export type CreateMediaRecordInput = Omit<StoredMediaRecord, "createdAt">;

export interface MediaRepository {
  findByHash?(storeId: string, contentHash: string): Promise<StoredMediaRecord | null>;
  create(input: CreateMediaRecordInput): Promise<StoredMediaRecord>;
  get(storeId: string, mediaId: string): Promise<StoredMediaRecord | null>;
  list(storeId: string): Promise<StoredMediaRecord[]>;
  delete(storeId: string, mediaId: string): Promise<StoredMediaRecord | null>;
}
