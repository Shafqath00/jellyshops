import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoredMedia, StoredMediaRecord } from "./types.js";

export class LocalMediaStorage {
  constructor(
    private readonly uploadDirectory: string,
    private readonly dataDirectory: string,
  ) {}

  async put(record: Omit<StoredMediaRecord, "storagePath">, contents: Buffer, extension: string): Promise<StoredMediaRecord> {
    const directory = path.join(this.uploadDirectory, record.storeId);
    await mkdir(directory, { recursive: true });
    const storagePath = path.join(directory, `${record.id}.${extension}`);
    await writeFile(storagePath, contents);

    const stored = { ...record, storagePath };
    const records = await this.readRecords(record.storeId);
    records.push(stored);
    await this.writeRecords(record.storeId, records);
    return structuredClone(stored);
  }

  async open(storeId: string, mediaId: string): Promise<StoredMedia | null> {
    const record = (await this.readRecords(storeId)).find(({ id }) => id === mediaId);
    if (!record) return null;
    return { record: structuredClone(record), contents: await readFile(record.storagePath) };
  }

  async list(storeId: string): Promise<StoredMediaRecord[]> {
    return structuredClone(await this.readRecords(storeId));
  }

  async remove(storeId: string, mediaId: string): Promise<StoredMediaRecord | null> {
    const records = await this.readRecords(storeId);
    const index = records.findIndex(({ id }) => id === mediaId);
    if (index < 0) return null;
    const [record] = records.splice(index, 1);
    await unlink(record.storagePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    await this.writeRecords(storeId, records);
    return structuredClone(record);
  }

  private recordPath(storeId: string): string {
    return path.join(this.dataDirectory, "media", `${storeId}.json`);
  }

  private async readRecords(storeId: string): Promise<StoredMediaRecord[]> {
    try {
      return JSON.parse(await readFile(this.recordPath(storeId), "utf8")) as StoredMediaRecord[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return [];
    }
  }

  private async writeRecords(storeId: string, records: StoredMediaRecord[]): Promise<void> {
    const target = this.recordPath(storeId);
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(records, null, 2), "utf8");
    await rename(temporary, target);
  }
}
