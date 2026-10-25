import type { CommerceDatabase, SqlExecutor } from "../commerce/repository.js";
import { ApiError } from "../http/errors.js";
import type { CategoryRecord, CategoryTemplateRecord, TaxonomyRepository, TemplateInput } from "./repository.js";

type Row = Record<string, unknown>;

const category = (row: Row): CategoryRecord => ({
  id: String(row.id), storeId: String(row.storeId), parentId: row.parentId ? String(row.parentId) : null, name: String(row.name), slug: String(row.slug),
  position: Number(row.position), source: row.source === "platform" ? "platform" : "merchant", seedKey: row.seedKey ? String(row.seedKey) : null,
});
const template = (row: Row): CategoryTemplateRecord => ({
  id: String(row.id), storeId: String(row.storeId), categoryId: String(row.categoryId), name: String(row.name),
  optionKind: row.optionKind as CategoryTemplateRecord["optionKind"], displayType: row.displayType as CategoryTemplateRecord["displayType"],
  required: Boolean(row.required), multiple: Boolean(row.multiple), defaultValues: Array.isArray(row.defaultValues) ? row.defaultValues.map(String) : [],
  position: Number(row.position), seedKey: row.seedKey ? String(row.seedKey) : null,
});

function conflict(error: unknown): never {
  if ((error as { code?: string }).code === "23505") throw new ApiError(409, "CATEGORY_CONFLICT", "A category with that name already exists here");
  throw error;
}

const CATEGORY_COLUMNS = `"id","storeId","parentId","name","slug","position","source","seedKey"`;
const TEMPLATE_COLUMNS = `"id","storeId","categoryId","name","optionKind","displayType","required","multiple","defaultValues","position","seedKey"`;

export class SqlTaxonomyRepository implements TaxonomyRepository {
  constructor(private readonly db: CommerceDatabase) {}
  private run<T>(work: (sql: SqlExecutor) => Promise<T>) { return this.db.transaction(work); }

