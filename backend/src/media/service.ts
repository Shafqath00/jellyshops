import { randomUUID } from "node:crypto";
import path from "node:path";
import { ApiError } from "../http/errors.js";
import type { MediaRepository } from "./repository.js";
import type { MediaStorage } from "./storage.js";
import type { MediaRecord, StoredMedia, StoredMediaRecord } from "./types.js";
import { validateImage } from "./validation.js";

function publicRecord(record: StoredMediaRecord): MediaRecord {
  const { storageKey: _storageKey, ...media } = record;
  return media;
}

export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: MediaStorage,
  ) {}

  async upload(storeId: string, file: Express.Multer.File): Promise<MediaRecord> {
    const id = randomUUID();
    const image = await validateImage(file.buffer);
    const storageKey = await this.storage.put({
      storeId,
      mediaId: id,
      extension: image.extension,
      contents: file.buffer,
    });

    try {
      const stored = await this.repository.create({
        id,
        storeId,
        type: "image",
        storageKey,
        url: `/api/public/media/${storeId}/${id}`,
        mimeType: image.mimeType,
        byteSize: file.size,
        width: image.width,
        height: image.height,
        originalName: path.basename(file.originalname),
        altText: null,
        referenced: false,
      });
      return publicRecord(stored);
    } catch (error) {
      await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async list(storeId: string): Promise<MediaRecord[]> {
    return (await this.repository.list(storeId)).map(publicRecord);
  }

  async open(storeId: string, mediaId: string): Promise<StoredMedia> {
    const record = await this.repository.get(storeId, mediaId);
    if (!record) throw new ApiError(404, "MEDIA_NOT_FOUND", "The requested image was not found");
    const contents = await this.storage.open(record.storageKey);
    if (!contents) throw new ApiError(404, "MEDIA_NOT_FOUND", "The requested image was not found");
    return { record: publicRecord(record), contents };
  }

  async remove(storeId: string, mediaId: string): Promise<void> {
    const record = await this.repository.get(storeId, mediaId);
    if (!record) throw new ApiError(404, "MEDIA_NOT_FOUND", "The requested image was not found");
    if (record.referenced) {
      throw new ApiError(409, "MEDIA_IN_USE", "The image is used by a storefront document");
    }

    const deleted = await this.repository.delete(storeId, mediaId);
    if (!deleted) throw new ApiError(404, "MEDIA_NOT_FOUND", "The requested image was not found");
    await this.storage.remove(deleted.storageKey);
  }
}
