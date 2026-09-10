export interface MediaRecord {
  id: string;
  storeId: string;
  url: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  originalName: string;
  referenced: boolean;
  createdAt: string;
}

export interface StoredMediaRecord extends MediaRecord {
  storagePath: string;
}

export interface StoredMedia {
  record: StoredMediaRecord;
  contents: Buffer;
}
