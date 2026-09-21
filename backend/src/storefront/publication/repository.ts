import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import type { StorefrontDependencyGraph } from "../compiler/dependency-graph.js";

export interface CompiledPublicationRecord {
  id: string;
  storeId: string;
  sourceGeneration: number;
  schemaVersion: number;
  compilerVersion: string;
  snapshot: RuntimeStorefrontSnapshotV4;
  dependencies: StorefrontDependencyGraph;
  themeArtifactId: string | null;
  idempotencyKey: string;
  publishedAt: Date;
}

export interface SaveCompiledSnapshotInput {
  storeId: string;
  expectedGeneration: number;
  idempotencyKey: string;
  actorUserId: string;
  snapshot: RuntimeStorefrontSnapshotV4;
  dependencies: StorefrontDependencyGraph;
}

export interface CompiledPublicationRepository {
  findByIdempotencyKey(storeId: string, idempotencyKey: string): Promise<CompiledPublicationRecord | null>;
  save(input: SaveCompiledSnapshotInput): Promise<CompiledPublicationRecord>;
  get(storeId: string, publicationId: string): Promise<CompiledPublicationRecord | null>;
  getCurrentPublicationId(storeId: string): Promise<string | null>;
  getCurrent(storeId: string): Promise<CompiledPublicationRecord | null>;
  activate(storeId: string, publicationId: string): Promise<void>;
}
