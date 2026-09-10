import { randomUUID } from "node:crypto";
import { ApiError } from "../http/errors.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { DraftConflictError, type StorefrontRepository } from "./repository.js";
import type { DraftRecord, PublicationRecord } from "./types.js";

const maxRevision = 2_147_483_647;
const maxTransactionAttempts = 3;

function storeNotFound(): ApiError {
  return new ApiError(404, "STORE_NOT_FOUND", "The store was not found");
}

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

function draftRecord<TDocument>(draft: {
  storeId: string;
  revision: number;
  document: unknown;
  updatedAt: Date;
}): DraftRecord<TDocument> {
  return {
    storeId: draft.storeId,
    revision: draft.revision,
    document: draft.document as TDocument,
    updatedAt: draft.updatedAt.toISOString(),
  };
}

function publicationRecord<TDocument>(publication: {
  id: string;
  storeId: string;
  sourceRevision: number;
  document: unknown;
  publishedAt: Date;
}): PublicationRecord<TDocument> {
  return {
    id: publication.id,
    storeId: publication.storeId,
    sourceRevision: publication.sourceRevision,
    document: publication.document as TDocument,
    publishedAt: publication.publishedAt.toISOString(),
  };
}

export class PrismaStorefrontRepository<TDocument = unknown> implements StorefrontRepository<TDocument> {
  constructor(private readonly client: PrismaClient) {}

  async getDraft(storeId: string): Promise<DraftRecord<TDocument> | null> {
    const store = await this.client.store.findFirst({
      where: { id: storeId, archivedAt: null },
      select: { draft: true },
    });
    if (!store) throw storeNotFound();
    return store.draft ? draftRecord<TDocument>(store.draft) : null;
  }

  async saveDraft(
    storeId: string,
    expectedRevision: number,
    document: TDocument,
  ): Promise<DraftRecord<TDocument>> {
    return this.retryTransaction(async () => this.client.$transaction(async (transaction) => {
      await this.lockActiveStore(transaction, storeId);
      const current = await transaction.storefrontDraft.findUnique({ where: { storeId } });
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedRevision) throw new DraftConflictError(currentRevision);
      if (currentRevision >= maxRevision) {
        throw new ApiError(409, "REVISION_LIMIT_REACHED", "The draft revision limit was reached");
      }

      const nextRevision = currentRevision + 1;
      const data = { revision: nextRevision, document: document as Prisma.InputJsonValue };
      const saved = current
        ? await transaction.storefrontDraft.update({ where: { storeId }, data })
        : await transaction.storefrontDraft.create({ data: { storeId, ...data } });
      return draftRecord<TDocument>(saved);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }));
  }

  async publish(storeId: string, expectedRevision: number): Promise<PublicationRecord<TDocument>> {
    return this.retryTransaction(async () => this.client.$transaction(async (transaction) => {
      await this.lockActiveStore(transaction, storeId);
      const draft = await transaction.storefrontDraft.findUnique({ where: { storeId } });
      const currentRevision = draft?.revision ?? 0;
      if (!draft || currentRevision !== expectedRevision) {
        throw new DraftConflictError(currentRevision);
      }

      const publication = await transaction.storefrontPublication.create({
        data: {
          id: randomUUID(),
          storeId,
          sourceRevision: draft.revision,
          document: draft.document as Prisma.InputJsonValue,
        },
      });
      await transaction.store.update({
        where: { id: storeId },
        data: { currentPublicationId: publication.id },
      });
      return publicationRecord<TDocument>(publication);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }));
  }

  async getPublic(storeId: string): Promise<PublicationRecord<TDocument> | null> {
    const store = await this.client.store.findFirst({
      where: { id: storeId, archivedAt: null },
      select: { currentPublication: true },
    });
    return store?.currentPublication
      ? publicationRecord<TDocument>(store.currentPublication)
      : null;
  }

  private async lockActiveStore(transaction: Prisma.TransactionClient, storeId: string): Promise<void> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Store"
      WHERE id = ${storeId} AND "archivedAt" IS NULL
      FOR UPDATE
    `;
    if (rows.length === 0) throw storeNotFound();
  }

  private async retryTransaction<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    for (let attempt = 1; attempt <= maxTransactionAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!isRetryableTransactionError(error)) throw error;
        if (attempt === maxTransactionAttempts) {
          throw new ApiError(503, "DATABASE_BUSY", "The database is busy; retry the request");
        }
      }
    }
    throw new ApiError(503, "DATABASE_BUSY", "The database is busy; retry the request");
  }
}
