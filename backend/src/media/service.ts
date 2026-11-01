import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { ApiError } from "../http/errors.js";
import type { MediaRepository } from "./repository.js";
import type { MediaStorage } from "./storage.js";
import type { MediaRecord, StoredMedia, StoredMediaRecord } from "./types.js";
import { validateImage } from "./validation.js";

export const MEDIA_WIDTHS = [320, 640, 1280] as const;
function publicRecord(record: StoredMediaRecord): MediaRecord {
  const { storageKey: _storageKey, ...media } = record;
  return media;
}
function derivativeKey(key: string, width: number): string { return `${key}.w${width}.webp`; }
function representationKeys(record: StoredMediaRecord): string[] {
  return [record.storageKey, ...(record.contentHash ? MEDIA_WIDTHS.map(width => derivativeKey(record.storageKey, width)) : [])];
}
export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: MediaStorage,
    private readonly storefrontReferenceReader?: (storeId: string, mediaId: string) => Promise<boolean>,
  ) {}
  private async findByHash(storeId: string, hash: string): Promise<StoredMediaRecord | null> {
    return this.repository.findByHash ? this.repository.findByHash(storeId, hash)
      : (await this.repository.list(storeId)).find(record => record.contentHash === hash) ?? null;
  }
  async upload(storeId: string, file: Express.Multer.File): Promise<MediaRecord> {
    const contentHash = createHash("sha256").update(file.buffer).digest("hex");
    const existing = await this.findByHash(storeId, contentHash);
    if (existing) return publicRecord(existing);
    const image = await validateImage(file.buffer);
    const id = randomUUID();
    // Sharp strips metadata by default. Animated decoding retains all supported frames.
    const original = await sharp(file.buffer, { animated: true, limitInputPixels: 40_000_000 }).rotate().toBuffer({ resolveWithObject: true });
    const written: string[] = [];
    const put = async (extension: string, contents: Buffer, mimeType: string): Promise<string> => {
      // Both adapters address objects by this key. Record the attempt first so a
      // write that persists bytes and then rejects is cleaned up as well.
      const index = written.push(`${storeId}/${id}.${extension}`) - 1;
      const key = await this.storage.put({ storeId, mediaId: id, extension, contents, mimeType });
      written[index] = key;
      return key;
    };
    try {
      const storageKey = await put(image.extension, original.data, image.mimeType);
      for (const width of MEDIA_WIDTHS) {
        const contents = await sharp(original.data, { animated: true, limitInputPixels: 40_000_000 })
          .resize({ width, withoutEnlargement: true }).webp().toBuffer();
        await put(`${image.extension}.w${width}.webp`, contents, "image/webp");
      }
      const stored = await this.repository.create({
        id, storeId, type: "image", storageKey, contentHash,
        url: `/api/public/media/${storeId}/${id}`, mimeType: image.mimeType,
        byteSize: original.data.length, width: original.info.width,
        height: original.info.pageHeight ?? original.info.height,
        originalName: path.basename(file.originalname.replaceAll("\\", "/")), altText: null, referenced: false,
      });
      return publicRecord(stored);
    } catch (error) {
      await Promise.all(written.map(key => this.storage.remove(key).catch(() => undefined)));
      // The unique index arbitrates uploads across concurrent service instances.
      if ((error as { code?: string }).code === "23505") {
        const winner = await this.findByHash(storeId, contentHash);
        if (winner) return publicRecord(winner);
      }
      throw error;
    }
  }
  async list(storeId: string, unusedOlderThan30Days = false): Promise<MediaRecord[]> {
    const records = await this.repository.list(storeId);
    if (!unusedOlderThan30Days) return records.map(publicRecord);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const unused = await Promise.all(records.map(async record =>
      !record.referenced && Date.parse(record.createdAt) < cutoff && !await this.storefrontReferenceReader?.(storeId, record.id) ? record : null));
    return unused.filter((record): record is StoredMediaRecord => record !== null).map(publicRecord);
  }
  async open(storeId: string, mediaId: string, width?: number): Promise<StoredMedia> {
    if (width !== undefined && !MEDIA_WIDTHS.some(value => value === width)) throw new ApiError(400, "MEDIA_WIDTH_INVALID", "Choose a supported image width: 320, 640, or 1280");
    const record = await this.repository.get(storeId, mediaId);
    if (!record) throw new ApiError(404, "MEDIA_NOT_FOUND", "The requested image was not found");
    let contents = width && record.contentHash ? await this.storage.open(derivativeKey(record.storageKey, width)) : null;
    const mimeType = contents ? "image/webp" : record.mimeType;
    contents ??= await this.storage.open(record.storageKey);
    if (!contents) throw new ApiError(404, "MEDIA_NOT_FOUND", "The requested image was not found");
    const etag = `"${createHash("sha256").update(mimeType).update(contents).digest("hex")}"`;
    return { record: publicRecord(record), contents, mimeType, etag };
  }
  async remove(storeId: string, mediaId: string): Promise<void> {
    const record = await this.repository.get(storeId, mediaId);
    if (!record) throw new ApiError(404, "MEDIA_NOT_FOUND", "The requested image was not found");
    if (record.referenced || await this.storefrontReferenceReader?.(storeId, mediaId)) throw new ApiError(409, "MEDIA_IN_USE", "The image is used by a storefront document");
    const deleted = await this.repository.delete(storeId, mediaId);
    if (!deleted) throw new ApiError(404, "MEDIA_NOT_FOUND", "The requested image was not found");
    const results = await Promise.allSettled(representationKeys(deleted).map(key => this.storage.remove(key)));
    const failed = results.find(result => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }
}
