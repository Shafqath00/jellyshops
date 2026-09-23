import { randomUUID } from "node:crypto";
import { getV4StarterPack, validateV4StarterPack, type StarterMenuItem, type V4StarterPack, type V4StarterPackId } from "@jelly/storefront-registry";
import type { SectionNode } from "@jelly/storefront-schema";
import type { CommerceDatabase, SqlExecutor } from "../../commerce/repository.js";
import { ApiError } from "../../http/errors.js";

export class StarterInstallationConflictError extends ApiError {
  constructor(message = "A starter can only be installed into an empty storefront workspace.") {
    super(409, "STARTER_INSTALL_CONFLICT", message);
  }
}

export class StorefrontNotFoundError extends ApiError {
  constructor() { super(404, "STOREFRONT_NOT_FOUND", "Storefront was not found"); }
}

export interface StarterInstallationResult {
  storeId: string;
  starterPackId: V4StarterPackId;
  starterPackVersion: string;
  generation: number;
  installed: boolean;
}

function toDatabaseType(type: string): string {
  return type.replaceAll("-", "_").toUpperCase();
}

function rekeySection(section: SectionNode, prefix: string): SectionNode {
  const blocks = section.blocks.map((block) => ({ ...block, id: `${prefix}:${block.id}` }));
  return { ...section, id: `${prefix}:${String(section.id)}`, blocks };
}

function rekeyMenuItems(items: StarterMenuItem[], prefix: string): StarterMenuItem[] {
  return items.map((item) => ({
    ...item,
    id: `${prefix}:${item.id}`,
    children: rekeyMenuItems(item.children, prefix),
  }));
}

function rekeyLayout(
  layout: V4StarterPack["templates"][number]["layout"],
  prefix: string,
  globalSectionIds: Map<string, string>,
): V4StarterPack["templates"][number]["layout"] {
  return { sections: layout.sections.map((placement) => placement.kind === "global"
    ? { ...placement, globalSectionId: globalSectionIds.get(placement.globalSectionId) ?? placement.globalSectionId }
    : { ...placement, section: rekeySection(placement.section, prefix) }) };
}

async function hasExistingWorkspaceState(sql: SqlExecutor, storeId: string): Promise<boolean> {
  const result = await sql.query<{ hasState: boolean }>(
    `SELECT (
       EXISTS (SELECT 1 FROM "StorefrontTemplate" WHERE "storeId" = $1)
       OR EXISTS (SELECT 1 FROM "GlobalSection" WHERE "storeId" = $1)
       OR EXISTS (SELECT 1 FROM "NavigationMenu" WHERE "storeId" = $1)
       OR EXISTS (SELECT 1 FROM "ThemeConfiguration" WHERE "storeId" = $1)
       OR EXISTS (SELECT 1 FROM "StorefrontTemplateAssignment" WHERE "storeId" = $1)
     ) AS "hasState"`,
    [storeId],
  );
  return result.rows[0]?.hasState === true;
}

export class StorefrontStarterInstallationService {
  constructor(
    private readonly database: CommerceDatabase,
    private readonly id: () => string = randomUUID,
  ) {}

  async install(storeId: string, starterPackId: string): Promise<StarterInstallationResult> {
    if (starterPackId !== "fresh-market" && starterPackId !== "artisan-boutique") {
      throw new RangeError("Unknown V4 starter pack");
    }
    const pack = getV4StarterPack(starterPackId);
    const issues = validateV4StarterPack(pack);
    if (issues.length) throw new Error(`Invalid V4 starter pack: ${issues.map(({ message }) => message).join("; ")}`);

    return this.database.transaction(async (sql) => {
      const store = await sql.query<{ id: string }>(`SELECT "id" FROM "Store" WHERE "id" = $1 FOR UPDATE`, [storeId]);
      if (!store.rows[0]) throw new StorefrontNotFoundError();

      await sql.query(
        `INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt") VALUES ($1, 0, CURRENT_TIMESTAMP) ON CONFLICT ("storeId") DO NOTHING`,
        [storeId],
      );
      const workspace = await sql.query<{ generation: number; starterPackId: string | null; starterPackVersion: string | null }>(
        `SELECT "generation", "starterPackId", "starterPackVersion" FROM "StorefrontWorkspace" WHERE "storeId" = $1 FOR UPDATE`,
        [storeId],
      );
      const current = workspace.rows[0];
      if (current?.starterPackId === pack.id && current.starterPackVersion === pack.version) {
        return { storeId, starterPackId: pack.id, starterPackVersion: pack.version, generation: Number(current.generation), installed: false };
      }
      if (current?.starterPackId || await hasExistingWorkspaceState(sql, storeId)) throw new StarterInstallationConflictError();

      const installationId = this.id();
      const installedGlobalIds = new Map<string, string>();
      for (const global of pack.globalSections) installedGlobalIds.set(global.section.id, `${installationId}:${global.section.id}`);
      const installedTemplateIds = new Map(pack.templates.map((template) => [template.key, `${installationId}:${template.key}`]));
      const now = new Date();

      for (const global of pack.globalSections) {
        const sectionId = installedGlobalIds.get(global.section.id)!;
        await sql.query(
          `INSERT INTO "GlobalSection" ("id", "storeId", "revision", "name", "section", "createdAt", "updatedAt") VALUES ($1, $2, 0, $3, $4::jsonb, $5, $5)`,
          [sectionId, storeId, global.name, JSON.stringify(rekeySection(global.section, installationId)), now],
        );
      }

      for (const template of pack.templates) {
        await sql.query(
          `INSERT INTO "StorefrontTemplate" ("id", "storeId", "revision", "type", "handle", "name", "layout", "createdAt", "updatedAt") VALUES ($1, $2, 0, $3::"StorefrontTemplateType", $4, $5, $6::jsonb, $7, $7)`,
          [installedTemplateIds.get(template.key), storeId, toDatabaseType(template.type), template.handle, template.name, JSON.stringify(rekeyLayout(template.layout, installationId, installedGlobalIds)), now],
        );
      }

      for (const menu of pack.menus) {
        await sql.query(
          `INSERT INTO "NavigationMenu" ("id", "storeId", "revision", "name", "handle", "items", "createdAt", "updatedAt") VALUES ($1, $2, 0, $3, $4, $5::jsonb, $6, $6)`,
          [`${installationId}:${menu.key}`, storeId, menu.name, menu.handle, JSON.stringify(rekeyMenuItems(menu.items, installationId)), now],
        );
      }

      await sql.query(
        `INSERT INTO "ThemeConfiguration" ("storeId", "revision", "themeId", "themeVersion", "settings", "draftArtifactId", "updatedAt") VALUES ($1, 0, $2, $3, $4::jsonb, NULL, $5)`,
        [storeId, pack.theme.themeId, pack.version, JSON.stringify(pack.theme.settings), now],
      );
      const updatedWorkspace = await sql.query<{ generation: number }>(
        `UPDATE "StorefrontWorkspace" SET "generation" = "generation" + 1, "starterPackId" = $2, "starterPackVersion" = $3, "updatedAt" = $4 WHERE "storeId" = $1 RETURNING "generation"`,
        [storeId, pack.id, pack.version, now],
      );
      return { storeId, starterPackId: pack.id, starterPackVersion: pack.version, generation: Number(updatedWorkspace.rows[0]?.generation ?? 1), installed: true };
    });
  }
}
