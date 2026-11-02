import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../../test/integration/pglite.js";
import { MAX_THEME_LOOKS, ThemeLibraryService } from "./service.js";

describe("ThemeLibraryService", () => {
  let database: IntegrationDatabase;
  let service: ThemeLibraryService;
  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "a");
    await seedStore(database, "store-b", "b");
    service = new ThemeLibraryService(database as never);
  });
  afterEach(async () => database.close());

  it("saves a look with the theme's current version, lists it for its own store only, renames and deletes it", async () => {
    const look = await service.save("store-a", { name: "  Winter   sale ", themeId: "jelly-avenue", settings: { colors: { primary: "#112233" } } });
    expect(look).toMatchObject({ name: "Winter sale", themeId: "jelly-avenue", settings: { colors: { primary: "#112233" } } });
    expect(look.themeVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(await service.list("store-a")).toHaveLength(1);
    expect(await service.list("store-b")).toEqual([]);

    expect((await service.rename("store-a", look.id, "Winter")).name).toBe("Winter");
    await expect(service.rename("store-b", look.id, "Hijack")).rejects.toMatchObject({ status: 404 });
    await expect(service.remove("store-b", look.id)).rejects.toMatchObject({ status: 404 });
    await service.remove("store-a", look.id);
    expect(await service.list("store-a")).toEqual([]);
  });

  it("refuses empty or long names, unknown themes and settings the theme doesn't accept", async () => {
    const settings = {};
    await expect(service.save("store-a", { name: "   ", themeId: "jelly-avenue", settings })).rejects.toMatchObject({ code: "INVALID_NAME" });
    await expect(service.save("store-a", { name: "x".repeat(81), themeId: "jelly-avenue", settings })).rejects.toMatchObject({ code: "INVALID_NAME" });
    await expect(service.save("store-a", { name: "Ghost", themeId: "no-such-theme", settings })).rejects.toMatchObject({ code: "UNKNOWN_THEME" });
    await expect(service.save("store-a", { name: "Bad", themeId: "jelly-avenue", settings: { productCard: { radius: "triangle" } } })).rejects.toMatchObject({ code: "INVALID_THEME_SETTINGS" });
  });

  it("keeps at most the allowed number of looks per store", async () => {
    for (let index = 0; index < MAX_THEME_LOOKS; index++) await service.save("store-a", { name: `Look ${index}`, themeId: "jelly-signature", settings: {} });
    await expect(service.save("store-a", { name: "One more", themeId: "jelly-signature", settings: {} })).rejects.toMatchObject({ status: 409, code: "LIBRARY_FULL" });
    await expect(service.save("store-b", { name: "Fine", themeId: "jelly-signature", settings: {} })).resolves.toMatchObject({ name: "Fine" });
  });
});
