import { afterEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../../test/integration/pglite.js";
import { createSqlWorkspaceApi } from "./sql-repositories.js";

describe("durable workspace services", () => {
  let db: IntegrationDatabase;
  afterEach(async () => { await db?.close(); });
  it("persists menus, revisions, clones, and presets with one generation per mutation", async () => {
    db = await createPGliteDatabase(); await seedStore(db, "store-a", "a"); await seedStore(db, "store-b", "b");
    const database = { transaction: <T>(work: (sql: IntegrationDatabase) => Promise<T>) => db.transaction((tx) => work(tx as IntegrationDatabase)) };
    const api = createSqlWorkspaceApi(database);
    const created = await api.createMenu("store-a", { name: "Main", handle: "main", items: [{ id: "home", label: "Home", target: { kind: "home" }, children: [] }] });
    expect(created.generation).toBe(1);
    await api.updateMenu("store-a", created.menu.id, 0, { name: "Updated" });
    await expect(api.updateMenu("store-a", created.menu.id, 0, { name: "Stale" })).rejects.toMatchObject({ currentRevision: 1 });
    expect(await api.getWorkspace("store-a")).toMatchObject({ generation: 2 });
    expect(await api.listMenus("store-b")).toEqual([]);
    const template = await api.createTemplate("store-a", { name: "Home", handle: "default", type: "home", layout: { sections: [{ id: "section-a", blocks: [{ id: "block-a" }] }, { globalSectionId: "shared-a" }] } });
    const cloned = await api.cloneTemplate("store-a", template.template.id, { name: "Clone", handle: "clone" });
    const sections = cloned.template.layout.sections as Array<Record<string, unknown>>;
    expect(sections[0].id).not.toBe("section-a");
    expect(sections[1].globalSectionId).toBe("shared-a");
    const preset = await api.createPreset("store-a", { name: "Hero", section: { id: "old", blocks: [{ id: "old-block" }] } });
    expect((await api.instantiatePreset("store-a", preset.preset.id)).id).not.toBe("old");
    const reloaded = createSqlWorkspaceApi(database);
    expect(await reloaded.getMenu("store-a", created.menu.id)).toMatchObject({ name: "Updated", revision: 1 });
    expect(await reloaded.getWorkspace("store-a")).toMatchObject({ generation: 5 });
  });
});
