import type { WorkspaceMutationRunner } from "./mutation-runner.js";
import type {
  GlobalSectionRecord,
  GlobalSectionRepository,
  SectionDocument,
  UpdateGlobalSectionInput,
} from "./repositories/global-section-repository.js";
import type { PresetRepository, SectionPresetRecord } from "./repositories/preset-repository.js";

export interface GlobalPlacement {
  kind: "global";
  globalSectionId: string;
}

export interface GlobalSectionMutationResult {
  globalSection: GlobalSectionRecord;
  generation: number;
}

export interface PresetMutationResult {
  preset: SectionPresetRecord;
  generation: number;
}

function normalizeName(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function cloneSection(section: SectionDocument): SectionDocument {
  if (!section || typeof section !== "object" || Array.isArray(section)) {
    throw new Error("Section document must be an object");
  }
  return structuredClone(section);
}

export class GlobalSectionService {
  constructor(
    private readonly globals: GlobalSectionRepository,
    private readonly presets: PresetRepository,
    private readonly coordinator: WorkspaceMutationRunner,
  ) {}

  getGlobalSection(storeId: string, id: string) {
    return this.globals.getGlobalSection(storeId, id);
  }

  listGlobalSections(storeId: string) {
    return this.globals.listGlobalSections(storeId);
  }

  listPresets(storeId: string) {
    return this.presets.listPresets(storeId);
  }

  async createGlobalSection(
    storeId: string,
    input: { name: string; section: SectionDocument },
  ): Promise<GlobalSectionMutationResult> {
    const mutation = await this.coordinator.run(storeId, (transaction) => this.globals.createGlobalSection(
      transaction,
      { storeId, name: normalizeName(input.name, "Global section name"), section: cloneSection(input.section) },
    ));
    return { globalSection: mutation.result, generation: mutation.generation };
  }

  async updateGlobalSection(
    storeId: string,
    id: string,
    expectedRevision: number,
    patch: UpdateGlobalSectionInput,
  ): Promise<GlobalSectionMutationResult> {
    const normalized: UpdateGlobalSectionInput = {
      ...(patch.name !== undefined ? { name: normalizeName(patch.name, "Global section name") } : {}),
      ...(patch.section !== undefined ? { section: cloneSection(patch.section) } : {}),
    };
    const mutation = await this.coordinator.run(storeId, async (transaction) => {
      const globalSection = await this.globals.updateGlobalSection(transaction, storeId, id, expectedRevision, normalized);
      if (!globalSection) throw new Error("Global section was not found");
      return globalSection;
    });
    return { globalSection: mutation.result, generation: mutation.generation };
  }

  async createPreset(
    storeId: string,
    input: { name: string; section: SectionDocument },
  ): Promise<PresetMutationResult> {
    const mutation = await this.coordinator.run(storeId, (transaction) => this.presets.createPreset(
      transaction,
      { storeId, name: normalizeName(input.name, "Preset name"), section: cloneSection(input.section) },
    ));
    return { preset: mutation.result, generation: mutation.generation };
  }

  async instantiatePreset(storeId: string, presetId: string): Promise<SectionDocument> {
    const preset = await this.presets.getPreset(storeId, presetId);
    if (!preset) throw new Error("Section preset was not found");
    return cloneSection(preset.section);
  }

  createGlobalPlacement(globalSectionId: string): GlobalPlacement {
    const id = globalSectionId.trim();
    if (!id) throw new Error("Global section id is required");
    return { kind: "global", globalSectionId: id };
  }
}
