import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { assertExpectedRevision, nextRevision, type WorkspaceTransaction } from "../concurrency.js";
import type {
  CreateGlobalSectionInput,
  GlobalSectionRecord,
  GlobalSectionRepository,
  SectionDocument,
  UpdateGlobalSectionInput,
} from "./global-section-repository.js";

function mapGlobalSection(row: {
  id: string;
  storeId: string;
  revision: number;
  name: string;
  section: unknown;
  createdAt: Date;
  updatedAt: Date;
}): GlobalSectionRecord {
  if (!row.section || typeof row.section !== "object" || Array.isArray(row.section)) {
    throw new Error("Global section document must be an object");
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

export class PrismaGlobalSectionRepository implements GlobalSectionRepository {
  constructor(private readonly client: PrismaClient) {}

  async getGlobalSection(storeId: string, id: string): Promise<GlobalSectionRecord | null> {
    const row = await this.client.globalSection.findFirst({ where: { storeId, id } });
    return row ? mapGlobalSection(row) : null;
  }

  async listGlobalSections(storeId: string): Promise<GlobalSectionRecord[]> {
    return (await this.client.globalSection.findMany({ where: { storeId }, orderBy: { name: "asc" } }))
      .map(mapGlobalSection);
  }

  async createGlobalSection(
    transaction: WorkspaceTransaction,
    input: CreateGlobalSectionInput,
  ): Promise<GlobalSectionRecord> {
    return mapGlobalSection(await transaction.globalSection.create({
      data: { ...input, section: input.section as Prisma.InputJsonValue },
    }));
  }

  async updateGlobalSection(
    transaction: WorkspaceTransaction,
    storeId: string,
    id: string,
    expectedRevision: number,
    patch: UpdateGlobalSectionInput,
  ): Promise<GlobalSectionRecord | null> {
    const current = await transaction.globalSection.findFirst({ where: { storeId, id } });
    if (!current) return null;
    assertExpectedRevision(current.revision, expectedRevision);
    return mapGlobalSection(await transaction.globalSection.update({
      where: { id: current.id },
      data: {
        revision: nextRevision(current.revision),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.section !== undefined ? { section: patch.section as Prisma.InputJsonValue } : {}),
      },
    }));
  }
}
