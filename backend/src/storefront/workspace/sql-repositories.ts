import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import type { CommerceDatabase, SqlExecutor } from "../../commerce/repository.js";
import { DefaultStorefrontWorkspaceApi } from "./api-service.js";
import { AssignmentService } from "./assignment-service.js";
import { GlobalSectionService } from "./global-section-service.js";
import { MenuService } from "./menu-service.js";
import { TemplateService } from "./template-service.js";
import { ThemeService } from "./theme-service.js";
import { ApiError } from "../../http/errors.js";
import { ResourceRevisionConflictError } from "./errors.js";
import { cloneLocalIds } from "./clone-local-ids.js";
import { fromStorefrontTemplateEnumValue as decodeType, toStorefrontTemplateEnumValue as encodeType } from "./template-type-enum.js";
import type { TemplateRepository, StorefrontTemplateRecord } from "./repositories/template-repository.js";
import type { GlobalSectionRepository, GlobalSectionRecord } from "./repositories/global-section-repository.js";
import type { PresetRepository, SectionPresetRecord } from "./repositories/preset-repository.js";
import type { MenuRepository, NavigationMenuRecord } from "./repositories/menu-repository.js";
import type { ThemeRepository, ThemeConfigurationRecord } from "./repositories/theme-repository.js";
import type { AssignmentRepository, TemplateAssignmentRecord } from "./repositories/assignment-repository.js";
import type { WorkspaceMutationRunner } from "./mutation-runner.js";

const resourceTables = { product: "Product", collection: "Collection", page: "StorePage", blog: "Blog", article: "Article" } as const;
const jsonColumns = new Set(["layout", "section", "items", "settings"]);
function sql(transaction: unknown): SqlExecutor { return transaction as SqlExecutor; }
/** Turns the per-page-type unique handle index into a message a merchant can act on. */
async function uniqueTemplateHandle<T>(write: Promise<T>): Promise<T> {
  try { return await write; }
  catch (error) {
    const details = error as { code?: unknown; constraint?: unknown; message?: unknown };
    if (details.code === "23505" && `${details.constraint ?? details.message ?? ""}`.includes("StorefrontTemplate_storeId_type_handle_key")) {
      throw new ApiError(409, "TEMPLATE_HANDLE_TAKEN", "Another template for this page type already uses that name. Choose a different one.");
    }
    throw error;
  }
}

