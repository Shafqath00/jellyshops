import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import type { SqlExecutor } from "../commerce/repository.js";
import type { CustomDataRepository, MetaobjectRepository, MetafieldDefinitionRecord, MetafieldValueRecord, MetaobjectDefinitionRecord, MetaobjectEntryRecord } from "./repository.js";

const jsonFields = new Set(["validations", "fields", "values", "value"]);
const ownerTables = { product: "Product", variant: "ProductVariant", collection: "Collection", page: "StorePage", blog: "Blog", article: "Article" } as const;
export class SqlCustomDataRepository implements CustomDataRepository, MetaobjectRepository {
  constructor(private readonly sql: SqlExecutor) {}
  private async insert<T extends QueryResultRow>(table: string, input: Record<string, unknown>): Promise<T> {
    const values = { id: randomUUID(), ...input }; const fields = Object.keys(values);
    return (await this.sql.query<T>(`INSERT INTO "${table}" (${fields.map((key) => `"${key}"`).join(", ")}, "updatedAt") VALUES (${fields.map((key, i) => `$${i + 1}${jsonFields.has(key) ? "::jsonb" : ""}`).join(", ")}, NOW()) RETURNING *`, Object.entries(values).map(([key, value]) => jsonFields.has(key) ? JSON.stringify(value) : value))).rows[0];
  }
  private async get<T extends QueryResultRow>(table: string, storeId: string, id: string): Promise<T | null> { return (await this.sql.query<T>(`SELECT * FROM "${table}" WHERE "storeId" = $1 AND "id" = $2`, [storeId, id])).rows[0] ?? null; }
  private async update<T extends QueryResultRow>(table: string, storeId: string, id: string, patch: Record<string, unknown>): Promise<T | null> {
    const fields = Object.entries(patch).filter(([, value]) => value !== undefined);
    return (await this.sql.query<T>(`UPDATE "${table}" SET "updatedAt" = NOW()${fields.map(([key], i) => `, "${key}" = $${i + 3}${jsonFields.has(key) ? "::jsonb" : ""}`).join("")} WHERE "storeId" = $1 AND "id" = $2 RETURNING *`, [storeId, id, ...fields.map(([key, value]) => jsonFields.has(key) ? JSON.stringify(value) : value)])).rows[0] ?? null;
  }
  createMetafieldDefinition(input: Parameters<CustomDataRepository["createMetafieldDefinition"]>[0]) { return this.insert<MetafieldDefinitionRecord>("MetafieldDefinition", { ...input }); }
  getMetafieldDefinition(storeId: string, id: string) { return this.get<MetafieldDefinitionRecord>("MetafieldDefinition", storeId, id); }
  async listMetafieldDefinitions(storeId: string, ownerType: Parameters<CustomDataRepository["listMetafieldDefinitions"]>[1]) { return (await this.sql.query<MetafieldDefinitionRecord>(`SELECT * FROM "MetafieldDefinition" WHERE "storeId" = $1 AND "ownerType" = $2 AND "archivedAt" IS NULL ORDER BY "namespace", "key"`, [storeId, ownerType])).rows; }
  updateMetafieldDefinition(storeId: string, id: string, patch: Parameters<CustomDataRepository["updateMetafieldDefinition"]>[2]) { return this.update<MetafieldDefinitionRecord>("MetafieldDefinition", storeId, id, { ...patch }); }
  async setMetafieldValue(input: Parameters<CustomDataRepository["setMetafieldValue"]>[0]) { return (await this.sql.query<MetafieldValueRecord>(`INSERT INTO "MetafieldValue" ("id", "storeId", "definitionId", "ownerId", "value", "updatedAt") VALUES ($1,$2,$3,$4,$5::jsonb,NOW()) ON CONFLICT ("storeId", "definitionId", "ownerId") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW() RETURNING *`, [randomUUID(), input.storeId, input.definitionId, input.ownerId, JSON.stringify(input.value)])).rows[0]; }
  async getMetafieldValue(storeId: string, definitionId: string, ownerId: string) { return (await this.sql.query<MetafieldValueRecord>(`SELECT * FROM "MetafieldValue" WHERE "storeId" = $1 AND "definitionId" = $2 AND "ownerId" = $3`, [storeId, definitionId, ownerId])).rows[0] ?? null; }
  async ownerExists(storeId: string, type: Parameters<CustomDataRepository["ownerExists"]>[1], id: string) {
    const table = type === "store" ? "Store" : ownerTables[type];
    return (await this.sql.query(`SELECT "id" FROM "${table}" WHERE ${type === "store" ? '"id" = $1 AND "id" = $2 AND "archivedAt" IS NULL' : '"storeId" = $1 AND "id" = $2'}`, [storeId, id])).rows.length === 1;
  }
  createMetaobjectDefinition(input: Parameters<MetaobjectRepository["createMetaobjectDefinition"]>[0]) { return this.insert<MetaobjectDefinitionRecord>("MetaobjectDefinition", { ...input }); }
  getMetaobjectDefinition(storeId: string, id: string) { return this.get<MetaobjectDefinitionRecord>("MetaobjectDefinition", storeId, id); }
  updateMetaobjectDefinition(storeId: string, id: string, patch: Parameters<MetaobjectRepository["updateMetaobjectDefinition"]>[2]) { return this.update<MetaobjectDefinitionRecord>("MetaobjectDefinition", storeId, id, { ...patch }); }
  async listMetaobjectDefinitions(storeId: string) { return (await this.sql.query<MetaobjectDefinitionRecord>(`SELECT * FROM "MetaobjectDefinition" WHERE "storeId" = $1 AND "archivedAt" IS NULL ORDER BY "handle"`, [storeId])).rows; }
  createMetaobjectEntry(input: Parameters<MetaobjectRepository["createMetaobjectEntry"]>[0]) { return this.insert<MetaobjectEntryRecord>("MetaobjectEntry", { ...input }); }
  getMetaobjectEntry(storeId: string, id: string) { return this.get<MetaobjectEntryRecord>("MetaobjectEntry", storeId, id); }
  updateMetaobjectEntry(storeId: string, id: string, patch: Parameters<MetaobjectRepository["updateMetaobjectEntry"]>[2]) { return this.update<MetaobjectEntryRecord>("MetaobjectEntry", storeId, id, { ...patch }); }
  async listMetaobjectEntries(storeId: string, definitionId: string) { return (await this.sql.query<MetaobjectEntryRecord>(`SELECT * FROM "MetaobjectEntry" WHERE "storeId" = $1 AND "definitionId" = $2 AND "archivedAt" IS NULL ORDER BY "handle"`, [storeId, definitionId])).rows; }
}
