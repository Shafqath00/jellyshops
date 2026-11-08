import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createPGliteDatabase,
  seedStore,
  type IntegrationDatabase,
} from "../../../test/integration/pglite.js";
import type { StorefrontDependencyGraph } from "../compiler/dependency-graph.js";
import type { SaveCompiledSnapshotInput } from "./repository.js";
import {
  PublicationActivationError,
  SqlCompiledPublicationRepository,
} from "./sql-repository.js";

function snapshot(storeId: string, sourceGeneration: number): RuntimeStorefrontSnapshotV4 {
  return {
    schemaVersion: 4,
    storeId,
    sourceGeneration,
    compilerVersion: `compiler-${sourceGeneration}`,
    registryManifestHash: `registry-${sourceGeneration}`,
    theme: {
      presetId: "minimal",
      settings: { generation: sourceGeneration },
      artifactId: `artifact-${sourceGeneration}`,
    },
    templates: {},
    globalSections: {},
    menus: {},
    templateDefaults: {},
    assignments: [],
    dependencies: { edges: [] },
  };
}

function input(
  storeId: string,
  idempotencyKey: string,
  sourceGeneration: number,
): SaveCompiledSnapshotInput {
  const dependencies: StorefrontDependencyGraph = { edges: [] };
  return {
    storeId,
    expectedGeneration: sourceGeneration,
    idempotencyKey,
    actorUserId: "user-a",
    snapshot: snapshot(storeId, sourceGeneration),
    dependencies,
  };
}

function ids(...values: string[]): () => string {
  return () => {
    const value = values.shift();
    if (!value) throw new Error("No publication id configured for test");
    return value;
  };
}

describe("SqlCompiledPublicationRepository", () => {
  let database: IntegrationDatabase;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
  });

  afterEach(async () => database.close());

  it("keeps immutable rows while moving the explicit current pointer from A to B", async () => {
    const repository = new SqlCompiledPublicationRepository(database, {
      id: ids("pub-a", "pub-b"),
      now: () => new Date("2026-09-22T12:00:00.000Z"),
    });

    const first = await repository.save(input("store-a", "key-a", 1));
    expect(await repository.get("store-a", first.id)).toEqual(first);
    expect(await repository.getCurrentPublicationId("store-a")).toBeNull();

    await repository.activate("store-a", first.id);
    expect(await repository.getCurrent("store-a")).toEqual(first);

    const second = await repository.save(input("store-a", "key-b", 2));
    await repository.activate("store-a", second.id);

    expect((await repository.getCurrent("store-a"))?.id).toBe("pub-b");
    expect((await repository.get("store-a", "pub-a"))?.id).toBe("pub-a");
    await expect(repository.loadPublication("pub-a")).resolves.toEqual(first.snapshot);
  });

  it("rejects duplicate publication ids instead of overwriting an immutable row", async () => {
    const repository = new SqlCompiledPublicationRepository(database, {
      id: () => "pub-duplicate",
    });

    await repository.save(input("store-a", "key-a", 1));
    await expect(repository.save(input("store-a", "key-b", 2))).rejects.toThrow();
    expect((await repository.get("store-a", "pub-duplicate"))?.sourceGeneration).toBe(1);
  });

  it("lets the database safely reject a duplicate store idempotency key", async () => {
    const repository = new SqlCompiledPublicationRepository(database, {
      id: ids("pub-a", "pub-b"),
    });

    const first = await repository.save(input("store-a", "same-key", 1));
    await expect(repository.save(input("store-a", "same-key", 2))).rejects.toThrow();
    await expect(repository.findByIdempotencyKey("store-a", "same-key")).resolves.toEqual(first);
  });

  it("does not expose or activate another store's publication", async () => {
    const repository = new SqlCompiledPublicationRepository(database, {
      id: () => "pub-b",
    });
    await repository.save(input("store-b", "key-b", 1));

    await expect(repository.get("store-a", "pub-b")).resolves.toBeNull();
    await expect(repository.activate("store-a", "pub-b")).rejects.toBeInstanceOf(PublicationActivationError);
    await expect(repository.getCurrentPublicationId("store-a")).resolves.toBeNull();
  });

  it("preserves the old pointer when activation targets a missing publication", async () => {
    const repository = new SqlCompiledPublicationRepository(database, {
      id: () => "pub-a",
    });
    const first = await repository.save(input("store-a", "key-a", 1));
    await repository.activate("store-a", first.id);

    await expect(repository.activate("store-a", "missing")).rejects.toBeInstanceOf(PublicationActivationError);
    await expect(repository.getCurrentPublicationId("store-a")).resolves.toBe("pub-a");
  });

  it("stores data independently of later caller mutation", async () => {
    const repository = new SqlCompiledPublicationRepository(database, {
      id: () => "pub-a",
    });
    const saveInput = input("store-a", "key-a", 1);

    await repository.save(saveInput);
    saveInput.snapshot.theme.settings.generation = 999;
    saveInput.dependencies.edges.push({
      from: { type: "theme", id: "active" },
      to: { type: "extension", id: "late-mutation" },
      reason: "extension",
    });

    const reread = await repository.get("store-a", "pub-a");
    expect(reread?.snapshot.theme.settings).toEqual({ generation: 1 });
    expect(reread?.dependencies).toEqual({ edges: [] });
  });

  it("makes saved rows and the current pointer visible to a new repository instance", async () => {
    const firstProcess = new SqlCompiledPublicationRepository(database, {
      id: () => "pub-a",
    });
    await firstProcess.save(input("store-a", "key-a", 1));
    await firstProcess.activate("store-a", "pub-a");

    const restarted = new SqlCompiledPublicationRepository(database);
    await expect(restarted.getCurrentPublicationId("store-a")).resolves.toBe("pub-a");
    await expect(restarted.getCurrent("store-a")).resolves.toMatchObject({
      id: "pub-a",
      snapshot: { sourceGeneration: 1 },
    });
  });
});
