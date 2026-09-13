import type { StoredMediaRecord } from "./types.js";

export interface CreateMediaRecordInput extends Omit<StoredMediaRecord, "createdAt"> {}

export interface MediaRepository {
  create(input: CreateMediaRecordInput): Promise<StoredMediaRecord>;
  get(storeId: string, mediaId: string): Promise<StoredMediaRecord | null>;
  list(storeId: string): Promise<StoredMediaRecord[]>;
  delete(storeId: string, mediaId: string): Promise<StoredMediaRecord | null>;
}