  listCategories(storeId: string) {
    return this.run(async (sql) => (await sql.query(`SELECT ${CATEGORY_COLUMNS} FROM "Category" WHERE "storeId"=$1 AND "archivedAt" IS NULL ORDER BY "position","name"`, [storeId])).rows.map(category));
  }
  listTemplates(storeId: string) {
    return this.run(async (sql) => (await sql.query(`SELECT t.* FROM "CategoryOptionTemplate" t JOIN "Category" c ON c."storeId"=t."storeId" AND c."id"=t."categoryId" WHERE t."storeId"=$1 AND c."archivedAt" IS NULL ORDER BY t."position",t."name"`, [storeId])).rows.map(template));
  }
  countPlatformCategories(storeId: string) {
    return this.run(async (sql) => Number((await sql.query(`SELECT count(*)::int AS n FROM "Category" WHERE "storeId"=$1 AND "source"='platform'`, [storeId])).rows[0]?.n ?? 0));
  }
  seed(storeId: string, categories: CategoryRecord[], templates: CategoryTemplateRecord[]) {
    return this.run(async (sql) => {
      // Serialise concurrent first requests for the same store; ON CONFLICT is the second line of defence.
      await sql.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`category-seed:${storeId}`]);
      const idBySeedKey = new Map<string, string>();
      for (const row of categories) {
        const inserted = await sql.query(
          `INSERT INTO "Category" ("id","storeId","parentId","name","slug","position","source","seedKey","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,'platform',$7,NOW())
           ON CONFLICT ("storeId","seedKey") WHERE "seedKey" IS NOT NULL DO UPDATE SET "seedKey"=EXCLUDED."seedKey" RETURNING "id"`,
          [row.id, storeId, row.parentId ? idBySeedKey.get(categories.find((c) => c.id === row.parentId)?.seedKey ?? "") ?? row.parentId : null, row.name, row.slug, row.position, row.seedKey],
        );
        idBySeedKey.set(row.seedKey ?? row.id, String(inserted.rows[0].id));
      }
      for (const row of templates) {
        const owner = categories.find((c) => c.id === row.categoryId);
        await sql.query(
          `INSERT INTO "CategoryOptionTemplate" ("id","storeId","categoryId","name","optionKind","displayType","required","multiple","defaultValues","position","seedKey","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,NOW())
           ON CONFLICT ("storeId","seedKey") WHERE "seedKey" IS NOT NULL DO NOTHING`,
          [row.id, storeId, idBySeedKey.get(owner?.seedKey ?? "") ?? row.categoryId, row.name, row.optionKind, row.displayType, row.required, row.multiple, JSON.stringify(row.defaultValues), row.position, row.seedKey],
        );
      }
    });
  }
  getCategory(storeId: string, id: string) {
    return this.run(async (sql) => { const row = (await sql.query(`SELECT ${CATEGORY_COLUMNS} FROM "Category" WHERE "storeId"=$1 AND "id"=$2 AND "archivedAt" IS NULL`, [storeId, id])).rows[0]; return row ? category(row) : null; });
  }
  insertCategory(input: CategoryRecord) {
    return this.run(async (sql) => category((await sql.query(`INSERT INTO "Category" ("id","storeId","parentId","name","slug","position","source","seedKey","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING ${CATEGORY_COLUMNS}`, [input.id, input.storeId, input.parentId, input.name, input.slug, input.position, input.source, input.seedKey])).rows[0])).catch(conflict);
  }
  updateCategory(storeId: string, id: string, patch: Partial<Pick<CategoryRecord, "name" | "slug" | "parentId" | "position">>) {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
    return this.run(async (sql) => {
      const row = (await sql.query(`UPDATE "Category" SET "updatedAt"=NOW()${entries.map(([key], i) => `,"${key}"=$${i + 3}`).join("")} WHERE "storeId"=$1 AND "id"=$2 AND "archivedAt" IS NULL RETURNING ${CATEGORY_COLUMNS}`, [storeId, id, ...entries.map(([, value]) => value)])).rows[0];
      return row ? category(row) : null;
    }).catch(conflict);
  }
  archiveCategory(storeId: string, id: string) {
    return this.run(async (sql) => (await sql.query(`UPDATE "Category" SET "archivedAt"=NOW(),"updatedAt"=NOW() WHERE "storeId"=$1 AND "id"=$2 AND "archivedAt" IS NULL RETURNING "id"`, [storeId, id])).rows.length === 1);
  }
  getTemplate(storeId: string, id: string) {
    return this.run(async (sql) => { const row = (await sql.query(`SELECT ${TEMPLATE_COLUMNS} FROM "CategoryOptionTemplate" WHERE "storeId"=$1 AND "id"=$2`, [storeId, id])).rows[0]; return row ? template(row) : null; });
  }
  insertTemplate(input: CategoryTemplateRecord) {
    return this.run(async (sql) => template((await sql.query(
      `INSERT INTO "CategoryOptionTemplate" ("id","storeId","categoryId","name","optionKind","displayType","required","multiple","defaultValues","position","seedKey","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,NOW()) RETURNING ${TEMPLATE_COLUMNS}`,
      [input.id, input.storeId, input.categoryId, input.name, input.optionKind, input.displayType, input.required, input.multiple, JSON.stringify(input.defaultValues), input.position, input.seedKey])).rows[0])).catch(conflict);
  }
  updateTemplate(storeId: string, id: string, patch: Partial<TemplateInput>) {
    const entries = Object.entries(patch).filter(([key, value]) => value !== undefined && key !== "categoryId");
    return this.run(async (sql) => {
      const row = (await sql.query(`UPDATE "CategoryOptionTemplate" SET "updatedAt"=NOW()${entries.map(([key], i) => `,"${key}"=$${i + 3}${key === "defaultValues" ? "::jsonb" : ""}`).join("")} WHERE "storeId"=$1 AND "id"=$2 RETURNING ${TEMPLATE_COLUMNS}`,
        [storeId, id, ...entries.map(([key, value]) => key === "defaultValues" ? JSON.stringify(value) : value)])).rows[0];
      return row ? template(row) : null;
    }).catch(conflict);
  }
  deleteTemplate(storeId: string, id: string) {
    return this.run(async (sql) => (await sql.query(`DELETE FROM "CategoryOptionTemplate" WHERE "storeId"=$1 AND "id"=$2 RETURNING "id"`, [storeId, id])).rows.length === 1);
  }
}
