import { storeDesignDocumentSchema } from "./schema.js";
import { STORE_DESIGN_SCHEMA_VERSION } from "./version.js";
import type { StoreDesignDocument } from "./types.js";

type VersionMigration = (input: unknown) => { version: number; document: unknown };

const migrationsBySourceVersion = new Map<number, VersionMigration>();

function getSchemaVersion(input: unknown): number | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  const { schemaVersion } = input as Record<string, unknown>;
  return typeof schemaVersion === "number" ? schemaVersion : undefined;
}

export function migrateStoreDesignDocument(input: unknown): StoreDesignDocument {
  let version = getSchemaVersion(input);
  if (version === undefined) throw new Error("Invalid Store Design document");
  if (version > STORE_DESIGN_SCHEMA_VERSION) throw new Error(`Unsupported Store Design schema version: ${version}`);

  let document = input;
  while (version < STORE_DESIGN_SCHEMA_VERSION) {
    const migrate = migrationsBySourceVersion.get(version);
    if (!migrate) throw new Error(`Unsupported Store Design schema version: ${version}`);
    const migrated = migrate(document);
    version = migrated.version;
    document = migrated.document;
  }

  const parsed = storeDesignDocumentSchema.safeParse(document);
  if (!parsed.success) throw new Error("Invalid Store Design document");
  return parsed.data;
}
