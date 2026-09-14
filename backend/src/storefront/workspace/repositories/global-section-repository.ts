import type { WorkspaceTransaction } from "../concurrency.js";

export type SectionDocument = Record<string, unknown>;

export interface GlobalSectionRecord {
  id: string;
  storeId: string;
  revision: number;
  name: string;
  section: SectionDocument;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGlobalSectionInput {
  storeId: string;
  name: string;
  section: SectionDocument;
}

export interface UpdateGlobalSectionInput {
  name?: string;
  section?: SectionDocument;
}

export interface GlobalSectionRepository {
  getGlobalSection(storeId: string, id: string): Promise<GlobalSectionRecord | null>;
  listGlobalSections(storeId: string): Promise<GlobalSectionRecord[]>;
  createGlobalSection(transaction: WorkspaceTransaction, input: CreateGlobalSectionInput): Promise<GlobalSectionRecord>;
  updateGlobalSection(
    transaction: WorkspaceTransaction,
    storeId: string,
    id: string,
    expectedRevision: number,
    patch: UpdateGlobalSectionInput,
  ): Promise<GlobalSectionRecord | null>;
}
