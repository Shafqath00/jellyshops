import {
  runtimeStorefrontSnapshotV4Schema,
  type RuntimeStorefrontSnapshotV4,
} from "@jelly/storefront-schema";
import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import type { SqlExecutor } from "../../commerce/repository.js";
import type { PublicationSnapshotLoader } from "../runtime/cache.js";
import type { CurrentPublicationPointer } from "../runtime/service.js";
import type { StorefrontDependencyGraph } from "../compiler/dependency-graph.js";
import type {
  CompiledPublicationRecord,
  CompiledPublicationRepository,
  SaveCompiledSnapshotInput,
} from "./repository.js";

interface PublicationRow extends QueryResultRow {
  id: unknown;
  storeId: unknown;
  sourceGeneration: unknown;
  schemaVersion: unknown;
  compilerVersion: unknown;
  document: unknown;
  dependencyManifest: unknown;
  themeArtifactId: unknown;
  idempotencyKey: unknown;
  publishedAt: string | Date;
}

interface StorePointerRow extends QueryResultRow {
  currentPublicationId: unknown;
}

export interface SqlCompiledPublicationRepositoryDependencies {
  id?: () => string;
  now?: () => Date;
}

export class PublicationActivationError extends Error {
  constructor(
    readonly storeId: string,
    readonly publicationId: string,
  ) {
    super(`Cannot activate publication ${publicationId} for store ${storeId}`);
    this.name = "PublicationActivationError";
  }
}

function mapPublication(row: PublicationRow): CompiledPublicationRecord {
  return {
    id: String(row.id),
    storeId: String(row.storeId),
    sourceGeneration: Number(row.sourceGeneration),
    schemaVersion: Number(row.schemaVersion),
    compilerVersion: String(row.compilerVersion),
    snapshot: runtimeStorefrontSnapshotV4Schema.parse(row.document),
    dependencies: row.dependencyManifest as StorefrontDependencyGraph,
    themeArtifactId: row.themeArtifactId ? String(row.themeArtifactId) : null,
    idempotencyKey: String(row.idempotencyKey),
    publishedAt: new Date(row.publishedAt),
  };
}

const publicationColumns = `
  publication."id",
  publication."storeId",
  publication."sourceGeneration",
  publication."schemaVersion",
  publication."compilerVersion",
  publication."document",
  publication."dependencyManifest",
  publication."themeArtifactId",
  publication."idempotencyKey",
  publication."publishedAt"
`;

export class SqlCompiledPublicationRepository implements
  CompiledPublicationRepository,
  CurrentPublicationPointer,
  PublicationSnapshotLoader {
  private readonly id: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly sql: SqlExecutor,
    dependencies: SqlCompiledPublicationRepositoryDependencies = {},
  ) {
    this.id = dependencies.id ?? randomUUID;
    this.now = dependencies.now ?? (() => new Date());
  }

  async save(input: SaveCompiledSnapshotInput): Promise<CompiledPublicationRecord> {
    const id = this.id();
    const publishedAt = this.now();
    const snapshot = runtimeStorefrontSnapshotV4Schema.parse(input.snapshot);
    const result = await this.sql.query<PublicationRow>(
      `INSERT INTO "StorefrontPublication" AS publication (
        "id",
        "storeId",
        "sourceRevision",
        "sourceGeneration",
        "schemaVersion",
        "compilerVersion",
        "document",
        "dependencyManifest",
        "themeArtifactId",
        "idempotencyKey",
        "publishedAt"
      ) VALUES ($1, $2, $3, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
      RETURNING ${publicationColumns}`,
      [
        id,
        input.storeId,
        snapshot.sourceGeneration,
        snapshot.schemaVersion,
        snapshot.compilerVersion,
        JSON.stringify(snapshot),
        JSON.stringify(input.dependencies),
        snapshot.theme.artifactId,
        input.idempotencyKey,
        publishedAt,
      ],
    );
    return mapPublication(result.rows[0]);
  }

  async findByIdempotencyKey(
    storeId: string,
    idempotencyKey: string,
  ): Promise<CompiledPublicationRecord | null> {
    const result = await this.sql.query<PublicationRow>(
      `SELECT ${publicationColumns}
       FROM "StorefrontPublication" AS publication
       WHERE publication."storeId" = $1
         AND publication."idempotencyKey" = $2`,
      [storeId, idempotencyKey],
    );
    return result.rows[0] ? mapPublication(result.rows[0]) : null;
  }

  async get(storeId: string, publicationId: string): Promise<CompiledPublicationRecord | null> {
    const result = await this.sql.query<PublicationRow>(
      `SELECT ${publicationColumns}
       FROM "StorefrontPublication" AS publication
       WHERE publication."storeId" = $1
         AND publication."id" = $2`,
      [storeId, publicationId],
    );
    return result.rows[0] ? mapPublication(result.rows[0]) : null;
  }

  async getCurrentPublicationId(storeId: string): Promise<string | null> {
    const result = await this.sql.query<StorePointerRow>(
      `SELECT "currentPublicationId"
       FROM "Store"
       WHERE "id" = $1`,
      [storeId],
    );
    const value = result.rows[0]?.currentPublicationId;
    return value == null ? null : String(value);
  }

  async getCurrent(storeId: string): Promise<CompiledPublicationRecord | null> {
    const result = await this.sql.query<PublicationRow>(
      `SELECT ${publicationColumns}
       FROM "Store" AS store
       JOIN "StorefrontPublication" AS publication
         ON publication."id" = store."currentPublicationId"
        AND publication."storeId" = store."id"
       WHERE store."id" = $1`,
      [storeId],
    );
    return result.rows[0] ? mapPublication(result.rows[0]) : null;
  }

  async activate(storeId: string, publicationId: string): Promise<void> {
    const result = await this.sql.query(
      `UPDATE "Store" AS store
       SET "currentPublicationId" = $2, "updatedAt" = CURRENT_TIMESTAMP
       WHERE store."id" = $1
         AND EXISTS (
           SELECT 1 FROM "StorefrontPublication" publication
           WHERE publication."id" = $2 AND publication."storeId" = store."id"
         )
       RETURNING store."id"`,
      [storeId, publicationId],
    );
    if (result.rows.length === 0) {
      throw new PublicationActivationError(storeId, publicationId);
    }
  }

  async loadPublication(publicationId: string): Promise<RuntimeStorefrontSnapshotV4 | null> {
    const result = await this.sql.query<{ document: unknown } & QueryResultRow>(
      `SELECT "document"
       FROM "StorefrontPublication"
       WHERE "id" = $1`,
      [publicationId],
    );
    return result.rows[0]
      ? runtimeStorefrontSnapshotV4Schema.parse(result.rows[0].document)
      : null;
  }
}
