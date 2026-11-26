import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { ApiError } from "../http/errors.js";
import type { MediaRepository } from "./repository.js";
import type { MediaStorage } from "./storage.js";
import type { MediaRecord, StoredMedia, StoredMediaRecord } from "./types.js";
import { validateImage } from "./validation.js";
import { chooseCopyWidth, knownCopyWidths, mediaPublicUrl } from "./public-url.js";
import type { PlanLimitChecker } from "../billing/plan-limits.js";

export const MEDIA_WIDTHS = [320, 640, 960, 1280, 1920] as const;
/** Longest side kept for an uploaded photo. Larger photos are scaled down on upload: no shopper screen needs more. */
export const MEDIA_MAX_SIDE = 2560;
const WIDTH_LIST = MEDIA_WIDTHS.join(", ");
/** Longest a placeholder may be: it travels in every product payload (the database refuses more). */
export const MEDIA_PLACEHOLDER_MAX = 1200;

/** A 16px blurred WebP of the photo as a data URL, or null if it would be too long (or the photo can't be read). */
export async function makePlaceholder(photo: Buffer): Promise<string | null> {
  try {
    const tiny = await sharp(photo, { limitInputPixels: 40_000_000 }).resize({ width: 16, height: 16, fit: "inside" }).webp({ quality: 40 }).toBuffer();
    const url = `data:image/webp;base64,${tiny.toString("base64")}`;
    return url.length <= MEDIA_PLACEHOLDER_MAX ? url : null;
  } catch { return null; }
}
function publicRecord(this: void, record: StoredMediaRecord, publicBase?: string): MediaRecord {
  const { storageKey, ...media } = record;
  const publicUrl = mediaPublicUrl(publicBase, storageKey);
  return publicUrl ? { ...media, publicUrl } : media;
}
export function derivativeKey(key: string, width: number): string { return `${key}.w${width}.webp`; }
function representationKeys(record: StoredMediaRecord): string[] {
  return [record.storageKey, ...(record.contentHash ? MEDIA_WIDTHS.map(width => derivativeKey(record.storageKey, width)) : [])];
}
export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: MediaStorage,
    private readonly storefrontReferenceReader?: (storeId: string, mediaId: string) => Promise<boolean>,
    /** Public photo domain (MEDIA_PUBLIC_BASE); when set, records carry their direct address. */
    readonly publicBase?: string,
    /** Plan limits (file size, file count, photo storage). Every upload, bulk photos included, passes here. */
    private readonly limits?: Pick<PlanLimitChecker, "check"> & Partial<Pick<PlanLimitChecker, "checkFileSize">>,
  ) {}
  private shown(record: StoredMediaRecord): MediaRecord { return publicRecord(record, this.publicBase); }
  /**
   * Where a photo lives on the public photo domain (the copy that fits `width`, or the original), or null when no
   * public domain is configured or the photo is unknown. No file is read: the old API address just points there.
   */
  async publicLocation(storeId: string, mediaId: string, width?: number): Promise<string | null> {
    if (!this.publicBase) return null;
    if (width !== undefined && !MEDIA_WIDTHS.some(value => value === width)) throw new ApiError(400, "MEDIA_WIDTH_INVALID", `Choose a supported image width: ${WIDTH_LIST}`);
    const record = await this.repository.get(storeId, mediaId);
    if (!record) throw new ApiError(404, "MEDIA_NOT_FOUND", "The requested image was not found");
    const copy = chooseCopyWidth(knownCopyWidths(record), width);
    return mediaPublicUrl(this.publicBase, copy ? derivativeKey(record.storageKey, copy) : record.storageKey) ?? null;
  }
  /** One of this store's photos, or null (used to check a photo chosen in store preferences). */
  async find(storeId: string, mediaId: string): Promise<MediaRecord | null> {
    const record = await this.repository.get(storeId, mediaId);
    return record ? this.shown(record) : null;
  }
  private async findByHash(storeId: string, hash: string): Promise<StoredMediaRecord | null> {
    return this.repository.findByHash ? this.repository.findByHash(storeId, hash)
      : (await this.repository.list(storeId)).find(record => record.contentHash === hash) ?? null;
  }
  async upload(storeId: string, file: Express.Multer.File): Promise<MediaRecord> {
    const contentHash = createHash("sha256").update(file.buffer).digest("hex");
    const existing = await this.findByHash(storeId, contentHash);
    if (existing) return this.shown(existing);
    // Plan checks before the image is decoded: a file that can't be kept is never processed.
    await this.limits?.checkFileSize?.(storeId, file.buffer.length);
    await this.limits?.check(storeId, "files");
    const image = await validateImage(file.buffer);
    const id = randomUUID();
    // Sharp strips metadata by default. Animated decoding retains all supported frames.
    // Rotated upright, metadata stripped (Sharp's default) and scaled down to MEDIA_MAX_SIDE, keeping the format.
    const original = await sharp(file.buffer, { animated: true, limitInputPixels: 40_000_000 }).rotate()
      .resize({ width: MEDIA_MAX_SIDE, height: MEDIA_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true });
    await this.limits?.check(storeId, "photoBytes", original.data.length);
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
      // Copies narrower than the photo, plus one at the photo's own width (the first size not narrower): larger copies
      // would only repeat it.
      const firstWide = MEDIA_WIDTHS.find(value => value >= original.info.width);
      const variantWidths = MEDIA_WIDTHS.filter(value => value < original.info.width || value === firstWide);
      let smallest: Buffer | null = null;
      for (const width of variantWidths) {
        const contents = await sharp(original.data, { animated: true, limitInputPixels: 40_000_000 })
          .resize({ width, withoutEnlargement: true }).webp().toBuffer();
        smallest ??= contents;
        await put(`${image.extension}.w${width}.webp`, contents, "image/webp");
      }
      const placeholder = smallest ? await makePlaceholder(smallest) : null;
      const stored = await this.repository.create({
        id, storeId, type: "image", storageKey, contentHash,
        url: `/api/public/media/${storeId}/${id}`, mimeType: image.mimeType,
        byteSize: original.data.length, width: original.info.width,
        height: original.info.pageHeight ?? original.info.height,
        originalName: path.basename(file.originalname.replaceAll("\\", "/")), altText: null, referenced: false,
        variantWidths: [...variantWidths], placeholder,
      });
      return this.shown(stored);
    } catch (error) {
      await Promise.all(written.map(key => this.storage.remove(key).catch(() => undefined)));
      // The unique index arbitrates uploads across concurrent service instances.
      if ((error as { code?: string }).code === "23505") {
        const winner = await this.findByHash(storeId, contentHash);
        if (winner) return this.shown(winner);
      }
      throw error;
    }
  }
  async list(storeId: string, unusedOlderThan30Days = false): Promise<MediaRecord[]> {
    const records = await this.repository.list(storeId);
    if (!unusedOlderThan30Days) return records.map(record => this.shown(record));
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const unused = await Promise.all(records.map(async record =>
      !record.referenced && Date.parse(record.createdAt) < cutoff && !await this.storefrontReferenceReader?.(storeId, record.id) ? record : null));
    return unused.filter((record): record is StoredMediaRecord => record !== null).map(record => this.shown(record));
  }
  async open(storeId: string, mediaId: string, width?: number): Promise<StoredMedia> {
    if (width !== undefined && !MEDIA_WIDTHS.some(value => value === width)) throw new ApiError(400, "MEDIA_WIDTH_INVALID", `Choose a supported image width: ${WIDTH_LIST}`);
    const record = await this.repository.get(storeId, mediaId);
    if (!record) throw new ApiError(404, "MEDIA_NOT_FOUND", "The requested image was not found");
    // A copy that was never made (small photo, or uploaded before that width existed) is served by the next larger copy,
    // else the largest smaller one (a small photo's full-size copy), then the original.
    let contents: Buffer | null = null; let served: number | undefined;
    if (width && record.contentHash) {
      // When the record lists its copies, only those are tried, so a missing size costs no storage read.
      const known: readonly number[] = record.variantWidths?.length ? record.variantWidths : MEDIA_WIDTHS;
      const order = [...known.filter(value => value >= width), ...known.filter(value => value < width).reverse()];
      for (const candidate of order) {
        contents = await this.storage.open(derivativeKey(record.storageKey, candidate));
        if (contents) { served = candidate; break; }
      }
    }
    const mimeType = contents ? "image/webp" : record.mimeType;
    contents ??= await this.storage.open(record.storageKey);
    if (!contents) throw new ApiError(404, "MEDIA_NOT_FOUND", "The requested image was not found");
    // Stored files never change, so the content hash already identifies the bytes; hashing every response again is waste.
    const etag = record.contentHash ? `"${record.contentHash.slice(0, 32)}-${served ?? "o"}"` : `"${createHash("sha256").update(mimeType).update(contents).digest("hex")}"`;
    return { record: this.shown(record), contents, mimeType, etag };
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
