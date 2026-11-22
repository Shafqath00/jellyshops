import { AwsClient } from "aws4fetch";
import type { MediaStorage, PutMediaInput } from "./storage.js";

/**
 * Uploaded files in Cloudflare R2 (S3-compatible), used when `MEDIA_PROVIDER=r2`.
 *
 * Keys are the same as in the other stores (`<storeId>/<mediaId>.<ext>`, copies `<key>.w640.webp`), so files can be
 * copied across unchanged. Every file is written as immutable with a fixed type: a new photo always gets a new id, so
 * the CDN in front of the bucket may keep files for a year and nothing ever needs purging.
 *
 * While files are being moved over, `fallback` (the old store) answers reads for anything not copied yet, and removes
 * are applied to both.
 */
export interface R2Options {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Read from here when a file is not in R2 yet (during the move from Supabase Storage). */
  fallback?: MediaStorage;
  fetch?: typeof fetch;
  /** Overrides the R2 address (tests). */
  endpoint?: string;
}

/** Types the bucket will ever hold. Anything else is refused, so the photo domain can never serve a page or script. */
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "application/octet-stream"]);
const TYPE_BY_EXTENSION: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif" };
export const IMMUTABLE = "public, max-age=31536000, immutable";

export function mediaTypeForKey(key: string, given?: string): string {
  if (given && ALLOWED_TYPES.has(given)) return given;
  const extension = key.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
}

export class R2MediaStorage implements MediaStorage {
  private readonly client: AwsClient;
  private readonly base: string;
  private readonly fallback?: MediaStorage;
  private readonly fetcher: typeof fetch;

  constructor(options: R2Options) {
    this.client = new AwsClient({ accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey, service: "s3", region: "auto" });
    this.base = `${(options.endpoint ?? `https://${options.accountId}.r2.cloudflarestorage.com`).replace(/\/$/, "")}/${encodeURIComponent(options.bucket)}`;
    this.fallback = options.fallback;
    this.fetcher = options.fetch ?? fetch;
  }

  /** Signs the request (AWS signature v4, as R2 expects) and sends it. */
  private async send(url: string, init: RequestInit): Promise<Response> {
    return this.fetcher(await this.client.sign(url, init));
  }

  private url(key: string): string {
    if (!key || key.startsWith("/") || key.split("/").some((part) => part === "" || part === "." || part === "..")) throw new Error("Invalid media key");
    return `${this.base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async put({ storeId, mediaId, extension, contents, mimeType }: PutMediaInput): Promise<string> {
    const key = `${storeId}/${mediaId}.${extension}`;
    await this.write(key, contents, mimeType);
    return key;
  }

  /** Writes a file under an exact key (also used by the copy script). */
  async write(key: string, contents: Buffer, mimeType?: string): Promise<void> {
    const response = await this.send(this.url(key), {
      method: "PUT",
      body: new Uint8Array(contents),
      headers: { "Content-Type": mediaTypeForKey(key, mimeType), "Cache-Control": IMMUTABLE, "Content-Length": String(contents.length) },
    });
    if (!response.ok) throw new Error(`R2 upload failed (${response.status})`);
  }

  /** The stored size of a file, or null when it isn't in R2 (copy script checks). */
  async size(key: string): Promise<number | null> {
    const response = await this.send(this.url(key), { method: "HEAD" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`R2 check failed (${response.status})`);
    return Number(response.headers.get("content-length") ?? NaN);
  }

  async open(key: string): Promise<Buffer | null> {
    // One retry for a dropped request, as for Supabase Storage.
    for (let attempt = 1; ; attempt += 1) {
      const response = await this.send(this.url(key), { method: "GET" });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      if (response.status === 404) return this.fallback ? this.fallback.open(key) : null;
      if (attempt >= 2) throw new Error(`R2 download failed (${response.status})`);
    }
  }

  async remove(key: string): Promise<void> {
    const response = await this.send(this.url(key), { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new Error(`R2 delete failed (${response.status})`);
    if (this.fallback) await this.fallback.remove(key).catch(() => undefined);
  }
}
