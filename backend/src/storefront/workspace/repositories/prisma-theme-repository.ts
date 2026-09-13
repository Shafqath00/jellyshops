import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { assertExpectedRevision, nextRevision, type WorkspaceTransaction } from "../concurrency.js";
import type {
  SaveThemeConfigurationInput,
  ThemeConfigurationRecord,
  ThemeRepository,
  ThemeSettings,
} from "./theme-repository.js";

function mapTheme(row: {
  storeId: string;
  revision: number;
  themeId: string;
  settings: unknown;
  draftArtifactId: string | null;
  updatedAt: Date;
}): ThemeConfigurationRecord {
  if (!row.settings || typeof row.settings !== "object" || Array.isArray(row.settings)) {
    throw new Error("Theme settings must be an object");
  }
  return {
    storeId: row.storeId,
    revision: row.revision,
    themeId: row.themeId,
    settings: structuredClone(row.settings as ThemeSettings),
    draftArtifactId: row.draftArtifactId,
    updatedAt: row.updatedAt,
  };
}

export class PrismaThemeRepository implements ThemeRepository {
  constructor(private readonly client: PrismaClient) {}

  async getThemeConfiguration(storeId: string): Promise<ThemeConfigurationRecord | null> {
    const row = await this.client.themeConfiguration.findUnique({ where: { storeId } });
    return row ? mapTheme(row) : null;
  }

  async saveThemeConfiguration(
    transaction: WorkspaceTransaction,
    input: SaveThemeConfigurationInput,
  ): Promise<ThemeConfigurationRecord> {
    const current = await transaction.themeConfiguration.findUnique({ where: { storeId: input.storeId } });
    if (!current) {
      if (input.expectedRevision !== null) {
        assertExpectedRevision(0, input.expectedRevision);
      }
      return mapTheme(await transaction.themeConfiguration.create({
        data: {
          storeId: input.storeId,
          themeId: input.themeId,
          settings: input.settings as Prisma.InputJsonValue,
          draftArtifactId: input.draftArtifactId ?? null,
        },
      }));
    }

    if (input.expectedRevision === null) {
      assertExpectedRevision(current.revision, -1);
    }
    assertExpectedRevision(current.revision, input.expectedRevision!);
    return mapTheme(await transaction.themeConfiguration.update({
      where: { storeId: input.storeId },
      data: {
        revision: nextRevision(current.revision),
        themeId: input.themeId,
        settings: input.settings as Prisma.InputJsonValue,
        ...(input.draftArtifactId !== undefined ? { draftArtifactId: input.draftArtifactId } : {}),
      },
    }));
  }
}
