import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MediaStorage, PutMediaInput } from "./storage.js";

export class LocalMediaStorage implements MediaStorage {
  constructor(private readonly uploadDirectory: string) {}

  async put({ storeId, mediaId, extension, contents }: PutMediaInput): Promise<string> {
    const directory = path.join(this.uploadDirectory, storeId);
    await mkdir(directory, { recursive: true });
    const storageKey = path.join(storeId, `${mediaId}.${extension}`);
    await writeFile(path.join(this.uploadDirectory, storageKey), contents);
    return storageKey;
  }

  async open(storageKey: string): Promise<Buffer | null> {
    try {
      return await readFile(path.join(this.uploadDirectory, storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async remove(storageKey: string): Promise<void> {
    await unlink(path.join(this.uploadDirectory, storageKey)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
