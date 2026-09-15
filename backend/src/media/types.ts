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
}

export interface StoredMediaRecord extends MediaRecord {
  storageKey: string;
}

export interface StoredMedia {
  record: MediaRecord;
  contents: Buffer;
}
