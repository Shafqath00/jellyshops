import type { CompilationInputLoader } from "./compiler/service.js";
import type {
  CompilerAssignmentInput,
  CompilerGlobalSectionInput,
  CompilerMenuInput,
  CompilerMetaobjectDefinitionInput,
  CompilerMetafieldDefinitionInput,
  CompilerSectionNode,
  CompilerTemplateInput,
  StorefrontCompilationInput,
} from "./compiler/types.js";
import { WorkspaceGenerationConflictError } from "./workspace/errors.js";
import type { TemplateAssignmentRecord } from "./workspace/repositories/assignment-repository.js";
import type { GlobalSectionRecord } from "./workspace/repositories/global-section-repository.js";
import type { NavigationMenuRecord } from "./workspace/repositories/menu-repository.js";
import {
  isRetiredTemplateHandle,
  templateTypes,
  type StorefrontTemplateRecord,
  type TemplateType,
} from "./workspace/repositories/template-repository.js";
import type { ThemeConfigurationRecord } from "./workspace/repositories/theme-repository.js";

export interface CompilerResourceIds {
  products: Iterable<string>;
  collections: Iterable<string>;
  pages: Iterable<string>;
  blogs: Iterable<string>;
  articles: Iterable<string>;
}

export interface LocalV4WorkspaceDataSource {
  getWorkspace(storeId: string): Promise<{ generation: number; updatedAt: Date } | null>;
  listTemplates(storeId: string): Promise<StorefrontTemplateRecord[] | undefined>;
  listGlobalSections(storeId: string): Promise<GlobalSectionRecord[] | undefined>;
  listMenus(storeId: string): Promise<NavigationMenuRecord[] | undefined>;
  getThemeConfiguration(storeId: string): Promise<ThemeConfigurationRecord | null>;
  listAssignments(storeId: string): Promise<TemplateAssignmentRecord[] | undefined>;
  listResourceIds(storeId: string): Promise<CompilerResourceIds | undefined>;
  listMetafieldDefinitions(storeId: string): Promise<CompilerMetafieldDefinitionInput[] | undefined>;
  listMetaobjectDefinitions(storeId: string): Promise<CompilerMetaobjectDefinitionInput[] | undefined>;
}

function templateType(value: string): TemplateType {
  const normalized = value.toLowerCase().replaceAll("_", "-");
  return templateTypes.includes(normalized as TemplateType)
    ? normalized as TemplateType
    : value as TemplateType;
}

function template(record: StorefrontTemplateRecord): CompilerTemplateInput {
  return {
    id: record.id,
    type: templateType(record.type),
    handle: record.handle,
    name: record.name,
    layout: record.layout as CompilerTemplateInput["layout"],
  };
}

function globalSection(record: GlobalSectionRecord): CompilerGlobalSectionInput {
  return { id: record.id, name: record.name, section: record.section as unknown as CompilerSectionNode };
}

function menu(record: NavigationMenuRecord): CompilerMenuInput {
  return { id: record.id, handle: record.handle, name: record.name, items: record.items };
}

function assignment(record: TemplateAssignmentRecord): CompilerAssignmentInput {
  return { resourceType: record.resourceType, resourceId: record.resourceId, templateId: record.templateId };
}

function resourceIds(source: CompilerResourceIds | undefined): StorefrontCompilationInput["resourceIds"] {
  return {
    products: new Set(source?.products ?? []),
    collections: new Set(source?.collections ?? []),
    pages: new Set(source?.pages ?? []),
    blogs: new Set(source?.blogs ?? []),
    articles: new Set(source?.articles ?? []),
  };
}

function theme(configuration: ThemeConfigurationRecord | null): StorefrontCompilationInput["theme"] {
  if (!configuration) return { presetId: "minimal", settings: {}, artifactId: null };
  return {
    presetId: configuration.themeId,
    id: configuration.themeId,
    version: configuration.themeVersion,
    settings: configuration.settings,
    artifactId: configuration.draftArtifactId,
  };
}

/**
 * Templates set aside by a store-design switch stay in the draft library, but only the
 * ones still assigned to something are compiled, so an old layout can't block publishing.
 */
function liveTemplates(templates: StorefrontTemplateRecord[], assignments: TemplateAssignmentRecord[]): StorefrontTemplateRecord[] {
  const assigned = new Set(assignments.map(({ templateId }) => templateId));
  return templates.filter((record) => !isRetiredTemplateHandle(record.handle) || assigned.has(record.id));
}

export class LocalV4WorkspaceReader implements CompilationInputLoader {
  constructor(private readonly source: LocalV4WorkspaceDataSource) {}

  async load(storeId: string, expectedGeneration: number, registryManifestHash: string): Promise<StorefrontCompilationInput> {
    const initial = await this.workspace(storeId);
    if (initial.generation !== expectedGeneration) throw new WorkspaceGenerationConflictError(initial.generation);

    const [templates, globalSections, menus, themeConfiguration, assignments, ids, metafields, metaobjects] = await Promise.all([
      this.source.listTemplates(storeId),
      this.source.listGlobalSections(storeId),
      this.source.listMenus(storeId),
      this.source.getThemeConfiguration(storeId),
      this.source.listAssignments(storeId),
      this.source.listResourceIds(storeId),
      this.source.listMetafieldDefinitions(storeId),
      this.source.listMetaobjectDefinitions(storeId),
    ]);

    // This detects a concurrent workspace mutation but is not a transactional snapshot read.
    const final = await this.workspace(storeId);
    if (final.generation !== initial.generation) throw new WorkspaceGenerationConflictError(final.generation);

    return {
      storeId,
      generation: initial.generation,
      theme: theme(themeConfiguration),
      templates: liveTemplates(templates ?? [], assignments ?? []).map(template),
      globalSections: (globalSections ?? []).map(globalSection),
      menus: (menus ?? []).map(menu),
      assignments: (assignments ?? []).map(assignment),
      metafieldDefinitions: metafields ?? [],
      metaobjectDefinitions: metaobjects ?? [],
      resourceIds: resourceIds(ids),
      registryManifestHash,
    };
  }

  private async workspace(storeId: string): Promise<{ generation: number; updatedAt: Date }> {
    return await this.source.getWorkspace(storeId) ?? { generation: 0, updatedAt: new Date(0) };
  }
}
