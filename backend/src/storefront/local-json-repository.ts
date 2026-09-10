import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DraftConflictError, type StorefrontRepository } from "./repository.js";
import type { DraftRecord, PublicationRecord, StorefrontStoreRecord } from "./types.js";

export class LocalJsonStorefrontRepository<TDocument = unknown> implements StorefrontRepository<TDocument> {
  private readonly queues = new Map<string, Promise<void>>();

  constructor(private readonly dataDirectory: string) {}

  async getDraft(storeId: string): Promise<DraftRecord<TDocument> | null> {
    const record = await this.readStore(storeId);
    return record.draft ? structuredClone(record.draft) : null;
  }

  async saveDraft(storeId: string, expectedRevision: number, document: TDocument): Promise<DraftRecord<TDocument>> {
    return this.enqueue(storeId, async () => {
      const record = await this.readStore(storeId);
      const currentRevision = record.draft?.revision ?? 0;
      if (currentRevision !== expectedRevision) {
        throw new DraftConflictError(currentRevision);
      }

      const draft: DraftRecord<TDocument> = {
        storeId,
        revision: currentRevision + 1,
        document: structuredClone(document),
        updatedAt: new Date().toISOString(),
      };
      record.draft = draft;
      await this.writeStore(record);
      return structuredClone(draft);
    });
  }

  async publish(storeId: string, expectedRevision: number): Promise<PublicationRecord<TDocument>> {
    return this.enqueue(storeId, async () => {
      const record = await this.readStore(storeId);
      const currentRevision = record.draft?.revision ?? 0;
      if (!record.draft || currentRevision !== expectedRevision) {
        throw new DraftConflictError(currentRevision);
      }

      const publication: PublicationRecord<TDocument> = {
        id: randomUUID(),
        storeId,
        sourceRevision: currentRevision,
        document: structuredClone(record.draft.document),
        publishedAt: new Date().toISOString(),
      };
      record.publications.push(publication);
      record.currentPublicationId = publication.id;
      await this.writeStore(record);
      return structuredClone(publication);
    });
  }

  async getPublic(storeId: string): Promise<PublicationRecord<TDocument> | null> {
    const record = await this.readStore(storeId);
    const publication = record.publications.find(({ id }) => id === record.currentPublicationId);
    return publication ? structuredClone(publication) : null;
  }

  private storePath(storeId: string): string {
    return path.join(this.dataDirectory, "stores", `${storeId}.json`);
  }

  private async readStore(storeId: string): Promise<StorefrontStoreRecord<TDocument>> {
    try {
      const contents = await readFile(this.storePath(storeId), "utf8");
      return JSON.parse(contents) as StorefrontStoreRecord<TDocument>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return { storeId, publications: [] };
    }
  }

  private async writeStore(record: StorefrontStoreRecord<TDocument>): Promise<void> {
    const directory = path.dirname(this.storePath(record.storeId));
    await mkdir(directory, { recursive: true });
    const temporaryPath = path.join(directory, `${record.storeId}.${process.pid}.${randomUUID()}.tmp`);
    await writeFile(temporaryPath, JSON.stringify(record, null, 2), "utf8");
    await rename(temporaryPath, this.storePath(record.storeId));
  }

  private async enqueue<TResult>(storeId: string, operation: () => Promise<TResult>): Promise<TResult> {
    const previous = this.queues.get(storeId) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const scheduled = previous.then(() => current);
    this.queues.set(storeId, scheduled);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.queues.get(storeId) === scheduled) this.queues.delete(storeId);
    }
  }
}
