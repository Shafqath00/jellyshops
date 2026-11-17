import { describe, expect, it } from "vitest";
import type { CommerceDatabase, SqlExecutor } from "../../src/commerce/repository.js";
import { createLocalV4CompilationService } from "../../src/storefront/local-v4-compilation.js";
import { SectionGroupService } from "../../src/storefront/section-groups/service.js";
import { StorefrontStarterInstallationService } from "../../src/storefront/starter/installation-service.js";
import { createPGliteDatabase, seedStore } from "./pglite.js";

type Database = Awaited<ReturnType<typeof createPGliteDatabase>>;

function transactionDatabase(database: Database): CommerceDatabase {
  return { async transaction(work) { return database.transaction((tx) => work({ query: (sql, values) => tx.query(sql, values) } as SqlExecutor)); } };
}

async function addShared(database: Database, storeId: string, id: string, type: string, settings: Record<string, unknown> = {}) {
  await database.query(
    `INSERT INTO "GlobalSection" ("id", "storeId", "name", "section", "updatedAt") VALUES ($1, $2, $3, $4::jsonb, NOW())`,
    [id, storeId, type, JSON.stringify({ id: `${id}-section`, type, enabled: true, settings, blocks: [] })],
  );
}

describe("section groups (theme plan T6)", () => {
  it("works the groups out from the templates until the merchant saves some", async () => {
    const database = await createPGliteDatabase();
    await seedStore(database, "store-a", "store-a");
    await new StorefrontStarterInstallationService(transactionDatabase(database), () => "install-a").install("store-a", "jelly-diode");
    const state = await new SectionGroupService(transactionDatabase(database)).read("store-a");
    expect(state).toMatchObject({ available: true, saved: false, groups: { overlay: [] } });
    expect(state.groups.header.length).toBeGreaterThanOrEqual(1);
    expect(state.groups.footer).toHaveLength(1);

    // Nothing saved: the published design carries no groups, so it draws exactly as before.
    const compiled = await createLocalV4CompilationService(database as unknown as SqlExecutor).compile("store-a", state.generation);
    expect(compiled.ok).toBe(true);
    expect(compiled.snapshot?.sectionGroups).toBeUndefined();
  });

  it("saves a footer section for every page and publishes it in the design", async () => {
    const database = await createPGliteDatabase();
    await seedStore(database, "store-b", "store-b");
    await new StorefrontStarterInstallationService(transactionDatabase(database), () => "install-b").install("store-b", "jelly-diode");
    const service = new SectionGroupService(transactionDatabase(database));
    const before = await service.read("store-b");
    await addShared(database, "store-b", "footer-promise", "rich-text");

    const groups = { ...before.groups, footer: ["footer-promise", ...before.groups.footer] };
    await expect(service.save("store-b", groups, before.generation - 1)).rejects.toMatchObject({ status: 409 });
    const saved = await service.save("store-b", groups, before.generation);
    expect(saved).toMatchObject({ saved: true, generation: before.generation + 1, groups });
    expect(await service.read("store-b")).toMatchObject({ saved: true, groups });

    // Checked against the group, not each page: rich text is not allowed on checkout pages, but the footer is fine.
    const compiled = await createLocalV4CompilationService(database as unknown as SqlExecutor).compile("store-b", saved.generation);
    expect(compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(compiled.snapshot?.sectionGroups).toEqual(groups);
  });

  it("refuses sections that are missing, repeated or not allowed in the group", async () => {
    const database = await createPGliteDatabase();
    await seedStore(database, "store-c", "store-c");
    await new StorefrontStarterInstallationService(transactionDatabase(database), () => "install-c").install("store-c", "jelly-diode");
    const service = new SectionGroupService(transactionDatabase(database));
    const { groups } = await service.read("store-c");
    await addShared(database, "store-c", "grid", "collection-product-grid");
    await addShared(database, "store-c", "news", "newsletter");

    await expect(service.save("store-c", { ...groups, footer: [...groups.footer, "nope"] })).rejects.toMatchObject({ status: 404 });
    await expect(service.save("store-c", { ...groups, footer: [...groups.footer, groups.header[0]] })).rejects.toMatchObject({ status: 400 });
    await expect(service.save("store-c", { ...groups, footer: [...groups.footer, "grid"] })).rejects.toMatchObject({ status: 400, code: "SECTION_NOT_ALLOWED_IN_GROUP" });
    await expect(service.save("store-c", { ...groups, header: [...groups.header, "news"] })).rejects.toMatchObject({ status: 400, code: "SECTION_NOT_ALLOWED_IN_GROUP" });
    await expect(service.save("store-c", { header: "x" })).rejects.toMatchObject({ status: 400 });
  });
});
