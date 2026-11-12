import { createStarterPack, getStarterPack } from "@jelly/storefront-themes";
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import type { CommerceDatabase, SqlExecutor } from "../../src/commerce/repository.js";
import { StorefrontStarterInstallationService } from "../../src/storefront/starter/installation-service.js";
import { LayoutUpgradeService } from "../../src/storefront/layout-upgrade/service.js";
import { createPGliteDatabase, seedStore } from "./pglite.js";

type Database = Awaited<ReturnType<typeof createPGliteDatabase>>;
type Placement = { kind: "inline"; section: { id: string; type: string; settings: Record<string, unknown>; blocks: Array<{ id: string; blocks?: unknown[] }> } } | { kind: "global"; globalSectionId: string };

function transactionDatabase(database: Database): CommerceDatabase {
  return { async transaction(work) { return database.transaction((tx) => work({ query: (sql, values) => tx.query(sql, values) } as SqlExecutor)); } };
}

const historyUrl = new URL("../../node_modules/@jelly/storefront-themes/dist/themes/jelly-resthaven/layout-history.json", import.meta.url);

/** Rewrites the installed draft as if the store had been installed from Resthaven's 5 November layout. */
async function useOldLayout(database: Database, storeId: string, installation: string) {
  const history = JSON.parse(await readFile(historyUrl, "utf8")) as { revisions: Array<{ revision: number; globalSections: never; templates: never }> };
  const current = getStarterPack("jelly-resthaven");
  const old = createStarterPack({ manifest: { id: "jelly-resthaven", name: "Resthaven", version: current.version, description: "x" } as never, starter: { globalSections: history.revisions[1].globalSections, templates: history.revisions[1].templates } })!;
  const rekeyBlocks = (blocks: Array<{ id: string; blocks?: unknown[] }>): unknown[] => blocks.map((block) => ({ ...block, id: `${installation}:${block.id}`, ...(block.blocks ? { blocks: rekeyBlocks(block.blocks as never) } : {}) }));
  for (const global of old.globalSections) {
    await database.query(`UPDATE "GlobalSection" SET "section" = $3::jsonb WHERE "storeId" = $1 AND "id" = $2`, [storeId, `${installation}:${global.section.id}`, JSON.stringify({ ...global.section, id: `${installation}:${global.section.id}`, blocks: rekeyBlocks(global.section.blocks as never) })]);
  }
  for (const template of old.templates) {
    const layout = { sections: (template.layout.sections as Placement[]).map((placement) => placement.kind === "global"
      ? { kind: "global", globalSectionId: `${installation}:${placement.globalSectionId}` }
      : { kind: "inline", section: { ...placement.section, id: `${installation}:${placement.section.id}`, blocks: rekeyBlocks(placement.section.blocks) } }) };
    await database.query(`UPDATE "StorefrontTemplate" SET "layout" = $3::jsonb WHERE "storeId" = $1 AND "id" = $2`, [storeId, `${installation}:${template.key}`, JSON.stringify(layout)]);
  }
  // Installed before revisions were recorded.
  await database.query(`UPDATE "StorefrontWorkspace" SET "layoutRevision" = NULL WHERE "storeId" = $1`, [storeId]);
}

async function homeTypes(database: Database, storeId: string): Promise<string[]> {
  const layout = (await database.query<{ layout: { sections: Placement[] } }>(`SELECT "layout" FROM "StorefrontTemplate" WHERE "storeId" = $1 AND "type" = 'HOME' AND "handle" = 'default'`, [storeId])).rows[0]!.layout;
  return layout.sections.flatMap((placement) => placement.kind === "inline" ? [placement.section.type] : []);
}

