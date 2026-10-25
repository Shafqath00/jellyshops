export { STORE_DESIGN_SCHEMA_VERSION } from "./version.js";
export { createDefaultStoreDesign } from "./defaults.js";
export { migrateStoreDesignDocument } from "./migrations.js";
export { storeDesignDocumentSchema, themeIdSchema } from "./schema.js";
export { isRichTextDocument, normalizeRichTextDocument, resolveRichTextDocument, safeRichTextHref } from "./rich-text.js";
export {
  STOREFRONT_SCHEMA_VERSION,
  createDefaultStorefrontDocument,
  createStorefrontTemplate,
  getStorefrontPage,
  migrateStorefrontDocument,
  storefrontDocumentSchema,
  validateStorefrontDocument,
} from "./storefront-v2.js";
export {
  customDataOwnerTypeSchema,
  dynamicScalarValueTypes,
  dynamicValueTypeSchema,
  metafieldDefinitionSchema,
  metaobjectDefinitionSchema,
  metaobjectFieldDefinitionSchema,
} from "./custom-data.js";
export {
  dynamicBindingSchema,
  dynamicResourceTypeSchema,
  isDynamicValueTypeCompatible,
  settingValueSchema,
} from "./dynamic-sources.js";
export {
  compilationDiagnosticLocationSchema,
  compilationDiagnosticSchema,
  compilationDiagnosticSeveritySchema,
} from "./diagnostics.js";
export {
  RUNTIME_STOREFRONT_SCHEMA_VERSION,
  runtimeStorefrontSnapshotV4Schema,
} from "./runtime-v4.js";
export type { MediaReference, StorefrontDocument, StorefrontPage, StorefrontPageType, StorefrontTemplateId } from "./storefront-v2.js";
export type {
  CustomDataOwnerType,
  DynamicScalarValueType,
  DynamicValueType,
  MetafieldDefinitionContract,
  MetaobjectDefinitionContract,
  MetaobjectFieldDefinitionContract,
} from "./custom-data.js";
export type { DynamicBinding, DynamicResourceType, SettingValue } from "./dynamic-sources.js";
export type {
  CompilationDiagnostic,
  CompilationDiagnosticLocation,
  CompilationDiagnosticSeverity,
} from "./diagnostics.js";
export type {
  RuntimeDependencyEdgeV4,
  RuntimeGlobalSectionV4,
  RuntimeMenuV4,
  RuntimeStorefrontSnapshotV4,
  RuntimeTemplateAssignmentV4,
  RuntimeTemplateV4,
} from "./runtime-v4.js";
export { storefrontPageTypes } from "./types.js";
export type { BlockNode, GlobalSettings, PageDocument, PageType, SectionNode, StoreDesignDocument, ThemeId } from "./types.js";
export type { RichTextBlock, RichTextDocument, RichTextInline, RichTextMark } from "./rich-text.js";
export {
  MAX_VARIANTS,
  MAX_VARIANT_AXES,
  dropHiddenSelections,
  findConditionProblems,
  getVisibleOptions,
  selectionKey,
  toggleSelection,
  validateProductDraft,
  validateProductOptions,
  validateProductSelections,
  validateVariantCombinations,
} from "./product-options.js";
export type {
  ConditionProblem,
  DraftIssue,
  DraftVariantLike,
  OptionIssue,
  OptionSelection,
  ProductDraftInput,
  ProductOptionConditionLike,
  ProductOptionLike,
  ProductOptionValueLike,
  SelectionProblem,
} from "./product-options.js";
