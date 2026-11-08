import type { SqlExecutor } from "../commerce/repository.js";
import type {
  CompilerResourceIds,
  LocalV4WorkspaceDataSource,
} from "./local-v4-workspace-reader.js";
import type { TemplateAssignmentRecord } from "./workspace/repositories/assignment-repository.js";
import type { GlobalSectionRecord } from "./workspace/repositories/global-section-repository.js";
import type { NavigationMenuRecord } from "./workspace/repositories/menu-repository.js";
import type { StorefrontTemplateRecord } from "./workspace/repositories/template-repository.js";
import type { ThemeConfigurationRecord } from "./workspace/repositories/theme-repository.js";

type ResourceIdLoader = (
  storeId: string,
) => Promise<CompilerResourceIds | undefined>;

export function createSqlCompilerResourceIdLoader(
  sql: SqlExecutor,
): ResourceIdLoader {
  const ids = async (table: string, storeId: string): Promise<string[]> =>
    (
      await sql.query(
        `SELECT "id" FROM "${table}" WHERE "storeId" = $1 ORDER BY "id"`,
        [storeId],
      )
    ).rows.map((row) => String((row as { id: unknown }).id));

  return async (storeId) => {
    const [products, collections, pages, blogs, articles] = await Promise.all([
      ids("Product", storeId),
      ids("Collection", storeId),
      ids("StorePage", storeId),
      ids("Blog", storeId),
      ids("Article", storeId),
    ]);
    return { products, collections, pages, blogs, articles };
  };
}

async function rows<T>(
  sql: SqlExecutor,
  query: string,
  storeId: string,
): Promise<T[]> {
  return (await sql.query(query, [storeId])).rows as T[];
}

export function createSqlV4WorkspaceDataSource(
  sql: SqlExecutor,
  resourceIds: ResourceIdLoader,
): LocalV4WorkspaceDataSource {
  return {
    async getWorkspace(storeId) {
      return (
        await rows<{ generation: number; updatedAt: Date }>(
          sql,
          `SELECT "generation", "updatedAt"
           FROM "StorefrontWorkspace"
           WHERE "storeId" = $1`,
          storeId,
        )
      )[0] ?? null;
    },

    listTemplates(storeId) {
      return rows<StorefrontTemplateRecord>(
        sql,
        `SELECT *
         FROM "StorefrontTemplate"
         WHERE "storeId" = $1
         ORDER BY "id"`,
        storeId,
      );
    },

    listGlobalSections(storeId) {
      return rows<GlobalSectionRecord>(
        sql,
        `SELECT *
         FROM "GlobalSection"
         WHERE "storeId" = $1
         ORDER BY "id"`,
        storeId,
      );
    },

    listMenus(storeId) {
      return rows<NavigationMenuRecord>(
        sql,
        `SELECT *
         FROM "NavigationMenu"
         WHERE "storeId" = $1
         ORDER BY "id"`,
        storeId,
      );
    },

    async getThemeConfiguration(storeId) {
      return (
        await rows<ThemeConfigurationRecord>(
          sql,
          `SELECT *
           FROM "ThemeConfiguration"
           WHERE "storeId" = $1`,
          storeId,
        )
      )[0] ?? null;
    },

    listAssignments(storeId) {
      return rows<TemplateAssignmentRecord>(
        sql,
        `SELECT *
         FROM "StorefrontTemplateAssignment"
         WHERE "storeId" = $1
         ORDER BY "resourceType", "resourceId"`,
        storeId,
      );
    },

    listResourceIds: resourceIds,

    async listMetafieldDefinitions() {
      return undefined;
    },

    async listMetaobjectDefinitions() {
      return undefined;
    },
  };
}
