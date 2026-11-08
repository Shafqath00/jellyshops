export interface PutMediaInput {
  storeId: string;
  mediaId: string;
  extension: string;
  contents: Buffer;
  mimeType?: string;
}

export interface MediaStorage {
  put(input: PutMediaInput): Promise<string>;
  open(storageKey: string): Promise<Buffer | null>;
  remove(storageKey: string): Promise<void>;
}
