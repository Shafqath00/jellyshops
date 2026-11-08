import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MediaRepository, CreateMediaRecordInput } from "./repository.js";
import type { StoredMediaRecord } from "./types.js";

export class LocalJsonMediaRepository implements MediaRepository {
  private static readonly writes = new Map<string, Promise<unknown>>();
  constructor(private readonly dataDirectory: string) {}

  async create(input: CreateMediaRecordInput): Promise<StoredMediaRecord> {
    return this.withLock(input.storeId, async () => {
      const records = await this.readRecords(input.storeId);
      if (input.contentHash && records.some(record => record.contentHash === input.contentHash)) {
        throw Object.assign(new Error("Duplicate image content"), { code: "23505" });
      }
      const created: StoredMediaRecord = { ...input, createdAt: new Date().toISOString() };
      records.push(created);
      await this.writeRecords(input.storeId, records);
      return structuredClone(created);
    });
  }

  async findByHash(storeId: string, contentHash: string): Promise<StoredMediaRecord | null> {
    return (await this.readRecords(storeId)).find(record => record.contentHash === contentHash) ?? null;
  }

  async get(storeId: string, mediaId: string): Promise<StoredMediaRecord | null> {
    const record = (await this.readRecords(storeId)).find(({ id }) => id === mediaId);
    return record ? structuredClone(record) : null;
  }

  async list(storeId: string): Promise<StoredMediaRecord[]> {
    return structuredClone(await this.readRecords(storeId));
  }

  async delete(storeId: string, mediaId: string): Promise<StoredMediaRecord | null> {
    return this.withLock(storeId, async () => {
      const records = await this.readRecords(storeId);
      const index = records.findIndex(({ id }) => id === mediaId);
      if (index < 0) return null;
      const [record] = records.splice(index, 1);
      await this.writeRecords(storeId, records);
      return structuredClone(record);
    });
  }

  private async withLock<T>(storeId: string, operation: () => Promise<T>): Promise<T> {
    const key = path.resolve(this.recordPath(storeId));
    const previous = LocalJsonMediaRepository.writes.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    LocalJsonMediaRepository.writes.set(key, next);
    try { return await next; } finally {
      if (LocalJsonMediaRepository.writes.get(key) === next) LocalJsonMediaRepository.writes.delete(key);
    }
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
