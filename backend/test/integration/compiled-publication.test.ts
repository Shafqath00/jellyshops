import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import { WorkspaceGenerationConflictError } from "../../src/storefront/workspace/errors.js";
import { PrismaCompiledPublicationRepository } from "../../src/storefront/publication/prisma-repository.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

function snapshot(): RuntimeStorefrontSnapshotV4 {
  return {
    schemaVersion: 4,
    storeId: "store-a",
    sourceGeneration: 5,
    compilerVersion: "2026-01",
    registryManifestHash: "registry",
    theme: { presetId: "minimal", settings: {}, artifactId: null },
    templates: {},
    globalSections: {},
    menus: {},
    templateDefaults: {},
    assignments: [],
    dependencies: { edges: [] },
  };
}

describe("PrismaCompiledPublicationRepository", () => {
  let integration: IntegrationDatabase;
  let repository: PrismaCompiledPublicationRepository;
  let actorUserId: number;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
    const user = await integration.database.client.user.create({
      data: { name: "Owner", email: "owner@example.test" },
    });
    actorUserId = user.id;
    await integration.database.client.store.create({
      data: { id: "store-a", name: "Store A", slug: "store-a", currency: "USD", country: "US" },
    });
    await integration.database.client.storefrontWorkspace.create({
      data: { storeId: "store-a", generation: 5 },
    });
    repository = new PrismaCompiledPublicationRepository(integration.database.client);
  });

  afterEach(async () => integration.close());

  it("inserts the immutable V4 publication, audit event, and live pointer atomically", async () => {
    const publication = await repository.publish({
      storeId: "store-a",
      expectedGeneration: 5,
      idempotencyKey: "publish-1",
      actorUserId,
      snapshot: snapshot(),
      dependencies: { edges: [] },
    });

    expect(publication).toMatchObject({ sourceGeneration: 5, schemaVersion: 4, idempotencyKey: "publish-1" });
    await expect(integration.database.client.store.findUniqueOrThrow({ where: { id: "store-a" } }))
      .resolves.toMatchObject({ currentPublicationId: publication.id });
    await expect(integration.database.client.auditEvent.findFirstOrThrow({
      where: { storeId: "store-a", action: "STOREFRONT_PUBLISHED" },
    })).resolves.toMatchObject({ actorUserId, subjectId: publication.id });
  });

  it("rejects a stale generation before changing the live pointer", async () => {
    await expect(repository.publish({
      storeId: "store-a",
      expectedGeneration: 4,
      idempotencyKey: "publish-stale",
      actorUserId,
      snapshot: snapshot(),
      dependencies: { edges: [] },
    })).rejects.toBeInstanceOf(WorkspaceGenerationConflictError);

    expect(await integration.database.client.storefrontPublication.count({ where: { storeId: "store-a" } })).toBe(0);
    await expect(integration.database.client.store.findUniqueOrThrow({ where: { id: "store-a" } }))
      .resolves.toMatchObject({ currentPublicationId: null });
  });

  it("reuses an existing idempotent publication", async () => {
    const first = await repository.publish({
      storeId: "store-a",
      expectedGeneration: 5,
      idempotencyKey: "publish-1",
      actorUserId,
      snapshot: snapshot(),
      dependencies: { edges: [] },
    });
    const found = await repository.findByIdempotencyKey("store-a", "publish-1");

    expect(found?.id).toBe(first.id);
  });
});