describe("layout upgrade", () => {
  it("records the current layout on install and offers nothing more", async () => {
    const database = await createPGliteDatabase();
    await seedStore(database, "store-a", "store-a");
    await new StorefrontStarterInstallationService(transactionDatabase(database), () => "install-a").install("store-a", "jelly-resthaven");
    expect((await database.query<{ layoutRevision: number }>(`SELECT "layoutRevision" FROM "StorefrontWorkspace" WHERE "storeId" = 'store-a'`)).rows[0]!.layoutRevision).toBe(4);
    const offer = await new LayoutUpgradeService(transactionDatabase(database)).offer("store-a");
    expect(offer).toMatchObject({ themeId: "jelly-resthaven", draft: { revision: 4, recognised: false }, current: { revision: 4 }, behind: false, lastUpgrade: null });
  });

  it("recognises an older layout, upgrades the draft keeping the merchant's edits, and undoes it", async () => {
    const database = await createPGliteDatabase();
    await seedStore(database, "store-b", "store-b");
    await new StorefrontStarterInstallationService(transactionDatabase(database), () => "install-b").install("store-b", "jelly-resthaven");
    await useOldLayout(database, "store-b", "install-b");
    // The merchant edits the old hero.
    const homeRow = (await database.query<{ id: string; layout: { sections: Placement[] } }>(`SELECT "id", "layout" FROM "StorefrontTemplate" WHERE "storeId" = 'store-b' AND "type" = 'HOME' AND "handle" = 'default'`)).rows[0]!;
    for (const placement of homeRow.layout.sections) if (placement.kind === "inline" && placement.section.type === "hero") placement.section.settings.heading = "Beds by Newbi";
    await database.query(`UPDATE "StorefrontTemplate" SET "layout" = $2::jsonb WHERE "id" = $1`, [homeRow.id, JSON.stringify(homeRow.layout)]);
    const oldHome = await homeTypes(database, "store-b");
    expect(oldHome).toContain("jelly-resthaven/categories");

    const service = new LayoutUpgradeService(transactionDatabase(database), () => "backup-1");
    const offer = (await service.offer("store-b"))!;
    expect(offer).toMatchObject({ draft: { revision: 2, recognised: true }, current: { revision: 4 }, behind: true });

    const preview = await service.preview("store-b");
    expect(preview.problems).toEqual([]);
    const home = preview.pages.find((page) => page.page === "Home page")!;
    expect(home.added).toContain("Collection list");
    expect(home.carried).toEqual([expect.objectContaining({ section: "Hero banner", settings: ["heading"] })]);

    await expect(service.apply("store-b", offer.generation - 1, "user-1")).rejects.toMatchObject({ status: 409 });
    const applied = await service.apply("store-b", offer.generation, "user-1");
    expect(applied.revision).toBe(4);
    const newHome = await homeTypes(database, "store-b");
    expect(newHome).toContain("category-grid");
    expect(newHome).not.toContain("jelly-resthaven/categories");
    const hero = (await database.query<{ layout: { sections: Placement[] } }>(`SELECT "layout" FROM "StorefrontTemplate" WHERE "id" = $1`, [homeRow.id])).rows[0]!.layout.sections.find((placement) => placement.kind === "inline" && placement.section.type === "hero");
    expect(hero && hero.kind === "inline" && hero.section.settings.heading).toBe("Beds by Newbi");

    const afterOffer = (await service.offer("store-b"))!;
    expect(afterOffer).toMatchObject({ draft: { revision: 4, recognised: false }, behind: false, lastUpgrade: { id: "backup-1", fromRevision: 2, toRevision: 4 } });
    await expect(service.preview("store-b")).rejects.toMatchObject({ status: 409 });

    await service.rollback("store-b", afterOffer.generation);
    expect(await homeTypes(database, "store-b")).toEqual(oldHome);
    const restored = (await service.offer("store-b"))!;
    expect(restored).toMatchObject({ draft: { revision: 2, recognised: true }, behind: true, lastUpgrade: null });
    await expect(service.rollback("store-b", restored.generation)).rejects.toMatchObject({ status: 409 });
  });

  it("offers nothing for themes without earlier layouts", async () => {
    const database = await createPGliteDatabase();
    await seedStore(database, "store-c", "store-c");
    await new StorefrontStarterInstallationService(transactionDatabase(database), () => "install-c").install("store-c", "jelly-halo");
    expect(await new LayoutUpgradeService(transactionDatabase(database)).offer("store-c")).toBeNull();
  });
});
