import { describe, expect, it, vi } from "vitest";
import type { WorkspaceTransaction } from "./concurrency.js";
import { GlobalSectionService } from "./global-section-service.js";
import type { GlobalSectionRepository } from "./repositories/global-section-repository.js";
import type { PresetRepository } from "./repositories/preset-repository.js";

const tx = {} as WorkspaceTransaction;

function setup() {
  let generation = 0;
  const globals: GlobalSectionRepository = {
    getGlobalSection: vi.fn(async () => null),
    listGlobalSections: vi.fn(async () => []),
    createGlobalSection: vi.fn(async (_tx, input) => ({
      id: "global-1", revision: 0, createdAt: new Date(0), updatedAt: new Date(0), ...structuredClone(input),
    })),
    updateGlobalSection: vi.fn(async (_tx, storeId, _id, _revision, patch) => ({
      id: "global-1", storeId, revision: 1, name: patch.name ?? "Promo",
      section: structuredClone(patch.section ?? { type: "banner", settings: {} }),
      createdAt: new Date(0), updatedAt: new Date(1),
    })),
  };
  const presets: PresetRepository = {
    getPreset: vi.fn(async () => ({
      id: "preset-1", storeId: "store-a", revision: 0, name: "Promo preset",
      section: { type: "banner", settings: { heading: "Sale" } },
      createdAt: new Date(0), updatedAt: new Date(0),
    })),
    listPresets: vi.fn(async () => []),
    createPreset: vi.fn(async (_tx, input) => ({
      id: "preset-1", revision: 0, createdAt: new Date(0), updatedAt: new Date(0), ...structuredClone(input),
    })),
  };
  const coordinator = {
    async run<T>(_storeId: string, operation: (transaction: WorkspaceTransaction) => Promise<T>) {
      const result = await operation(tx);
      generation += 1;
      return { result, generation };
    },
  };
  return { globals, presets, service: new GlobalSectionService(globals, presets, coordinator) };
}

describe("GlobalSectionService", () => {
  it("creates a stable global reference rather than copying the section", async () => {
    const { service } = setup();
    const created = await service.createGlobalSection("store-a", {
      name: "Summer promotion",
      section: { type: "banner", settings: { heading: "Summer" } },
    });

    expect(created.generation).toBe(1);
    expect(service.createGlobalPlacement(created.globalSection.id)).toEqual({
      kind: "global",
      globalSectionId: "global-1",
    });
  });

  it("instantiates a preset as a detached copy", async () => {
    const { service } = setup();
    const first = await service.instantiatePreset("store-a", "preset-1");
    (first.settings as { heading: string }).heading = "Changed locally";
    const second = await service.instantiatePreset("store-a", "preset-1");

    expect((second.settings as { heading: string }).heading).toBe("Sale");
  });

  it("saves a section preset through the workspace coordinator", async () => {
    const { service } = setup();
    const saved = await service.createPreset("store-a", {
      name: "Promo preset",
      section: { type: "banner", settings: { heading: "Sale" } },
    });

    expect(saved.preset.revision).toBe(0);
    expect(saved.generation).toBe(1);
  });
});
