import { describe, expect, it, vi } from "vitest";
import type { CompilationResult } from "../compiler/compiler.js";
import { CompiledStorefrontPublicationService } from "./service.js";

function successfulCompilation(generation = 5): CompilationResult {
  return {
    ok: true,
    diagnostics: [],
    dependencies: { edges: [] },
    snapshot: {
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
    },
  };
}

describe("CompiledStorefrontPublicationService", () => {
  it("does not create a publication when compilation has blocking diagnostics", async () => {
    const compiler = {
      compile: vi.fn(async () => ({
        ok: false,
        diagnostics: [{ severity: "error" as const, code: "MISSING_GLOBAL_SECTION", message: "Missing" }],
        dependencies: { edges: [] },
      })),
    };
    const repository = {
      findByIdempotencyKey: vi.fn(async () => null),
      publish: vi.fn(),
    };
    const service = new CompiledStorefrontPublicationService(compiler, repository);

    const result = await service.publish("store-a", 5, "idem-1", 7);
    expect(result.ok).toBe(false);
    expect(repository.publish).not.toHaveBeenCalled();
  });

  it("publishes a successful compilation with the captured generation", async () => {
    const compiler = { compile: vi.fn(async () => successfulCompilation()) };
    const repository = {
      findByIdempotencyKey: vi.fn(async () => null),
      publish: vi.fn(async () => ({ id: "pub-1", storeId: "store-a", sourceGeneration: 5 })),
    };
    const service = new CompiledStorefrontPublicationService(compiler, repository);

    const result = await service.publish("store-a", 5, "idem-1", 7);
    expect(result.ok).toBe(true);
    expect(repository.publish).toHaveBeenCalledWith(expect.objectContaining({
      storeId: "store-a",
      expectedGeneration: 5,
      idempotencyKey: "idem-1",
      actorUserId: 7,
      snapshot: expect.objectContaining({ schemaVersion: 4 }),
    }));
  });

  it("returns an existing publication for a repeated idempotency key without recompiling", async () => {
    const compiler = { compile: vi.fn(async () => successfulCompilation()) };
    const existing = { id: "pub-1", storeId: "store-a", sourceGeneration: 5 };
    const repository = {
      findByIdempotencyKey: vi.fn(async () => existing),
      publish: vi.fn(),
    };
    const service = new CompiledStorefrontPublicationService(compiler, repository);

    const result = await service.publish("store-a", 5, "idem-1", 7);
    expect(result).toMatchObject({ ok: true, publication: existing, reused: true });
    expect(compiler.compile).not.toHaveBeenCalled();
  });
});