class SqlWorkspaceRepositories implements TemplateRepository, GlobalSectionRepository, PresetRepository, MenuRepository, ThemeRepository, AssignmentRepository, WorkspaceMutationRunner {
  constructor(private readonly db: CommerceDatabase) {}
  async run<T>(storeId: string, operation: (transaction: unknown) => Promise<T>) {
    return this.db.transaction(async (tx) => {
      await tx.query(`INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt") VALUES ($1, 0, NOW()) ON CONFLICT ("storeId") DO NOTHING`, [storeId]);
      await tx.query(`SELECT "generation" FROM "StorefrontWorkspace" WHERE "storeId" = $1 FOR UPDATE`, [storeId]);
      const result = await operation(tx);
      const generation = await tx.query<{ generation: number }>(`UPDATE "StorefrontWorkspace" SET "generation" = "generation" + 1, "updatedAt" = NOW() WHERE "storeId" = $1 RETURNING "generation"`, [storeId]);
      return { result, generation: generation.rows[0].generation };
    });
  }
  private read<T extends QueryResultRow>(table: string, storeId: string, id?: string): Promise<T[]> {
    return this.db.transaction(async (tx) => (await tx.query<T>(`SELECT * FROM "${table}" WHERE "storeId" = $1${id === undefined ? "" : ' AND "id" = $2'} ORDER BY "createdAt", "id"`, id === undefined ? [storeId] : [storeId, id])).rows);
  }
  private async insert<T extends QueryResultRow>(transaction: unknown, table: string, input: Record<string, unknown>): Promise<T> {
    const data = { id: randomUUID(), ...input }; const fields = Object.keys(data);
    return (await sql(transaction).query<T>(`INSERT INTO "${table}" (${fields.map((key) => `"${key}"`).join(", ")}, "updatedAt") VALUES (${fields.map((key, i) => `$${i + 1}${jsonColumns.has(key) ? "::jsonb" : ""}`).join(", ")}, NOW()) RETURNING *`, Object.entries(data).map(([key, value]) => jsonColumns.has(key) ? JSON.stringify(value) : value))).rows[0];
  }
  private async update<T extends QueryResultRow>(transaction: unknown, table: string, storeId: string, id: string, revision: number, patch: Record<string, unknown>): Promise<T | null> {
    const tx = sql(transaction);
    const current = (await tx.query<T & { revision: number }>(`SELECT * FROM "${table}" WHERE "storeId" = $1 AND "id" = $2 FOR UPDATE`, [storeId, id])).rows[0];
    if (!current) return null;
    if (current.revision !== revision) throw new ResourceRevisionConflictError(current.revision);
    const fields = Object.entries(patch).filter(([, value]) => value !== undefined);
    return (await tx.query<T>(`UPDATE "${table}" SET "revision" = "revision" + 1, "updatedAt" = NOW()${fields.map(([key], i) => `, "${key}" = $${i + 4}${jsonColumns.has(key) ? "::jsonb" : ""}`).join("")} WHERE "storeId" = $1 AND "id" = $2 AND "revision" = $3 RETURNING *`, [storeId, id, revision, ...fields.map(([key, value]) => jsonColumns.has(key) ? JSON.stringify(value) : value)])).rows[0];
  }
  private template(row: StorefrontTemplateRecord): StorefrontTemplateRecord { return { ...row, type: decodeType(row.type) }; }
  getWorkspace(storeId: string) { return this.db.transaction(async (tx) => (await tx.query<{ generation: number; updatedAt: Date }>(`SELECT "generation", "updatedAt" FROM "StorefrontWorkspace" WHERE "storeId" = $1`, [storeId])).rows[0] ?? null); }
  async getTemplate(storeId: string, id: string) { const row = (await this.read<StorefrontTemplateRecord>("StorefrontTemplate", storeId, id))[0]; return row ? this.template(row) : null; }
  async listTemplates(storeId: string, type?: StorefrontTemplateRecord["type"]) { return (await this.read<StorefrontTemplateRecord>("StorefrontTemplate", storeId)).map((row) => this.template(row)).filter((row) => !type || row.type === type); }
  async createTemplate(tx: unknown, input: Parameters<TemplateRepository["createTemplate"]>[1]) { return this.template(await uniqueTemplateHandle(this.insert<StorefrontTemplateRecord>(tx, "StorefrontTemplate", { ...input, type: encodeType(input.type) }))); }
  async updateTemplate(tx: unknown, storeId: string, id: string, revision: number, patch: Parameters<TemplateRepository["updateTemplate"]>[4]) { const row = await uniqueTemplateHandle(this.update<StorefrontTemplateRecord>(tx, "StorefrontTemplate", storeId, id, revision, { ...patch })); return row ? this.template(row) : null; }
  async countAssignments(tx: unknown, storeId: string, id: string) { return Number((await sql(tx).query<{ count: string | number }>(`SELECT COUNT(*) AS "count" FROM "StorefrontTemplateAssignment" WHERE "storeId" = $1 AND "templateId" = $2`, [storeId, id])).rows[0]?.count ?? 0); }
  async deleteTemplate(tx: unknown, storeId: string, id: string, revision: number) {
    const current = (await sql(tx).query<StorefrontTemplateRecord>(`SELECT * FROM "StorefrontTemplate" WHERE "storeId" = $1 AND "id" = $2 FOR UPDATE`, [storeId, id])).rows[0];
    if (!current) return null;
    if (current.revision !== revision) throw new ResourceRevisionConflictError(current.revision);
    await sql(tx).query(`DELETE FROM "StorefrontTemplate" WHERE "storeId" = $1 AND "id" = $2`, [storeId, id]);
    return this.template(current);
  }
  async cloneTemplate(tx: unknown, storeId: string, id: string, input: Parameters<TemplateRepository["cloneTemplate"]>[3]) { const source = (await sql(tx).query<StorefrontTemplateRecord>(`SELECT * FROM "StorefrontTemplate" WHERE "storeId" = $1 AND "id" = $2`, [storeId, id])).rows[0]; return source ? this.createTemplate(tx, { storeId, ...input, type: decodeType(source.type), layout: cloneLocalIds(source.layout) }) : null; }
  async getGlobalSection(storeId: string, id: string) { return (await this.read<GlobalSectionRecord>("GlobalSection", storeId, id))[0] ?? null; }
  listGlobalSections(storeId: string) { return this.read<GlobalSectionRecord>("GlobalSection", storeId); }
  createGlobalSection(tx: unknown, input: Parameters<GlobalSectionRepository["createGlobalSection"]>[1]) { return this.insert<GlobalSectionRecord>(tx, "GlobalSection", { ...input }); }
  updateGlobalSection(tx: unknown, storeId: string, id: string, revision: number, patch: Parameters<GlobalSectionRepository["updateGlobalSection"]>[4]) { return this.update<GlobalSectionRecord>(tx, "GlobalSection", storeId, id, revision, { ...patch }); }
  async getPreset(storeId: string, id: string) { return (await this.read<SectionPresetRecord>("SectionPreset", storeId, id))[0] ?? null; }
  listPresets(storeId: string) { return this.read<SectionPresetRecord>("SectionPreset", storeId); }
  createPreset(tx: unknown, input: Parameters<PresetRepository["createPreset"]>[1]) { return this.insert<SectionPresetRecord>(tx, "SectionPreset", { ...input }); }
  async getMenu(storeId: string, id: string) { return (await this.read<NavigationMenuRecord>("NavigationMenu", storeId, id))[0] ?? null; }
  listMenus(storeId: string) { return this.read<NavigationMenuRecord>("NavigationMenu", storeId); }
  createMenu(tx: unknown, input: Parameters<MenuRepository["createMenu"]>[1]) { return this.insert<NavigationMenuRecord>(tx, "NavigationMenu", { ...input }); }
  updateMenu(tx: unknown, storeId: string, id: string, revision: number, patch: Parameters<MenuRepository["updateMenu"]>[4]) { return this.update<NavigationMenuRecord>(tx, "NavigationMenu", storeId, id, revision, { ...patch }); }
  async resourceExists(tx: unknown, storeId: string, type: keyof typeof resourceTables, id: string) { return (await sql(tx).query(`SELECT "id" FROM "${resourceTables[type]}" WHERE "storeId" = $1 AND "id" = $2`, [storeId, id])).rows.length === 1; }
  getAssignment(storeId: string, type: TemplateAssignmentRecord["resourceType"], id: string) { return this.db.transaction(async (tx) => (await tx.query<TemplateAssignmentRecord>(`SELECT * FROM "StorefrontTemplateAssignment" WHERE "storeId" = $1 AND "resourceType" = $2 AND "resourceId" = $3`, [storeId, type, id])).rows[0] ?? null); }
  async getTemplateType(tx: unknown, storeId: string, id: string) { const row = (await sql(tx).query<{ type: string }>(`SELECT "type" FROM "StorefrontTemplate" WHERE "storeId" = $1 AND "id" = $2`, [storeId, id])).rows[0]; return row ? decodeType(row.type) : null; }
  async upsertAssignment(tx: unknown, input: Parameters<AssignmentRepository["upsertAssignment"]>[1]) {
    const current = (await sql(tx).query<TemplateAssignmentRecord>(`SELECT * FROM "StorefrontTemplateAssignment" WHERE "storeId" = $1 AND "resourceType" = $2 AND "resourceId" = $3 FOR UPDATE`, [input.storeId, input.resourceType, input.resourceId])).rows[0];
    if ((current?.revision ?? null) !== input.expectedRevision) throw new ResourceRevisionConflictError(current?.revision ?? 0);
    return (await sql(tx).query<TemplateAssignmentRecord>(`INSERT INTO "StorefrontTemplateAssignment" ("storeId", "resourceType", "resourceId", "templateId", "revision", "updatedAt") VALUES ($1,$2,$3,$4,0,NOW()) ON CONFLICT ("storeId", "resourceType", "resourceId") DO UPDATE SET "templateId" = EXCLUDED."templateId", "revision" = "StorefrontTemplateAssignment"."revision" + 1, "updatedAt" = NOW() RETURNING *`, [input.storeId, input.resourceType, input.resourceId, input.templateId])).rows[0];
  }
  async deleteAssignment(tx: unknown, input: Parameters<AssignmentRepository["deleteAssignment"]>[1]) {
    const current = (await sql(tx).query<TemplateAssignmentRecord>(`SELECT * FROM "StorefrontTemplateAssignment" WHERE "storeId" = $1 AND "resourceType" = $2 AND "resourceId" = $3 FOR UPDATE`, [input.storeId, input.resourceType, input.resourceId])).rows[0];
    if (!current) return false;
    if (current.revision !== input.expectedRevision) throw new ResourceRevisionConflictError(current.revision);
    await sql(tx).query(`DELETE FROM "StorefrontTemplateAssignment" WHERE "storeId" = $1 AND "resourceType" = $2 AND "resourceId" = $3`, [input.storeId, input.resourceType, input.resourceId]);
    return true;
  }
  getThemeConfiguration(storeId: string) { return this.db.transaction(async (tx) => (await tx.query<ThemeConfigurationRecord>(`SELECT * FROM "ThemeConfiguration" WHERE "storeId" = $1`, [storeId])).rows[0] ?? null); }
  async saveThemeConfiguration(tx: unknown, input: Parameters<ThemeRepository["saveThemeConfiguration"]>[1]) {
    const current = (await sql(tx).query<ThemeConfigurationRecord>(`SELECT * FROM "ThemeConfiguration" WHERE "storeId" = $1 FOR UPDATE`, [input.storeId])).rows[0];
    if ((current?.revision ?? null) !== input.expectedRevision) throw new ResourceRevisionConflictError(current?.revision ?? 0);
    return (await sql(tx).query<ThemeConfigurationRecord>(`INSERT INTO "ThemeConfiguration" ("storeId", "themeId", "themeVersion", "settings", "draftArtifactId", "updatedAt") VALUES ($1,$2,$3,$4::jsonb,$5,NOW()) ON CONFLICT ("storeId") DO UPDATE SET "themeId" = EXCLUDED."themeId", "themeVersion" = EXCLUDED."themeVersion", "settings" = EXCLUDED."settings", "draftArtifactId" = EXCLUDED."draftArtifactId", "revision" = "ThemeConfiguration"."revision" + 1, "updatedAt" = NOW() RETURNING *`, [input.storeId, input.themeId, input.themeVersion ?? "1.0.0", JSON.stringify(input.settings), input.draftArtifactId === undefined ? current?.draftArtifactId ?? null : input.draftArtifactId])).rows[0];
  }
}
export function createSqlWorkspaceApi(db: CommerceDatabase) {
  const repo = new SqlWorkspaceRepositories(db);
  return new DefaultStorefrontWorkspaceApi(repo, new TemplateService(repo, repo), new GlobalSectionService(repo, repo, repo), new MenuService(repo, repo), new ThemeService(repo, repo), new AssignmentService(repo, repo));
}
