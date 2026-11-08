import { describe, expect, it, vi } from "vitest";
import type { WorkspaceTransaction } from "./concurrency.js";
import { ThemeService } from "./theme-service.js";
import type { ThemeRepository } from "./repositories/theme-repository.js";

const tx = {} as WorkspaceTransaction;

function setup() {
  let generation = 0;
  const repository: ThemeRepository = {
    getThemeConfiguration: vi.fn(async () => null),
    getInstalledThemeArtifact: vi.fn(async () => null),
    saveThemeConfiguration: vi.fn(async (_tx, input) => ({
      storeId: input.storeId,
      revision: input.expectedRevision === null ? 0 : input.expectedRevision + 1,
      themeId: input.themeId,
      settings: structuredClone(input.settings),
      draftArtifactId: input.draftArtifactId ?? null,
      updatedAt: new Date(0),
    })),
  };
  const coordinator = {
    async run<T>(_storeId: string, operation: (transaction: WorkspaceTransaction) => Promise<T>) {
      const result = await operation(tx);
      generation += 1;
      return { result, generation };
    },
  };
  return { repository, service: new ThemeService(repository, coordinator) };
}

describe("ThemeService", () => {
  it("creates revision zero and returns coordinator generation", async () => {
    const { service } = setup();
    const result = await service.saveThemeConfiguration("store-a", null, {
      themeId: "minimal",
      settings: { colors: { accent: "#000000" } },
    });

    expect(result.theme).toMatchObject({ revision: 0, themeId: "minimal" });
    expect(result.generation).toBe(1);
  });

  it("passes the expected revision through for updates", async () => {
    const { service, repository } = setup();
    await service.saveThemeConfiguration("store-a", 3, {
      themeId: "minimal",
      settings: { colors: { accent: "#ffffff" } },
    });

    expect(repository.saveThemeConfiguration).toHaveBeenCalledWith(tx, expect.objectContaining({
      storeId: "store-a",
      expectedRevision: 3,
    }));
  });

  it("rejects invalid values for manifest-declared settings before persisting", async () => {
    const { service, repository } = setup();

    await expect(service.saveThemeConfiguration("store-a", null, {
      themeId: "minimal",
      settings: { layout: { containerWidth: "not-a-width" } },
    })).rejects.toMatchObject({ code: "THEME_SETTINGS_INVALID", status: 422 });

    expect(repository.saveThemeConfiguration).not.toHaveBeenCalled();
  });

  it("rejects an artifact that belongs to a different pinned theme version", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.getInstalledThemeArtifact).mockResolvedValue({ themeId: "other", themeVersion: "1.0.0" });
    await expect(service.saveThemeConfiguration("store-a", null, {
      themeId: "minimal", settings: {}, draftArtifactId: "artifact-v1",
    })).rejects.toMatchObject({ code: "THEME_ARTIFACT_MISMATCH", status: 422 });
    expect(repository.saveThemeConfiguration).not.toHaveBeenCalled();
  });

  it("checks the existing artifact when a save omits draftArtifactId", async () => {
    const { service, repository } = setup();
    vi.mocked(repository.getThemeConfiguration).mockResolvedValue({ storeId: "store-a", revision: 4, themeId: "minimal", themeVersion: "1.0.0", settings: {}, draftArtifactId: "stale-artifact", updatedAt: new Date(0) });
    vi.mocked(repository.getInstalledThemeArtifact).mockResolvedValue({ themeId: "other", themeVersion: "1.0.0" });
    await expect(service.saveThemeConfiguration("store-a", 4, { themeId: "minimal", settings: {} }))
      .rejects.toMatchObject({ code: "THEME_ARTIFACT_MISMATCH", status: 422 });
    expect(repository.saveThemeConfiguration).not.toHaveBeenCalled();
  });
});
