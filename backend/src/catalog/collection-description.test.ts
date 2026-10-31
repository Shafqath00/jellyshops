import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "./postgres-repository.js";
import { CatalogService } from "./service.js";
import { resolveProductDescription } from "./product-description.js";

const text = (value: string, marks?: Array<{ type: string }>) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("collection descriptions", () => {
  let database: IntegrationDatabase;
  let service: CatalogService;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql", "20261101000000_collection_description_document.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    const repository = new CatalogPostgresRepository(database);
    service = new CatalogService(repository, repository);
    await seedStore(database, "store-a", "store-a");
  });
  afterEach(async () => { await database.close(); });

  it("stores the document with derived plain text, returns it and clears it again", async () => {
    const created = await service.createCollection("store-a", { handle: "cakes", title: "Cakes", descriptionDoc: doc(paragraph(text("Baked ", [{ type: "bold" }]), text("daily"))) });
    expect(created.descriptionDoc).toEqual(doc(paragraph(text("Baked ", [{ type: "bold" }]), text("daily"))));
    const detail = await service.getCollection("store-a", created.id);
    expect(detail).toMatchObject({ description: "Baked daily", descriptionDoc: created.descriptionDoc });
    expect((await service.listCollections("store-a", { limit: 10 })).nodes[0]).toMatchObject({ description: "Baked daily" });

    const edited = await service.updateCollection("store-a", created.id, { descriptionDoc: doc(paragraph(text("New copy"))) });
    expect(edited).toMatchObject({ description: "New copy", descriptionDoc: doc(paragraph(text("New copy"))) });
    const untouched = await service.updateCollection("store-a", created.id, { title: "Celebration cakes" });
    expect(untouched).toMatchObject({ title: "Celebration cakes", description: "New copy", descriptionDoc: doc(paragraph(text("New copy"))) });
    const cleared = await service.updateCollection("store-a", created.id, { descriptionDoc: null, description: "Plain again" });
    expect(cleared).toMatchObject({ description: "Plain again", descriptionDoc: null });
  });

  it("keeps plain-text collections working", async () => {
    const created = await service.createCollection("store-a", { handle: "pies", title: "Pies", description: "Sweet and savoury" });
    expect(created).toMatchObject({ description: "Sweet and savoury", descriptionDoc: null });
  });

  it("rejects an unsupported document in plain words", async () => {
    await expect(service.createCollection("store-a", { handle: "bad", title: "Bad", descriptionDoc: { nope: true } })).rejects.toMatchObject({ code: "DESCRIPTION_INVALID", message: expect.stringContaining("collection description") });
    expect((await service.listCollections("store-a", { limit: 10 })).nodes).toHaveLength(0);
    expect(() => resolveProductDescription({ descriptionDoc: { nope: true } }, "collection")).toThrow("collection description");
  });
});
