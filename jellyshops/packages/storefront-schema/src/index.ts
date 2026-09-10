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
export type { MediaReference, StorefrontDocument, StorefrontPage, StorefrontPageType, StorefrontTemplateId } from "./storefront-v2.js";
export type { BlockNode, GlobalSettings, PageDocument, PageType, SectionNode, StoreDesignDocument, ThemeId } from "./types.js";
