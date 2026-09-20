import type { WorkspaceTransaction } from "../concurrency.js";

export type ThemeSettings = Record<string, unknown>;

export interface ThemeConfigurationRecord {
  storeId: string;
  revision: number;
  themeId: string;
  themeVersion: string;
  settings: ThemeSettings;
  draftArtifactId: string | null;
  updatedAt: Date;
}

export interface SaveThemeConfigurationInput {
  storeId: string;
  expectedRevision: number | null;
  themeId: string;
  themeVersion?: string;
  settings: ThemeSettings;
  draftArtifactId?: string | null;
}

export interface ThemeRepository {
  getThemeConfiguration(storeId: string): Promise<ThemeConfigurationRecord | null>;
  saveThemeConfiguration(
    transaction: WorkspaceTransaction,
    input: SaveThemeConfigurationInput,
  ): Promise<ThemeConfigurationRecord>;
}
