import type { WorkspaceTransaction } from "../concurrency.js";
import type { SectionDocument } from "./global-section-repository.js";

export interface SectionPresetRecord {
  id: string;
  storeId: string;
  revision: number;
  name: string;
  section: SectionDocument;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePresetInput {
  storeId: string;
  name: string;
  section: SectionDocument;
}

export interface PresetRepository {
  getPreset(storeId: string, id: string): Promise<SectionPresetRecord | null>;
  listPresets(storeId: string): Promise<SectionPresetRecord[]>;
  createPreset(transaction: WorkspaceTransaction, input: CreatePresetInput): Promise<SectionPresetRecord>;
}
