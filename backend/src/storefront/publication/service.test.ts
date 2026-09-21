import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import { describe, expect, it, vi } from "vitest";
import type { CompilationResult } from "../compiler/compiler.js";
import type { StorefrontDependencyGraph } from "../compiler/dependency-graph.js";
import type {
  CompiledPublicationRecord,
  CompiledPublicationRepository,
  SaveCompiledSnapshotInput,
} from "./repository.js";
import { CompiledStorefrontPublicationService } from "./service.js";

function snapshot(generation = 5): RuntimeStorefrontSnapshotV4 {
  return {
    schemaVersion: 4,
    storeId: "store-a",
    sourceGeneration: generation,
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

function successfulCompilation(generation = 5): CompilationResult {
  return {
    ok: true,
    diagnostics: [],
    dependencies: { edges: [] },
    snapshot: snapshot(generation),
  };
}

function record(id: string, key: string, generation: number): CompiledPublicationRecord {
  return {
    id,
    storeId: "store-a",
    sourceGeneration: generation,
    schemaVersion: 4,
    compilerVersion: "2026-01",
    snapshot: snapshot(generation),
    dependencies: { edges: [] },
    themeArtifactId: null,
    idempotencyKey: key,
    publishedAt: new Date("2026-09-22T12:00:00.000Z"),
  };
}

class MemoryPublicationRepository implements CompiledPublicationRepository {
  readonly publications = new Map<string, CompiledPublicationRecord>();
  currentPublicationId: string | null = null;
  failSave = false;
  failActivation = false;
  readonly events: string[];

  constructor(events: string[] = []) {
    this.events = events;
  }

  async findByIdempotencyKey(storeId: string, key: string) {
    return [...this.publications.values()].find(
      (publication) => publication.storeId === storeId && publication.idempotencyKey === key,
    ) ?? null;
  }

  async save(input: SaveCompiledSnapshotInput) {
    if (this.failSave) throw new Error("save failed");
    const publication = record(`pub-${input.idempotencyKey}`, input.idempotencyKey, input.snapshot.sourceGeneration);
    publication.snapshot = structuredClone(input.snapshot);
    publication.dependencies = structuredClone(input.dependencies) as StorefrontDependencyGraph;
    this.events.push(`save:${publication.id}`);
    this.publications.set(publication.id, publication);
    return publication;
  }

  async get(storeId: string, publicationId: string) {
    const publication = this.publications.get(publicationId);
    return publication?.storeId === storeId ? publication : null;
  }

  async getCurrentPublicationId(_storeId: string) {
    return this.currentPublicationId;
  }

  async getCurrent(storeId: string) {
    return this.currentPublicationId ? this.get(storeId, this.currentPublicationId) : null;
  }

  async activate(storeId: string, publicationId: string) {
    this.events.push(`activate:${publicationId}`);
    if (this.failActivation) throw new Error("activation failed");
    if (!await this.get(storeId, publicationId)) throw new Error("publication missing");
    this.currentPublicationId = publicationId;
  }
}

describe("CompiledStorefrontPublicationService", () => {
  it("does not save or activate when compilation has blocking diagnostics", async () => {
    const compiler = {
      compile: vi.fn(async () => ({
        ok: false,
        diagnostics: [{ severity: "error" as const, code: "MISSING_GLOBAL_SECTION", message: "Missing" }],
        dependencies: { edges: [] },
      })),
    };
    const repository = new MemoryPublicationRepository();
    const save = vi.spyOn(repository, "save");
    const activate = vi.spyOn(repository, "activate");
    const service = new CompiledStorefrontPublicationService(compiler, repository);

    await expect(service.publish("store-a", 5, "b", "user-7")).resolves.toMatchObject({ ok: false });
    expect(save).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });

  it("orchestrates compile, save, then activate in literal order", async () => {
    const events: string[] = [];
    const compiler = {
      compile: vi.fn(async () => {
        events.push("compile");
        return successfulCompilation();
      }),
    };
    const repository = new MemoryPublicationRepository(events);
    const service = new CompiledStorefrontPublicationService(compiler, repository);

    await expect(service.publish("store-a", 5, "b", "user-7")).resolves.toMatchObject({
      ok: true,
      reused: false,
      publication: { id: "pub-b" },
    });
    expect(events).toEqual(["compile", "save:pub-b", "activate:pub-b"]);
    expect(repository.currentPublicationId).toBe("pub-b");
  });

  it("does not activate and leaves A current when saving B fails", async () => {
    const compiler = { compile: vi.fn(async () => successfulCompilation(2)) };
    const repository = new MemoryPublicationRepository();
    repository.publications.set("pub-a", record("pub-a", "a", 1));
    repository.currentPublicationId = "pub-a";
    repository.failSave = true;
    const activate = vi.spyOn(repository, "activate");
    const service = new CompiledStorefrontPublicationService(compiler, repository);

    await expect(service.publish("store-a", 2, "b", "user-7")).rejects.toThrow("save failed");
    expect(activate).not.toHaveBeenCalled();
    expect(repository.currentPublicationId).toBe("pub-a");
    expect(repository.publications.has("pub-b")).toBe(false);
  });

  it("leaves B stored and A current when activation fails, then reactivates B without recompiling", async () => {
    const compiler = { compile: vi.fn(async () => successfulCompilation(2)) };
    const repository = new MemoryPublicationRepository();
    repository.publications.set("pub-a", record("pub-a", "a", 1));
    repository.currentPublicationId = "pub-a";
    repository.failActivation = true;
    const service = new CompiledStorefrontPublicationService(compiler, repository);

    await expect(service.publish("store-a", 2, "b", "user-7")).rejects.toThrow("activation failed");
    expect(repository.publications.has("pub-b")).toBe(true);
    expect(repository.currentPublicationId).toBe("pub-a");

    repository.failActivation = false;
    await expect(service.publish("store-a", 2, "b", "user-7")).resolves.toMatchObject({
      ok: true,
      reused: true,
      publication: { id: "pub-b" },
    });
    expect(compiler.compile).toHaveBeenCalledTimes(1);
    expect(repository.currentPublicationId).toBe("pub-b");
  });

  it("switches from A to B on a second successful publication", async () => {
    const compiler = { compile: vi.fn(async (_storeId: string, generation: number) => successfulCompilation(generation)) };
    const repository = new MemoryPublicationRepository();
    const service = new CompiledStorefrontPublicationService(compiler, repository);

    await service.publish("store-a", 1, "a", "user-7");
    await service.publish("store-a", 2, "b", "user-7");

    expect(repository.currentPublicationId).toBe("pub-b");
    expect(repository.publications.has("pub-a")).toBe(true);
  });

  it("returns an already-current idempotent publication without compiling, saving, or activating", async () => {
    const compiler = { compile: vi.fn(async () => successfulCompilation()) };
    const repository = new MemoryPublicationRepository();
    repository.publications.set("pub-a", record("pub-a", "a", 1));
    repository.currentPublicationId = "pub-a";
    const save = vi.spyOn(repository, "save");
    const activate = vi.spyOn(repository, "activate");
    const service = new CompiledStorefrontPublicationService(compiler, repository);

    await expect(service.publish("store-a", 1, "a", "user-7")).resolves.toMatchObject({
      ok: true,
      reused: true,
      publication: { id: "pub-a" },
    });
    expect(compiler.compile).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });
});
