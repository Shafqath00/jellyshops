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
    const template = await api.createTemplate("store-a", { name: "Home", handle: "default", type: "home", layout: { sections: [{ kind: "inline", section: { id: "section-a", type: "hero", blocks: [{ id: "block-a" }] } }, { kind: "global", globalSectionId: "shared-a" }] } });
    const cloned = await api.cloneTemplate("store-a", template.template.id, { name: "Clone", handle: "clone" });
    const sections = cloned.template.layout.sections as Array<Record<string, unknown> & { section?: Record<string, unknown> }>;
    expect(sections[0].section?.id).not.toBe("section-a");
    expect(sections[1].globalSectionId).toBe("shared-a");
    const preset = await api.createPreset("store-a", { name: "Hero", section: { id: "old", blocks: [{ id: "old-block" }] } });
    expect((await api.instantiatePreset("store-a", preset.preset.id)).id).not.toBe("old");
    const reloaded = createSqlWorkspaceApi(database);
    expect(await reloaded.getMenu("store-a", created.menu.id)).toMatchObject({ name: "Updated", revision: 1 });
    expect(await reloaded.getWorkspace("store-a")).toMatchObject({ generation: 5 });
  });

  it("explains duplicate template names, deletes unused templates and removes assignments", async () => {
    db = await createPGliteDatabase(); await seedStore(db, "store-a", "a");
    await db.query(`INSERT INTO "Product" ("id", "storeId", "title", "slug", "updatedAt") VALUES ('bed-1', 'store-a', 'Oak bed', 'oak-bed', CURRENT_TIMESTAMP)`);
    const database = { transaction: <T>(work: (sql: IntegrationDatabase) => Promise<T>) => db.transaction((tx) => work(tx as IntegrationDatabase)) };
    const api = createSqlWorkspaceApi(database);
    const layout = { sections: [] };
    await api.createTemplate("store-a", { name: "Product", type: "product", layout });
    const bed = await api.createTemplate("store-a", { name: "Bed", handle: "bed", type: "product", layout });
    await expect(api.createTemplate("store-a", { name: "Bed again", handle: "bed", type: "product", layout }))
      .rejects.toMatchObject({ status: 409, code: "TEMPLATE_HANDLE_TAKEN" });
    await expect(api.cloneTemplate("store-a", bed.template.id, { name: "Copy", handle: "bed" }))
      .rejects.toMatchObject({ status: 409, code: "TEMPLATE_HANDLE_TAKEN" });
    expect(await api.getWorkspace("store-a")).toMatchObject({ generation: 2 });

    const assigned = await api.assignTemplate("store-a", { resourceType: "product", resourceId: "bed-1", templateId: bed.template.id, expectedRevision: null });
    await expect(api.deleteTemplate("store-a", bed.template.id, 0)).rejects.toMatchObject({ status: 409, code: "TEMPLATE_IN_USE" });
    await expect(api.removeAssignment("store-a", { resourceType: "product", resourceId: "bed-1", expectedRevision: 5 }))
      .rejects.toMatchObject({ currentRevision: assigned.assignment.revision });
    await api.removeAssignment("store-a", { resourceType: "product", resourceId: "bed-1", expectedRevision: assigned.assignment.revision });
    expect(await api.getAssignment("store-a", "product", "bed-1")).toBeNull();

    await expect(api.deleteTemplate("store-a", bed.template.id, 3)).rejects.toMatchObject({ currentRevision: 0 });
    await api.deleteTemplate("store-a", bed.template.id, 0);
    expect((await api.listTemplates("store-a", "product")).map(({ handle }) => handle)).toEqual(["default"]);
  });
});
