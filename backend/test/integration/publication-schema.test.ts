import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "./pglite.js";

describe("compiled storefront publication schema", () => {
  let integration: IntegrationDatabase;

  beforeEach(async () => {
    integration = await createPGliteDatabase();
    await seedStore(integration, "store-a", "store-a");
  });

  afterEach(async () => {
    await integration.close();
  });

  it("accepts generation zero publications while keeping them immutable", async () => {
    const store = await integration.query<{ currentPublicationId: string | null }>(
      `SELECT "currentPublicationId" FROM "Store" WHERE "id" = $1`,
      ["store-a"],
    );
    expect(store.rows[0]?.currentPublicationId).toBeNull();

    await integration.query(
      `INSERT INTO "StorefrontPublication" (
        "id",
        "storeId",
        "sourceRevision",
        "sourceGeneration",
        "schemaVersion",
        "compilerVersion",
        "document",
        "dependencyManifest",
        "idempotencyKey",
        "publishedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)`,
      [
        "publication-a",
        "store-a",
        0,
        0,
        4,
        "v4-test-compiler",
        JSON.stringify({ schemaVersion: 4, sections: [] }),
        JSON.stringify({ themeId: "minimal", resourceIds: [] }),
        "store-a:generation-0",
        new Date("2026-09-22T00:00:00.000Z"),
      ],
    );

    await expect(
      integration.query(
        `UPDATE "StorefrontPublication" SET "compilerVersion" = $1 WHERE "id" = $2`,
        ["mutated-compiler", "publication-a"],
      ),
    ).rejects.toThrow(/Storefront publications are immutable/);
  });
});
