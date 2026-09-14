import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import type { WorkspaceTransaction } from "../concurrency.js";
import type { SectionDocument } from "./global-section-repository.js";
import type { CreatePresetInput, PresetRepository, SectionPresetRecord } from "./preset-repository.js";

function mapPreset(row: {
  id: string;
  storeId: string;
  revision: number;
  name: string;
  section: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SectionPresetRecord {
  if (!row.section || typeof row.section !== "object" || Array.isArray(row.section)) {
    throw new Error("Section preset document must be an object");
  }
  return {
    id: row.id,
    storeId: row.storeId,
    revision: row.revision,
    name: row.name,
    section: structuredClone(row.section as SectionDocument),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaPresetRepository implements PresetRepository {
  constructor(private readonly client: PrismaClient) {}

  async getPreset(storeId: string, id: string): Promise<SectionPresetRecord | null> {
    const row = await this.client.sectionPreset.findFirst({ where: { storeId, id } });
    return row ? mapPreset(row) : null;
  }

  async listPresets(storeId: string): Promise<SectionPresetRecord[]> {
    return (await this.client.sectionPreset.findMany({ where: { storeId }, orderBy: { name: "asc" } }))
      .map(mapPreset);
  }

  async createPreset(
    transaction: WorkspaceTransaction,
    input: CreatePresetInput,
  ): Promise<SectionPresetRecord> {
    return mapPreset(await transaction.sectionPreset.create({
      data: { ...input, section: input.section as Prisma.InputJsonValue },
    }));
  }
}
