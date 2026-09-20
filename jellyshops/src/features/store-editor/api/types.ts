import type {
  CompilationDiagnostic,
  DynamicBinding,
  DynamicValueType,
  RuntimeStorefrontSnapshotV4,
  StorefrontDocument,
} from "@jelly/storefront-schema";

export type StorefrontTemplateType = "home" | "product" | "collection" | "page" | "blog" | "article" | "search" | "cart";

export interface WorkspaceRecord {
  generation: number;
  updatedAt: string | null;
}

export interface StorefrontTemplateRecord {
  id: string;
  storeId: string;
  revision: number;
  type: StorefrontTemplateType;
  handle: string;
  name: string;
  layout: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateMutationResult {
  template: StorefrontTemplateRecord;
  generation: number;
}

export interface GlobalSectionRecord {
  id: string;
  storeId: string;
  revision: number;
  name: string;
  section: Record<string, unknown>;
}

export interface SectionPresetRecord {
  id: string;
  storeId: string;
  revision: number;
  name: string;
  section: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface DynamicSourceDescriptor {
  id: string;
  label: string;
  valueType: DynamicValueType;
  requiredContext?: StorefrontTemplateType | "any";
  binding: DynamicBinding;
  metaobjectDefinitionId?: string;
}

export interface MenuRecord {
  id: string;
  storeId: string;
  revision: number;
  name: string;
  handle: string;
  items: unknown[];
}

export interface ThemeConfigurationRecord {
  storeId: string;
  revision: number;
  themeId: string;
  themeVersion?: string;
  settings: Record<string, unknown>;
  draftArtifactId?: string | null;
}
export type ThemeSettingFieldType = "text" | "textarea" | "number" | "range" | "checkbox" | "select" | "radio" | "color" | "font" | "image" | "url" | "richtext" | "alignment";
export interface ThemeSettingDefinition {
  id: string;
  type: ThemeSettingFieldType;
  label: string;
  description?: string;
  group?: string;
  default: unknown;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
}
export interface ThemeCatalogEntry { id: string; name: string; version: string; description: string; previewAsset?: string; available: boolean; layout?: string; settingsSchema?: ThemeSettingDefinition[] }

export interface TemplateAssignmentRecord {
  storeId: string;
  resourceType: "product" | "collection" | "page" | "blog" | "article";
  resourceId: string;
  templateId: string;
  revision: number;
}

export interface ResourceMutationResult {
  generation: number;
  [key: string]: unknown;
}

export interface CompilationResult {
  ok: boolean;
  diagnostics: CompilationDiagnostic[];
  dependencies: unknown;
  snapshot?: RuntimeStorefrontSnapshotV4;
}

export interface PublishResult {
  ok: boolean;
  publication?: { id: string; storeId: string; sourceGeneration: number };
  diagnostics: CompilationDiagnostic[];
  reused?: boolean;
}

// V3 read-only compatibility during normalized-workspace migration.
export interface DraftRecord { storeId: string; revision: number; document: StorefrontDocument; updatedAt: string }
export interface PublicationRecord { id: string; storeId: string; sourceRevision: number; document: unknown; publishedAt: string }

export interface MediaRecord { id: string; storeId: string; url: string; mimeType: string; byteSize: number; width: number; height: number; originalName: string; referenced: boolean; createdAt: string }
export interface CatalogAdminVariant { id: string; title: string; sku: string | null; priceMinor: number; quantity: number | null; available: boolean }
export interface CatalogAdminProduct { id: string; storeId: string; handle: string; title: string; description: string; productType: string | null; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; media: Array<{ id: string; url: string; altText: string | null; position: number }>; variants: CatalogAdminVariant[]; available: boolean; primaryCategoryId?: string | null; additionalCategoryIds?: string[]; brandId?: string | null; collectionIds?: string[]; categoryMetadata?: unknown | null; brandMetadata?: unknown | null; collectionMetadata?: unknown[]; options?: unknown[]; inventoryOptionIds?: string[] }
export interface DemoProduct { id: string; slug: string; name: string; imageUrl: string; priceMinor: number; currency: "USD" }
export interface DemoCollection { id: string; slug: string; name: string; imageUrl: string; productIds: string[] }
export interface DemoCatalog { products: DemoProduct[]; collections: DemoCollection[] }
export interface ApiIssue { path: string; message: string }

export class StoreEditorApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: ApiIssue[],
    public readonly currentRevision?: number,
    public readonly currentGeneration?: number,
  ) { super(message); }
}
