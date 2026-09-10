import {
  createDefaultStorefrontDocument,
  migrateStorefrontDocument,
  validateStorefrontDocument,
  type StorefrontDocument,
} from "@jelly/storefront-schema";

export { createDefaultStorefrontDocument };

export const storefrontDocumentValidator = {
  parse(input: unknown, storeId: string): StorefrontDocument {
    const direct = validateStorefrontDocument(input);
    if (direct.success) return direct.data;

    if (
      input &&
      typeof input === "object" &&
      "schemaVersion" in input &&
      input.schemaVersion === 2
    ) {
      throw direct.error;
    }

    const migrated = migrateStorefrontDocument(input, storeId);
    const result = validateStorefrontDocument(migrated);
    if (!result.success) throw result.error;
    return result.data;
  },
};
