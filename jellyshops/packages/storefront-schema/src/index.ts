export { STORE_DESIGN_SCHEMA_VERSION } from "./version.js";
export { createDefaultStoreDesign } from "./defaults.js";
export { migrateStoreDesignDocument } from "./migrations.js";
export { storeDesignDocumentSchema, themeIdSchema } from "./schema.js";
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
export type { BlockNode, GlobalSettings, PageDocument, PageType, SectionNode, StoreDesignDocument, ThemeId } from "./types.js";
