import type { PrismaClient } from "../generated/prisma/client.js";
import type { CreateMediaRecordInput, MediaRepository } from "./repository.js";
import type { StoredMediaRecord } from "./types.js";

function mapRecord(record: {
  id: string;
  storeId: string;
  type: string;
  storageKey: string;
  url: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  originalName: string;
  altText: string | null;
  referenced: boolean;
  createdAt: Date;
}): StoredMediaRecord {
  return {
    id: record.id,
    storeId: record.storeId,
    type: record.type === "file" ? "file" : "image",
    storageKey: record.storageKey,
    url: record.url,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    width: record.width,
    height: record.height,
    originalName: record.originalName,
    altText: record.altText,
    referenced: record.referenced,
    createdAt: record.createdAt.toISOString(),
  };
}

export class PrismaMediaRepository implements MediaRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: CreateMediaRecordInput): Promise<StoredMediaRecord> {
    return mapRecord(await this.client.media.create({ data: input }));
  }

  async get(storeId: string, mediaId: string): Promise<StoredMediaRecord | null> {
    const record = await this.client.media.findFirst({ where: { storeId, id: mediaId } });
    return record ? mapRecord(record) : null;
  }

  async list(storeId: string): Promise<StoredMediaRecord[]> {
    const records = await this.client.media.findMany({
      where: { storeId },
      orderBy: { createdAt: "asc" },
    });
    return records.map(mapRecord);
  }

  async delete(storeId: string, mediaId: string): Promise<StoredMediaRecord | null> {
    const record = await this.client.media.findFirst({ where: { storeId, id: mediaId } });
    if (!record) return null;
    await this.client.media.delete({ where: { id: mediaId } });
    return mapRecord(record);
  }
}
