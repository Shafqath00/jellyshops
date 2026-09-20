import type {
  CompilationDiagnostic,
  DynamicBinding,
  DynamicValueType,
} from "@jelly/storefront-schema";
import type { TemplateType } from "../workspace/repositories/template-repository.js";

export interface CompilerResponsiveSettings {
  mobile?: Record<string, unknown>;
}

export interface CompilerBlockNode {
  id: string;
  type: string;
  enabled?: boolean;
  settings: Record<string, unknown>;
  responsive?: CompilerResponsiveSettings;
}

export interface CompilerSectionNode {
  id: string;
  type: string;
  enabled?: boolean;
  settings: Record<string, unknown>;
  responsive?: CompilerResponsiveSettings;
  blocks?: CompilerBlockNode[];
}

export type CompilerSectionPlacement =
  | { kind: "inline"; section: CompilerSectionNode }
  | { kind: "global"; globalSectionId: string };

export interface CompilerTemplateInput {
  id: string;
  type: TemplateType;
  handle: string;
  name: string;
  layout: { sections: CompilerSectionPlacement[] };
}

export interface CompilerGlobalSectionInput {
  id: string;
  name: string;
  section: CompilerSectionNode;
}

export interface CompilerMenuInput {
  id: string;
  handle: string;
  name: string;
  items: unknown[];
}

export interface CompilerAssignmentInput {
  resourceType: "product" | "collection" | "page" | "blog" | "article";
  resourceId: string;
  templateId: string;
}

export interface CompilerMetafieldDefinitionInput {
  id: string;
  ownerType: string;
  namespace: string;
  key: string;
  type: DynamicValueType;
  storefrontVisible: boolean;
  archived: boolean;
  metaobjectDefinitionId?: string;
}

export interface CompilerMetaobjectDefinitionInput {
  id: string;
  handle: string;
  storefrontVisible: boolean;
  archived: boolean;
  fields: Array<{
    handle: string;
    type: DynamicValueType;
    storefrontVisible: boolean;
  }>;
}

export interface StorefrontCompilationInput {
  storeId: string;
  generation: number;
  theme: {
    presetId: string;
    id?: string;
    version?: string;
    settings: Record<string, unknown>;
    artifactId: string | null;
    fallbackReason?: "theme-unavailable" | "version-unavailable";
  };
  templates: CompilerTemplateInput[];
  globalSections: CompilerGlobalSectionInput[];
  menus: CompilerMenuInput[];
  assignments: CompilerAssignmentInput[];
  metafieldDefinitions: CompilerMetafieldDefinitionInput[];
  metaobjectDefinitions: CompilerMetaobjectDefinitionInput[];
  resourceIds: {
    products: Set<string>;
    collections: Set<string>;
    pages: Set<string>;
    blogs: Set<string>;
    articles: Set<string>;
  };
  registryManifestHash: string;
}

export interface RegistrySectionIssue {
  code: string;
  message: string;
  sectionId?: string;
  blockId?: string;
  fieldKey?: string;
}

export interface CompilerRegistry {
  validateSection(section: CompilerSectionNode, templateType: TemplateType): RegistrySectionIssue[];
  dynamicSettingType(sectionType: string, fieldKey: string, blockType?: string): DynamicValueType | null;
}

export interface CompilerDynamicSourceResolver {
  describeBinding(
    storeId: string,
    binding: DynamicBinding,
    templateType: TemplateType,
  ): Promise<{ valueType: DynamicValueType }>;
}

export interface DynamicBindingOccurrence {
  sectionId: string;
  sectionType: string;
  blockId?: string;
  blockType?: string;
  fieldKey: string;
  binding: DynamicBinding;
}

export interface ValidationResult {
  diagnostics: CompilationDiagnostic[];
}
