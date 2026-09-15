import type { WorkspaceMutationRunner } from "./mutation-runner.js";
import type {
  ThemeConfigurationRecord,
  ThemeRepository,
  ThemeSettings,
} from "./repositories/theme-repository.js";

export interface ThemeMutationResult {
  theme: ThemeConfigurationRecord;
  generation: number;
}

function normalizeThemeId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("Theme id is required");
  return normalized;
}

function normalizeSettings(settings: ThemeSettings): ThemeSettings {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("Theme settings must be an object");
  }
  return structuredClone(settings);
}

export class ThemeService {
  constructor(
    private readonly repository: ThemeRepository,
    private readonly coordinator: WorkspaceMutationRunner,
  ) {}

  getThemeConfiguration(storeId: string) {
    return this.repository.getThemeConfiguration(storeId);
  }

  async saveThemeConfiguration(
    storeId: string,
    expectedRevision: number | null,
    input: { themeId: string; settings: ThemeSettings; draftArtifactId?: string | null },
  ): Promise<ThemeMutationResult> {
    const mutation = await this.coordinator.run(storeId, (transaction) => this.repository.saveThemeConfiguration(
      transaction,
      {
        storeId,
        expectedRevision,
        themeId: normalizeThemeId(input.themeId),
        settings: normalizeSettings(input.settings),
        ...(input.draftArtifactId !== undefined ? { draftArtifactId: input.draftArtifactId } : {}),
      },
    ));
    return { theme: mutation.result, generation: mutation.generation };
  }
}
