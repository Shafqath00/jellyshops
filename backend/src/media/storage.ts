export interface PutMediaInput {
  storeId: string;
  mediaId: string;
  extension: string;
  contents: Buffer;
}

export interface MediaStorage {
  put(input: PutMediaInput): Promise<string>;
  open(storageKey: string): Promise<Buffer | null>;
  remove(storageKey: string): Promise<void>;
}
