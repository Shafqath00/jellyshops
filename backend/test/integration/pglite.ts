import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const migrationDirectory = new URL("../../sql/migrations/", import.meta.url);
const schemaMigrations = [
  "20260903164628_init.sql",
  "20260905090000_tenant_storefront.sql",
  "20260913200000_add_media_metadata.sql",
  "20260913210000_add_canonical_catalog.sql",
  "20260914000000_add_storefront_workspace.sql",
  "20260914010000_compile_storefront_publications.sql",
  "20260919130000_add_theme_configuration_version.sql",
  "20260919131000_fix_theme_version_constraint.sql",
  "20260920110000_add_product_configuration_metadata.sql",
  "20260922000000_v4_publication_activation.sql",
  "20260923090000_add_not_found_template.sql",
  "20260923100000_add_starter_pack_provenance.sql",
] as const;

export type IntegrationDatabase = PGlite;

export async function createPGliteDatabase(): Promise<IntegrationDatabase> {
  const database = new PGlite();

  for (const migration of schemaMigrations) {
    await database.exec(await readFile(new URL(migration, migrationDirectory), "utf8"));
  }

  return database;
}

export async function seedStore(database: IntegrationDatabase, id: string, slug: string): Promise<void> {
  await database.query(
    `INSERT INTO "Store" ("id", "name", "slug", "currency", "country", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
    [id, id, slug, "USD", "US"],
  );
}
