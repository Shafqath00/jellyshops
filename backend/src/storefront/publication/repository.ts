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

export interface PublishCompiledSnapshotInput {
  storeId: string;
  expectedGeneration: number;
  idempotencyKey: string;
  actorUserId: number;
  snapshot: RuntimeStorefrontSnapshotV4;
  dependencies: StorefrontDependencyGraph;
}

export interface CompiledPublicationRepository {
  findByIdempotencyKey(storeId: string, idempotencyKey: string): Promise<CompiledPublicationRecord | null>;
  publish(input: PublishCompiledSnapshotInput): Promise<CompiledPublicationRecord>;
}
