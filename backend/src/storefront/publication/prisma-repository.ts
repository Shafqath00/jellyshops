import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { runtimeStorefrontSnapshotV4Schema } from "@jelly/storefront-schema";
import { ApiError } from "../../http/errors.js";
import { assertWorkspaceGeneration } from "../workspace/concurrency.js";
import type {
  CompiledPublicationRecord,
  CompiledPublicationRepository,
  PublishCompiledSnapshotInput,
} from "./repository.js";

function mapPublication(row: {
  id: string;
  storeId: string;
  sourceGeneration: number | null;
  schemaVersion: number;
  compilerVersion: string | null;
  document: unknown;
  dependencyManifest: unknown;
  themeArtifactId: string | null;
  idempotencyKey: string | null;
  publishedAt: Date;
}): CompiledPublicationRecord {
  if (row.schemaVersion !== 4 || row.sourceGeneration === null || !row.compilerVersion || !row.idempotencyKey) {
    throw new Error("Publication is not a compiled V4 storefront publication");
  }
  const snapshot = runtimeStorefrontSnapshotV4Schema.parse(row.document);
  return {
    id: row.id,
    storeId: row.storeId,
    sourceGeneration: row.sourceGeneration,
    schemaVersion: row.schemaVersion,
    compilerVersion: row.compilerVersion,
    snapshot,
    dependencies: snapshot.dependencies,
    themeArtifactId: row.themeArtifactId,
    idempotencyKey: row.idempotencyKey,
    publishedAt: row.publishedAt,
  };
}

export class PrismaCompiledPublicationRepository implements CompiledPublicationRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByIdempotencyKey(storeId: string, idempotencyKey: string): Promise<CompiledPublicationRecord | null> {
    const row = await this.client.storefrontPublication.findFirst({
      where: { storeId, idempotencyKey, schemaVersion: 4 },
    });
    return row ? mapPublication(row) : null;
  }

  async publish(input: PublishCompiledSnapshotInput): Promise<CompiledPublicationRecord> {
    if (input.snapshot.storeId !== input.storeId) {
      throw new Error("Compiled snapshot store does not match publication store");
    }
    if (input.snapshot.sourceGeneration !== input.expectedGeneration) {
      throw new Error("Compiled snapshot generation does not match expected generation");
    }

    return this.client.$transaction(async (tx) => {
      await this.lockActiveStore(tx, input.storeId);

      const existing = await tx.storefrontPublication.findFirst({
        where: { storeId: input.storeId, idempotencyKey: input.idempotencyKey, schemaVersion: 4 },
      });
      if (existing) return mapPublication(existing);

      await assertWorkspaceGeneration(input.storeId, input.expectedGeneration, tx);

      const publication = await tx.storefrontPublication.create({
        data: {
          storeId: input.storeId,
          sourceRevision: 0,
          sourceGeneration: input.expectedGeneration,
          schemaVersion: 4,
          compilerVersion: input.snapshot.compilerVersion,
          document: input.snapshot as unknown as Prisma.InputJsonValue,
          dependencyManifest: input.dependencies as unknown as Prisma.InputJsonValue,
          themeArtifactId: input.snapshot.theme.artifactId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      await tx.store.update({
        where: { id: input.storeId },
        data: { currentPublicationId: publication.id },
      });

      await tx.auditEvent.create({
        data: {
          storeId: input.storeId,
          actorUserId: input.actorUserId,
          action: "STOREFRONT_PUBLISHED",
          subjectType: "StorefrontPublication",
          subjectId: publication.id,
          metadata: {
            generation: input.expectedGeneration,
            schemaVersion: 4,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });

      return mapPublication(publication);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  private async lockActiveStore(transaction: Prisma.TransactionClient, storeId: string): Promise<void> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Store"
      WHERE id = ${storeId} AND "archivedAt" IS NULL
      FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new ApiError(404, "STORE_NOT_FOUND", "The store was not found");
    }
  }
}
