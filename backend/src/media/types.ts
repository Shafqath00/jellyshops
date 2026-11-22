export type MediaType = "image" | "file";

export interface MediaRecord {
  id: string;
  storeId: string;
  type: MediaType;
  url: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  originalName: string;
  altText: string | null;
  referenced: boolean;
  createdAt: string;
  contentHash?: string | null;
  /** Widths of the resized WebP copies that exist; null/absent for images uploaded before this was recorded. */
  variantWidths?: number[] | null;
  /** A tiny blurred WebP as a data URL, shown while the photo loads; null when there is none. */
  placeholder?: string | null;
}

export interface StoredMediaRecord extends MediaRecord {
  storageKey: string;
}

export interface StoredMedia {
  record: MediaRecord;
  contents: Buffer;
  mimeType: string;
  etag: string;
}
