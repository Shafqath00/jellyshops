import {
  getBlockDefinition,
  getSectionDefinition,
  validateSectionAgainstRegistry,
} from "@jelly/storefront-registry";
import type {
  DynamicBinding,
  DynamicValueType,
  PageType,
  SectionNode,
} from "@jelly/storefront-schema";

import type { SqlExecutor } from "../commerce/repository.js";
import { StorefrontCompilationService } from "./compiler/service.js";
import type {
  CompilerDynamicSourceResolver,
  CompilerRegistry,
} from "./compiler/types.js";
import { LocalV4WorkspaceReader } from "./local-v4-workspace-reader.js";
import {
  createSqlCompilerResourceIdLoader,
  createSqlV4WorkspaceDataSource,
} from "./sql-v4-workspace-data-source.js";

const COMPILER_VERSION = "local-v4-1";
const REGISTRY_MANIFEST_HASH = "storefront-registry-0.1.0";

const resourceFieldTypes = new Map<string, DynamicValueType>([
  ["store:name", "string"],
  ["product:title", "string"],
  ["product:description", "rich_text"],
  ["product:vendor", "string"],
  ["product:productType", "string"],
  ["product:featuredImage", "image"],
  ["variant:price", "money"],
  ["variant:sku", "string"],
  ["collection:title", "string"],
  ["collection:description", "rich_text"],
  ["page:title", "string"],
  ["blog:title", "string"],
  ["article:title", "string"],
  ["article:content", "rich_text"],
]);

const compilerRegistry: CompilerRegistry = {
  validateSection(section, templateType) {
    if (!Array.isArray(section.blocks)) {
      return [{
        code: "SETTINGS_INVALID",
        message: "Section blocks must be an array",
        sectionId: section.id,
      }];
    }
    return validateSectionAgainstRegistry(
      section as SectionNode,
      templateType as PageType,
    ).map((issue) => ({
      code: issue.code,
      message: issue.message,
      sectionId: issue.sectionId,
      ...(issue.blockId ? { blockId: issue.blockId } : {}),
      ...(issue.field ? { fieldKey: issue.field } : {}),
    }));
  },

  dynamicSettingType(sectionType, fieldKey, blockType) {
    const controls = blockType
      ? getBlockDefinition(blockType)?.controls
      : getSectionDefinition(sectionType)?.controls;
    return controls?.find(({ key }) => key === fieldKey)?.dynamicTypes?.[0] ?? null;
  },
};

const fixedDynamicSources: CompilerDynamicSourceResolver = {
  async describeBinding(_storeId, binding: DynamicBinding) {
    if (binding.kind !== "resource_field") {
      throw new Error("Dynamic source requires configured custom-data services");
    }
    const valueType = resourceFieldTypes.get(`${binding.resource}:${binding.field}`);
    if (!valueType) throw new Error("Dynamic resource field is unavailable");
    return { valueType };
  },
};

export function createLocalV4CompilationService(
  sql: SqlExecutor,
  dynamicSources: CompilerDynamicSourceResolver = fixedDynamicSources,
): StorefrontCompilationService {
  const source = createSqlV4WorkspaceDataSource(
    sql,
    createSqlCompilerResourceIdLoader(sql),
  );
  const reader = new LocalV4WorkspaceReader(source);
  return new StorefrontCompilationService(
    reader,
    compilerRegistry,
    dynamicSources,
    COMPILER_VERSION,
    () => REGISTRY_MANIFEST_HASH,
  );
}
