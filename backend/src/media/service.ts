import { randomUUID } from "node:crypto";
import path from "node:path";
import { ApiError } from "../http/errors.js";
import type { MediaRecord, StoredMedia } from "./types.js";
import { LocalMediaStorage } from "./local-media-storage.js";
import { validateImage } from "./validation.js";

export class MediaService {
  constructor(private readonly storage: LocalMediaStorage) {}

  async upload(storeId: string, file: Express.Multer.File): Promise<MediaRecord> {
    const id = randomUUID();
    const image = await validateImage(file.buffer);
    const stored = await this.storage.put({
      id,
      storeId,
      url: `/api/public/media/${storeId}/${id}`,
      mimeType: image.mimeType,
      byteSize: file.size,
      width: image.width,
      height: image.height,
      originalName: path.basename(file.originalname),
      referenced: false,
      createdAt: new Date().toISOString(),
    }, file.buffer, image.extension);
    const { storagePath: _storagePath, ...record } = stored;
    return record;
  }

  async list(storeId: string): Promise<MediaRecord[]> {
    return (await this.storage.list(storeId)).map(({ storagePath: _storagePath, ...record }) => record);
  }

  async open(storeId: string, mediaId: string): Promise<StoredMedia> {
    const media = await this.storage.open(storeId, mediaId);
    if (!media) throw new ApiError(404, "MEDIA_NOT_FOUND", "The requested image was not found");
    return media;
  }

  async remove(storeId: string, mediaId: string): Promise<void> {
    const media = await this.storage.open(storeId, mediaId);
    if (!media) throw new ApiError(404, "MEDIA_NOT_FOUND", "The requested image was not found");
    if (media.record.referenced) throw new ApiError(409, "MEDIA_IN_USE", "The image is used by a storefront document");
    await this.storage.remove(storeId, mediaId);
  }
}
