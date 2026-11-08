import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "./postgres-repository.js";
import { CatalogService } from "./service.js";
import { resolveProductDescription } from "./product-description.js";

const text = (value: string, marks?: Array<{ type: string }>) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("resolveProductDescription", () => {
  it("leaves plain-text input untouched", () => {
    const input = { description: "Soft cotton" };
    expect(resolveProductDescription(input)).toBe(input);
  });

  it("keeps the supported formatting, drops everything else and derives the plain text", () => {
    const resolved = resolveProductDescription({
      description: "client supplied text that must not win",
      descriptionDoc: doc(
        { type: "heading", attrs: { level: 2 }, content: [text("Details")] },
        paragraph(text("Soft ", [{ type: "bold" }, { type: "underline" }]), text("cotton", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])),
        { type: "script", content: [text("alert(1)")] },
        { type: "image", attrs: { src: "https://evil.example/x.png", onerror: "x" } },
      ),
    });
    expect(resolved.description).toBe("Details\n\nSoft cotton");
    expect(JSON.stringify(resolved.descriptionDoc)).not.toMatch(/javascript|script|image|onerror/);
    expect(resolved.descriptionDoc).toMatchObject({ content: [{ type: "heading" }, { type: "paragraph", content: [{ marks: [{ type: "bold" }, { type: "underline" }] }, { text: "cotton" }] }] });
  });

  it("treats an empty editor as clearing the rich text", () => {
    expect(resolveProductDescription({ description: "old", descriptionDoc: doc(paragraph()) })).toEqual({ description: "", descriptionDoc: null });
  });

  it("passes null through so a document can be removed", () => {
    expect(resolveProductDescription({ descriptionDoc: null })).toEqual({ descriptionDoc: null });
  });

  it("rejects documents that are not documents or are too large", () => {
    expect(() => resolveProductDescription({ descriptionDoc: { type: "paragraph" } })).toThrow(/description/i);
    expect(() => resolveProductDescription({ descriptionDoc: "<p>hi</p>" })).toThrow(/description/i);
    expect(() => resolveProductDescription({ descriptionDoc: doc(paragraph(text("x".repeat(210_000)))) })).toThrow(/too long/i);
  });
});

describe("product description document persistence", () => {
  let database: IntegrationDatabase;
  let service: CatalogService;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    const repository = new CatalogPostgresRepository(database);
    service = new CatalogService(repository, repository);
    await seedStore(database, "store-a", "store-a");
  });
  afterEach(async () => { await database.close(); });

  it("stores the document with derived plain text, returns it, and clears it again", async () => {
    const created = await service.createProduct("store-a", { handle: "tee", title: "Tee", status: "ACTIVE", variants: [{ title: "Standard", priceMinor: 1000 }], descriptionDoc: doc(paragraph(text("Made to last", [{ type: "bold" }]))) });
    expect(created.description).toBe("Made to last");
    expect(created.descriptionDoc).toEqual(doc(paragraph(text("Made to last", [{ type: "bold" }]))));

    const reloaded = await service.getProduct("store-a", created.id);
    expect(reloaded?.descriptionDoc).toEqual(created.descriptionDoc);
    const listed = await service.listPublicProducts("store-a", { limit: 10 });
    expect(listed.nodes[0].descriptionDoc).toEqual(created.descriptionDoc);

    const edited = await service.updateProduct("store-a", created.id, { descriptionDoc: doc(paragraph(text("New copy"))) });
    expect(edited).toMatchObject({ description: "New copy", descriptionDoc: doc(paragraph(text("New copy"))) });

    const untouched = await service.updateProduct("store-a", created.id, { title: "Tee v2" });
    expect(untouched).toMatchObject({ title: "Tee v2", description: "New copy", descriptionDoc: doc(paragraph(text("New copy"))) });

    const cleared = await service.updateProduct("store-a", created.id, { descriptionDoc: null, description: "Plain again" });
    expect(cleared).toMatchObject({ description: "Plain again", descriptionDoc: null });
  });

  it("keeps plain-text products working without a document", async () => {
    const created = await service.createProduct("store-a", { handle: "mug", title: "Mug", description: "Ceramic", variants: [{ title: "Standard", priceMinor: 500 }] });
    expect(created).toMatchObject({ description: "Ceramic", descriptionDoc: null });
  });

  it("rejects an unsupported document without saving anything", async () => {
    await expect(service.createProduct("store-a", { handle: "bad", title: "Bad", descriptionDoc: { nope: true }, variants: [{ title: "Standard", priceMinor: 1 }] })).rejects.toMatchObject({ code: "DESCRIPTION_INVALID" });
    expect((await service.listProducts("store-a", { limit: 10 })).nodes).toHaveLength(0);
  });
});
